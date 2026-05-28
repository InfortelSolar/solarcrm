// ============================================================
//  SolarCRM — Proxy Growatt API v1 (server.pvbutler.com)
//  Token: GROWATT_TOKEN | Usuário: GROWATT_USER
// ============================================================

const SERVER = 'https://openapi.growatt.com';

function normalizePlant(p) {
  const rawStatus = String(p.status ?? '-1');
  let status;
  if (rawStatus === '1')       status = 'OK';
  else if (rawStatus === '0')  status = 'OFFLINE';
  else                         status = 'NO_COMMUNICATION';

  const power = parseFloat(p.peak_power || p.nominalPower || p.peakPower || 0);

  return {
    id:            String(p.plant_id || p.id || Math.random()),
    name:          p.name || p.plantName || 'Planta Growatt',
    status,
    manufacturer:  'Growatt',
    power:         power.toFixed(2),
    energyDay:     parseFloat(p.today_energy  || p.energyDay   || p.eDay   || 0).toFixed(2),
    energyMonth:   parseFloat(p.month_energy  || p.energyMonth || p.eMonth || 0).toFixed(2),
    energyTotal:   parseFloat(p.total_energy  || p.energyTotal || p.eTotal || 0).toFixed(2),
    current_power: parseFloat(p.current_power || p.power || 0).toFixed(2),
    updated_at:    p.last_update_time || p.lastUpdateTime || new Date().toISOString(),
    created_at:    p.create_date      || p.createDate     || new Date().toISOString(),
    alert:         status !== 'OK',
  };
}

async function fetchWithToken(url, token, params = {}, method = 'GET') {
  const headers = {
    'Content-Type': 'application/x-www-form-urlencoded',
    'token': token.trim(),
  };

  const allParams = { token: token.trim(), ...params };
  let fetchUrl = url;
  let body = undefined;

  if (method === 'GET') {
    fetchUrl = `${url}?${new URLSearchParams(allParams)}`;
  } else {
    body = new URLSearchParams(allParams).toString();
  }

  const res = await fetch(fetchUrl, {
    method, headers, body,
    signal: AbortSignal.timeout(20000),
  });

  const text = await res.text();
  try { return JSON.parse(text); }
  catch(e) { throw new Error(`Resposta não-JSON (${res.status}): ${text.slice(0, 150)}`); }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

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
    // ── Detalhes de uma planta específica ───────────────────
  if (req.query.plantId) {
    try {
      const plantId = req.query.plantId;
      const url = `${SERVER}/v1/plant/energy?plant_id=${plantId}&time_unit=day&date=${new Date().toISOString().slice(0,10)}`;
      const json = await fetchWithToken(url, token, {}, 'GET');
      return res.status(200).json({ ok: true, plantId, data: json });
    } catch(err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  return res.status(500).json({ ok: false, error: 'GROWATT_TOKEN não configurado' });
  }

  // ── Tentativa 1: GET /v1/plant/list ──────────────────────
  try {
    const url  = `${SERVER}/v1/plant/list`;
    const json = await fetchWithToken(url, token, { page: '1', perpage: '100' }, 'GET');
    if (debug) debugLog.push({ endpoint: '1-plant/list', response: json });

    if (json.error_code === 0) {
      const plants = json.data?.plants || json.data?.datas || [];
      if (plants.length > 0) {
        return res.status(200).json({
          ok: true, source: 'growatt',
          total: plants.length,
          data: plants.map(normalizePlant),
          ...(debug ? { debugLog } : {}),
        });
      }
    }

    // Rate limit — aguarda e tenta novamente
    if (json.error_code === 10012) {
      if (debug) debugLog.push({ note: 'Rate limit, aguardando 10s...' });
      await sleep(10000);
      const json2 = await fetchWithToken(url, token, { page: '1', perpage: '100' }, 'GET');
      if (debug) debugLog.push({ endpoint: '1-plant/list-retry', response: json2 });
      if (json2.error_code === 0) {
        const plants = json2.data?.plants || json2.data?.datas || [];
        if (plants.length > 0) {
          return res.status(200).json({
            ok: true, source: 'growatt',
            total: plants.length,
            data: plants.map(normalizePlant),
            ...(debug ? { debugLog } : {}),
          });
        }
      }
    }
  } catch(e) {
    if (debug) debugLog.push({ endpoint: '1-plant/list', error: e.message });
  }

  await sleep(2000);

  // ── Tentativa 2: POST /v1/plant/user_plant_list ───────────
  if (username) {
    try {
      const url  = `${SERVER}/v1/plant/user_plant_list`;
      const json = await fetchWithToken(url, token, {
        user_name: username, page: '1', perpage: '100',
      }, 'POST');
      if (debug) debugLog.push({ endpoint: '2-user_plant_list', response: json });

      if (json.error_code === 0) {
        const plants = json.data?.plants || json.data?.datas || [];
        if (plants.length > 0) {
          return res.status(200).json({
            ok: true, source: 'growatt',
            total: plants.length,
            data: plants.map(normalizePlant),
            ...(debug ? { debugLog } : {}),
          });
        }
      }
    } catch(e) {
      if (debug) debugLog.push({ endpoint: '2-user_plant_list', error: e.message });
    }
  }

  await sleep(2000);

  // ── Tentativa 3: GET /v1/user/c_user_list ────────────────
  try {
    const url  = `${SERVER}/v1/user/c_user_list`;
    const json = await fetchWithToken(url, token, { page: '1', perpage: '100' }, 'GET');
    if (debug) debugLog.push({ endpoint: '3-c_user_list', response: json });

    if (json.error_code === 0) {
      const users = json.data?.c_user || [];
      const allPlants = [];

      for (const u of users.slice(0, 20)) {
        await sleep(1000);
        try {
          const pJson = await fetchWithToken(`${SERVER}/v1/plant/list`, token, {
            C_user_id: u.c_user_id, page: '1', perpage: '50',
          }, 'GET');
          if (pJson.error_code === 0) {
            allPlants.push(...(pJson.data?.plants || []));
          }
        } catch(e) {}
      }

      if (allPlants.length > 0) {
        return res.status(200).json({
          ok: true, source: 'growatt',
          total: allPlants.length,
          data: allPlants.map(normalizePlant),
          ...(debug ? { debugLog } : {}),
        });
      }
    }
  } catch(e) {
    if (debug) debugLog.push({ endpoint: '3-c_user_list', error: e.message });
  }

  return res.status(500).json({
    ok: false,
    error: 'Nenhum endpoint retornou plantas',
    ...(debug ? { debugLog } : { tip: 'Use ?debug=1 para detalhes' }),
  });
};
