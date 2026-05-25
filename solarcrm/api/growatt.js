// ============================================================
//  SolarCRM â€” Proxy Growatt OSS (oss.growatt.com)
//  AutenticaÃ§Ã£o: POST /login â†’ cookie â†’ GET /index â†’ assToken
// ============================================================

const crypto = require('crypto');
const BASE = 'https://oss.growatt.com';

let _session = { cookie: null, expiresAt: 0 };

function md5(str) {
  return crypto.createHash('md5').update(str).digest('hex');
}

function extractCookies(headers) {
  const raw = headers.getSetCookie?.() || [];
  return raw.map(c => c.split(';')[0]).join('; ');
}

async function getSession() {
  const now = Date.now();
  if (_session.cookie && now < _session.expiresAt) return _session.cookie;

  const user = (process.env.GROWATT_USER || '').trim();
  const pass = (process.env.GROWATT_PASS || '').trim();
  if (!user || !pass) throw new Error('GROWATT_USER ou GROWATT_PASS nÃ£o configurados');

  // â”€â”€ Passo 1: POST /login â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const loginRes = await fetch(`${BASE}/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
      'Referer': `${BASE}/login`,
      'Origin': BASE,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
    body: new URLSearchParams({
      account: user,
      password: md5(pass),
      validateCode: '',
      isReadPact: '0',
      lang: 'en',
    }).toString(),
    redirect: 'follow',
  });

  let cookies = extractCookies(loginRes.headers);
  if (!cookies.includes('JSESSIONID')) {
    const txt = await loginRes.text();
    throw new Error(`Login sem JSESSIONID. Status:${loginRes.status} Body:${txt.slice(0,150)}`);
  }

  // â”€â”€ Passo 2: GET /index para obter assToken â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const indexRes = await fetch(`${BASE}/index`, {
    method: 'GET',
    headers: {
      'Cookie': cookies,
      'Referer': `${BASE}/login`,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
    redirect: 'follow',
  });

  const indexCookies = extractCookies(indexRes.headers);
  if (indexCookies) cookies = cookies + '; ' + indexCookies;

  // Extrai assToken do HTML da pÃ¡gina index
  const indexHtml = await indexRes.text();
  const assMatch = indexHtml.match(/assToken['":\s]+([a-f0-9]{32})/i);
  if (assMatch) {
    cookies = cookies + `; assToken=${assMatch[1]}`;
  }

  // â”€â”€ Passo 3: GET /loginInfo.do para obter assToken via JSON â”€
  if (!cookies.includes('assToken')) {
    try {
      const infoRes = await fetch(`${BASE}/loginInfo.do`, {
        headers: {
          'Cookie': cookies,
          'X-Requested-With': 'XMLHttpRequest',
          'Referer': `${BASE}/index`,
        },
      });
      const infoJson = await infoRes.json().catch(() => null);
      if (infoJson?.back?.data?.assToken) {
        cookies = cookies + `; assToken=${infoJson.back.data.assToken}`;
      }
      const infoCookies = extractCookies(infoRes.headers);
      if (infoCookies) cookies = cookies + '; ' + infoCookies;
    } catch(_) {}
  }

  _session = { cookie: cookies, expiresAt: now + 25 * 60 * 1000 };
  return cookies;
}

async function ossPost(path, cookie, params = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
      'Referer': `${BASE}/index`,
      'Origin': BASE,
      'Cookie': cookie,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
    body: new URLSearchParams(params).toString(),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) throw new Error(`POST ${path} â†’ HTTP ${res.status}`);
  const text = await res.text();
  if (text.trim().startsWith('<')) throw new Error(`HTML recebido em ${path} â€” sessÃ£o invÃ¡lida`);
  try { return JSON.parse(text); }
  catch(e) { throw new Error(`Resposta nÃ£o-JSON: ${text.slice(0, 150)}`); }
}

function normalizePlant(p) {
  const rawStatus = String(p.status ?? '-1');
  const status = rawStatus === '1' ? 'OK' : rawStatus === '0' ? 'OFFLINE' : 'NO_COMMUNICATION';
  const power = parseFloat(p.nominalPower || p.peakPower || p.designCapacity || 0);
  return {
    id:            String(p.id || p.plantId || Math.random()),
    name:          p.plantName || p.name || 'Planta Growatt',
    status,
    manufacturer:  'Growatt',
    power:         power.toFixed(2),
    energyDay:     parseFloat(p.todayEnergy  || p.eDay   || 0).toFixed(2),
    energyMonth:   parseFloat(p.monthEnergy  || p.eMonth || 0).toFixed(2),
    energyTotal:   parseFloat(p.totalEnergy  || p.eTotal || 0).toFixed(2),
    current_power: parseFloat(p.currentPower || p.pac    || 0).toFixed(2),
    updated_at:    p.lastUpdateTime || new Date().toISOString(),
    created_at:    p.createTime     || new Date().toISOString(),
    alert:         status !== 'OK',
  };
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const debug = req.query.debug === '1';
  const debugLog = [];

  try {
    const cookie = await getSession();
    if (debug) debugLog.push({
      step: 'login',
      ok: true,
      hasAssToken: cookie.includes('assToken'),
      cookiePreview: cookie.slice(0, 80) + 'â€¦',
    });

    // Lista plantas com paginaÃ§Ã£o
    let page = 1;
    const allPlants = [];

    while (true) {
      const json = await ossPost('/deviceManage/plantManage/list', cookie, {
        page, iCode: '', uOrP: '', groupId: '-1',
        accountName: '', plantNmi: '', plantName: '',
        city: '', designPower: '', totalPowerstar: '',
        totalPowerend: '', createPlantstatrime: '',
        createPlantendTime: '', deviceSN: '',
        plantType: '-1', status: '', order: '1',
      });

      if (debug) debugLog.push({ step: `page-${page}`, response: json });

      const plants = json?.obj?.datas || json?.data?.plants || json?.plants || [];
      if (!plants.length) break;

      allPlants.push(...plants);
      const total = parseInt(json?.obj?.totalCount || json?.total || plants.length);
      if (allPlants.length >= total) break;
      page++;
    }

    if (!allPlants.length) {
      return res.status(200).json({
        ok: false,
        error: 'Login OK mas nenhuma planta encontrada',
        ...(debug ? { debugLog } : {}),
      });
    }

    return res.status(200).json({
      ok: true, source: 'growatt',
      total: allPlants.length,
      data: allPlants.map(normalizePlant),
      ...(debug ? { debugLog } : {}),
    });

  } catch (err) {
    console.error('[Growatt]', err.message);
    return res.status(500).json({
      ok: false, error: err.message,
      ...(debug ? { debugLog } : { tip: 'Use ?debug=1 para detalhes' }),
    });
  }
};
