// ============================================================
//  SolarCRM — Proxy Growatt API v1 (Vercel Serverless)
//  Baseado na documentação oficial Growatt Server API Guide
//  Endpoints: server.growatt.com/v1/ e server.pvbutler.com/v1/
// ============================================================

const SERVERS = [
  'https://server.pvbutler.com',
  'https://server.growatt.com',
  'https://openapi.growatt.com',
];

function normalizePlant(p) {
  // Status: 1=Online, 0=Offline, -1=Lost
  const rawStatus = String(p.status ?? '-1');
  let status;
  if (rawStatus === '1')       status = 'OK';
  else if (rawStatus === '0')  status = 'OFFLINE';
  else if (rawStatus === '-1') status = 'NO_COMMUNICATION';
  else                         status = 'OFFLINE';

  const power = parseFloat(p.peak_power || p.nominalPower || p.peakPower || 0);

  return {
    id:          String(p.plant_id || p.id || Math.random()),
    name:        p.name || p.plantName || 'Planta Growatt',
    status,
    manufacturer:'Growatt',
    power:       power.toFixed(2),
    energyDay:   parseFloat(p.today_energy || p.energyDay   || p.eDay   || 0).toFixed(2),
    energyMonth: parseFloat(p.month_energy || p.energyMonth || p.eMonth || 0).toFixed(2),
    energyTotal: parseFloat(p.total_energy || p.energyTotal || p.eTotal || 0).toFixed(2),
    current_power: parseFloat(p.current_power || p.power || 0).toFixed(2),
    updated_at:  p.last_update_time || p.lastUpdateTime || new Date().toISOString(),
    created_at:  p.create_date      || p.createDate     || new Date().toISOString(),
    alert:       status !== 'OK',
  };
}

async function fetchWithToken(url, token, params = {}, method = 'GET') {
  const headers = {
    'Content-Type': 'application/x-www-form-urlencoded',
    'token': token.trim(),
  };

  let fetchUrl = url;
  let body = undefined;

  const allParams = { token: token.trim(), ...params };

  if (method === 'GET') {
    const qs = new URLSearchParams(allParams).toString();
    fetchUrl = `${url}?${qs}`;
  } else {
    body = new URLSearchParams(allParams).toString();
  }

  const res = await fetch(fetchUrl, {
    method,
    headers,
    body,
    signal: AbortSignal.timeout(10000),
  });

  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch(e) {
    throw new Error(`Resposta não-JSON (${res.status}): ${text.slice(0, 150)}`);
  }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const token    = (process.env.GROWATT_TOKEN || '').trim();
  const username = (process.env.GROWATT_USER  || '').trim();
  const debug    = req.query.debug === '1';
  const debugLog = [];

  if (!token) {
    return res.status(500).json({ ok: false, error: 'GROWATT_TOKEN não configurado' });
  }

  for (const server of SERVERS) {
    // ── Tentativa 1: GET /v1/plant/list (lista todas as plantas do instalador)
    try {
      const url  = `${server}/v1/plant/list`;
      const json = await fetchWithToken(url, token, { page: '1', perpage: '100' }, 'GET');

      if (debug) debugLog.push({ url, response: JSON.stringify(json).slice(0, 300) });

      if (json.error_code === 0) {
        const plants = json.data?.plants || json.data?.datas || [];
        if (plants.length > 0) {
          return res.status(200).json({
            ok: true, source: 'growatt', endpoint: url,
            total: plants.length,
            data: plants.map(normalizePlant),
            ...(debug ? { debugLog } : {}),
          });
        }
      }
    } catch(e) {
      if (debug) debugLog.push({ url: `${server}/v1/plant/list`, error: e.message });
    }

    // ── Tentativa 2: POST /v1/plant/user_plant_list (plantas por usuário)
    if (username) {
      try {
        const url  = `${server}/v1/plant/user_plant_list`;
        const json = await fetchWithToken(url, token, {
          user_name: username, page: '1', perpage: '100',
        }, 'POST');

        if (debug) debugLog.push({ url, response: JSON.stringify(json).slice(0, 300) });

        if (json.error_code === 0) {
          const plants = json.data?.plants || json.data?.datas || [];
          if (plants.length > 0) {
            return res.status(200).json({
              ok: true, source: 'growatt', endpoint: url,
              total: plants.length,
              data: plants.map(normalizePlant),
              ...(debug ? { debugLog } : {}),
            });
          }
        }
      } catch(e) {
        if (debug) debugLog.push({ url: `${server}/v1/plant/user_plant_list`, error: e.message });
      }
    }

    // ── Tentativa 3: GET /v1/user/c_user_list → depois plantas de cada usuário
    try {
      const url  = `${server}/v1/user/c_user_list`;
      const json = await fetchWithToken(url, token, { page: '1', perpage: '100' }, 'GET');

      if (debug) debugLog.push({ url, response: JSON.stringify(json).slice(0, 300) });

      if (json.error_code === 0) {
        const users  = json.data?.c_user || [];
        const allPlants = [];

        for (const u of users.slice(0, 20)) {
          try {
            const pUrl = `${server}/v1/plant/list`;
            const pJson = await fetchWithToken(pUrl, token, {
              C_user_id: u.c_user_id, page: '1', perpage: '50',
            }, 'GET');
            if (pJson.error_code === 0) {
              const plants = pJson.data?.plants || [];
              allPlants.push(...plants);
            }
          } catch(e) {}
        }

        if (allPlants.length > 0) {
          return res.status(200).json({
            ok: true, source: 'growatt', endpoint: url,
            total: allPlants.length,
            data: allPlants.map(normalizePlant),
            ...(debug ? { debugLog } : {}),
          });
        }
      }
    } catch(e) {
      if (debug) debugLog.push({ url: `${server}/v1/user/c_user_list`, error: e.message });
    }
  }

  return res.status(500).json({
    ok: false,
    error: 'Nenhum endpoint retornou plantas',
    ...(debug ? { debugLog } : { tip: 'Use ?debug=1 para ver detalhes' }),
  });
};
