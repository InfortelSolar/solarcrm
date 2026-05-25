// ============================================================
//  SolarCRM — Proxy Growatt OSS (oss.growatt.com)
//  Autenticação: POST /login.do → cookie JSESSIONID + assToken
//  Lista plantas: POST /deviceManage/plantManage/list
// ============================================================

const crypto = require('crypto');

const BASE = 'https://oss.growatt.com';

// Cache de sessão em memória
let _session = { cookie: null, expiresAt: 0 };

function md5(str) {
  return crypto.createHash('md5').update(str).digest('hex');
}

async function getSession() {
  const now = Date.now();
  if (_session.cookie && now < _session.expiresAt) {
    return _session.cookie;
  }

  const user = (process.env.GROWATT_USER || '').trim();
  const pass = (process.env.GROWATT_PASS || '').trim();
  if (!user || !pass) throw new Error('GROWATT_USER ou GROWATT_PASS não configurados');

  const body = new URLSearchParams({
    account: user,
    password: md5(pass),
    validateCode: '',
    isReadPact: '0',
    lang: 'en',
  });

  const res = await fetch(`${BASE}/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
      'Referer': `${BASE}/login`,
      'Origin': BASE,
    },
    body: body.toString(),
    redirect: 'follow',
  });

  // Extrai todos os cookies do response
  const rawCookies = res.headers.getSetCookie?.() || [];
  let cookieStr = rawCookies
    .map(c => c.split(';')[0])
    .join('; ');

  if (!cookieStr.includes('JSESSIONID')) {
    const text = await res.text();
    throw new Error(`Login falhou — sem JSESSIONID. Status: ${res.status}. Body: ${text.slice(0, 200)}`);
  }

  // Busca assToken via endpoint dedicado
  try {
    const tokenRes = await fetch(`${BASE}/login/token`, {
      method: 'GET',
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': `${BASE}/index`,
        'Cookie': cookieStr,
      },
    });
    const tokenCookies = tokenRes.headers.getSetCookie?.() || [];
    const tokenStr = tokenCookies.map(c => c.split(';')[0]).join('; ');
    if (tokenStr) cookieStr = cookieStr + '; ' + tokenStr;

    // Tenta extrair assToken do body
    const tokenJson = await tokenRes.json().catch(() => null);
    if (tokenJson?.assToken) {
      cookieStr = cookieStr + `; assToken=${tokenJson.assToken}`;
    }
  } catch(_) {}

  // Busca index para obter assToken do cookie
  try {
    const indexRes = await fetch(`${BASE}/index`, {
      method: 'GET',
      headers: {
        'Referer': `${BASE}/login`,
        'Cookie': cookieStr,
      },
      redirect: 'follow',
    });
    const indexCookies = indexRes.headers.getSetCookie?.() || [];
    const indexStr = indexCookies.map(c => c.split(';')[0]).join('; ');
    if (indexStr) cookieStr = cookieStr + '; ' + indexStr;
  } catch(_) {}

  _session = { cookie: cookieStr, expiresAt: now + 25 * 60 * 1000 };
  return cookieStr;
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
    },
    body: new URLSearchParams(params).toString(),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) throw new Error(`POST ${path} → HTTP ${res.status}`);
  const text = await res.text();
  try { return JSON.parse(text); }
  catch(e) { throw new Error(`Resposta não-JSON (${res.status}): ${text.slice(0, 150)}`); }
}

function normalizePlant(p) {
  const rawStatus = String(p.status ?? '-1');
  let status;
  if (rawStatus === '1')      status = 'OK';
  else if (rawStatus === '0') status = 'OFFLINE';
  else                        status = 'NO_COMMUNICATION';

  const power = parseFloat(p.nominalPower || p.peakPower || p.designCapacity || 0);

  return {
    id:            String(p.id || p.plantId || Math.random()),
    name:          p.plantName || p.name || 'Planta Growatt',
    status,
    manufacturer:  'Growatt',
    power:         power.toFixed(2),
    energyDay:     parseFloat(p.todayEnergy   || p.eDay   || 0).toFixed(2),
    energyMonth:   parseFloat(p.monthEnergy   || p.eMonth || 0).toFixed(2),
    energyTotal:   parseFloat(p.totalEnergy   || p.eTotal || 0).toFixed(2),
    current_power: parseFloat(p.currentPower  || p.pac    || 0).toFixed(2),
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
    // 1. Login
    const cookie = await getSession();
    if (debug) debugLog.push({ step: 'login', ok: true, cookie: cookie.slice(0, 60) + '…' });

    // 2. Lista de plantas
    let page = 1;
    const allPlants = [];

    while (true) {
      const json = await ossPost('/deviceManage/plantManage/list', cookie, {
        page,
        iCode: '',
        uOrP: '',
        groupId: '-1',
        accountName: '',
        plantNmi: '',
        plantName: '',
        city: '',
        designPower: '',
        totalPowerstar: '',
        totalPowerend: '',
        createPlantstatrime: '',
        createPlantendTime: '',
        deviceSN: '',
        plantType: '-1',
        status: '',
        order: '1',
      });

      if (debug) debugLog.push({ step: `page-${page}`, response: json });

      const plants = json?.obj?.datas || json?.data?.plants || json?.plants || [];
      if (!plants.length) break;

      allPlants.push(...plants);

      const total = json?.obj?.totalCount || json?.total || plants.length;
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
      ok: true,
      source: 'growatt',
      total: allPlants.length,
      data: allPlants.map(normalizePlant),
      ...(debug ? { debugLog } : {}),
    });

  } catch (err) {
    console.error('[Growatt]', err.message);
    return res.status(500).json({
      ok: false,
      error: err.message,
      ...(debug ? { debugLog } : { tip: 'Use ?debug=1 para detalhes' }),
    });
  }
};
