// ============================================================
//  SolarCRM — Proxy Growatt API (server.growatt.com)
//  Autenticação: POST /newTwoLoginAPI.do (usuário + senha MD5)
// ============================================================

const crypto = require('crypto');

const BASE = 'https://server.growatt.com';

// Cache de sessão em memória
let _session = { cookie: null, expiresAt: 0 };

function md5(str) {
  return crypto.createHash('md5').update(str).digest('hex');
}

// Login e obtém cookie de sessão
async function getSession() {
  const now = Date.now();
  if (_session.cookie && now < _session.expiresAt) {
    return _session.cookie;
  }

  const user = process.env.GROWATT_USER || '';
  const pass = process.env.GROWATT_PASS || '';

  if (!user || !pass) throw new Error('GROWATT_USER ou GROWATT_PASS não configurados');

  const body = new URLSearchParams({
    account: user,
    password: md5(pass),
  });

  const res = await fetch(`${BASE}/newTwoLoginAPI.do`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) throw new Error(`Growatt login HTTP ${res.status}`);

  const json = await res.json();
  if (json.result !== 1) throw new Error(`Growatt login falhou: ${JSON.stringify(json)}`);

  // Extrai cookie de sessão
  const setCookie = res.headers.get('set-cookie') || '';
  const jsessionid = setCookie.match(/JSESSIONID=([^;]+)/)?.[1];
  if (!jsessionid) throw new Error('Cookie JSESSIONID não encontrado');

  const cookie = `JSESSIONID=${jsessionid}`;
  _session = { cookie, expiresAt: now + 25 * 60 * 1000 }; // 25 min
  return cookie;
}

async function growattGet(path, cookie, params = {}) {
  const url = `${BASE}${path}?${new URLSearchParams(params)}`;
  const res = await fetch(url, {
    headers: { Cookie: cookie },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Growatt GET ${path} → HTTP ${res.status}`);
  const text = await res.text();
  try { return JSON.parse(text); }
  catch(e) { throw new Error(`Resposta não-JSON: ${text.slice(0,100)}`); }
}

async function growattPost(path, cookie, params = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: cookie,
    },
    body: new URLSearchParams(params).toString(),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Growatt POST ${path} → HTTP ${res.status}`);
  const text = await res.text();
  try { return JSON.parse(text); }
  catch(e) { throw new Error(`Resposta não-JSON: ${text.slice(0,100)}`); }
}

function normalizePlant(p) {
  const rawStatus = String(p.status ?? p.plantStatus ?? '-1');
  let status;
  if (rawStatus === '1')      status = 'OK';
  else if (rawStatus === '0') status = 'OFFLINE';
  else                        status = 'NO_COMMUNICATION';

  const power = parseFloat(p.peakPower || p.nominal_power || p.capacity || 0);

  return {
    id:           String(p.id || p.plantId || Math.random()),
    name:         p.plantName || p.name || 'Planta Growatt',
    status,
    manufacturer: 'Growatt',
    power:        power.toFixed(2),
    energyDay:    parseFloat(p.todayEnergy   || p.eDay   || 0).toFixed(2),
    energyMonth:  parseFloat(p.monthEnergy   || p.eMonth || 0).toFixed(2),
    energyTotal:  parseFloat(p.totalEnergy   || p.eTotal || 0).toFixed(2),
    current_power: parseFloat(p.currentPower || p.pac    || 0).toFixed(2),
    updated_at:   p.lastUpdateTime || new Date().toISOString(),
    created_at:   p.createTime     || new Date().toISOString(),
    alert:        status !== 'OK',
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
    if (debug) debugLog.push({ step: 'login', ok: true });

    // 1. Lista de plantas do usuário
    const plantList = await growattPost('/index/getPlantListTitle', cookie, {
      currPage: 1,
    });
    if (debug) debugLog.push({ step: 'plantList', response: plantList });

    let plants = plantList?.data || plantList?.plants || [];

    // 2. Se não veio pela rota acima, tenta outra
    if (!plants.length) {
      const alt = await growattGet('/selectPlant.do', cookie, { page: 1 });
      if (debug) debugLog.push({ step: 'selectPlant', response: alt });
      plants = alt?.data?.plants || alt?.plants || [];
    }

    // 3. Tenta rota de lista completa
    if (!plants.length) {
      const alt2 = await growattPost('/PlantListAPI.do', cookie, { currPage: 1 });
      if (debug) debugLog.push({ step: 'PlantListAPI', response: alt2 });
      plants = alt2?.data || alt2?.plants || [];
    }

    if (!plants.length) {
      return res.status(200).json({
        ok: false,
        error: 'Login OK mas nenhuma planta encontrada',
        ...(debug ? { debugLog } : {}),
      });
    }

    return res.status(200).json({
      ok: true,
      source: 'growatt',
      total: plants.length,
      data: plants.map(normalizePlant),
      ...(debug ? { debugLog } : {}),
    });

  } catch (err) {
    console.error('[Growatt]', err.message);
    return res.status(500).json({
      ok: false,
      error: err.message,
      ...(debug ? { debugLog } : {}),
    });
  }
};
