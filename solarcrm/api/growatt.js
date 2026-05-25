// ============================================================
//  SolarCRM — Proxy Growatt API v1 (server.growatt.com)
//  Autenticação: token fixo no header
//  Documentação: Growatt Server API Guide v1.0.1
// ============================================================

const BASE = 'https://openapi.growatt.com/v1';

async function growattGet(path, token, params = {}) {
  const qs = new URLSearchParams(params).toString();
  const url = `${BASE}${path}${qs ? '?' + qs : ''}`;
  const res = await fetch(url, {
    headers: { token: token.trim() },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`GET ${path} → HTTP ${res.status}`);
  const text = await res.text();
  try { return JSON.parse(text); }
  catch(e) { throw new Error(`Resposta não-JSON (${res.status}): ${text.slice(0,150)}`); }
}

async function growattPost(path, token, params = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      token: token.trim(),
    },
    body: new URLSearchParams({ token: token.trim(), ...params }).toString(),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`POST ${path} → HTTP ${res.status}`);
  const text = await res.text();
  try { return JSON.parse(text); }
  catch(e) { throw new Error(`Resposta não-JSON (${res.status}): ${text.slice(0,150)}`); }
}

function normalizePlant(p) {
  const rawStatus = String(p.status ?? p.plantStatus ?? '-1');
  let status;
  if (rawStatus === '1')      status = 'OK';
  else if (rawStatus === '0') status = 'OFFLINE';
  else                        status = 'NO_COMMUNICATION';

  const power = parseFloat(p.peak_power || p.peakPower || p.nominalPower || p.capacity || 0);

  return {
    id:            String(p.plant_id || p.id || Math.random()),
    name:          p.name || p.plantName || 'Planta Growatt',
    status,
    manufacturer:  'Growatt',
    power:         power.toFixed(2),
    energyDay:     parseFloat(p.today_energy  || p.eDay    || p.energyDay   || 0).toFixed(2),
    energyMonth:   parseFloat(p.month_energy  || p.eMonth  || p.energyMonth || 0).toFixed(2),
    energyTotal:   parseFloat(p.total_energy  || p.eTotal  || p.energyTotal || 0).toFixed(2),
    current_power: parseFloat(p.current_power || p.pac     || p.power       || 0).toFixed(2),
    updated_at:    p.last_update_time || p.lastUpdateTime || new Date().toISOString(),
    created_at:    p.create_date      || p.createDate     || new Date().toISOString(),
    alert:         status !== 'OK',
  };
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
    return res.status(500).json({ ok: false, error: 'GROWATT_TOKEN não configurado' });
  }

  // ── Tentativa 1: GET /plant/list (todas as plantas do integrador)
  try {
    const json = await growattGet('/plant/list', token, { page: 1, perpage: 100 });
    if (debug) debugLog.push({ endpoint: '1-GET /plant/list', response: json });

    if (json.error_code === 0) {
      const plants = json.data?.plants || [];
      if (plants.length > 0) {
        // Busca dados de energia de cada planta
        const enriched = await Promise.all(plants.map(async (p, i) => {
          await sleep(i * 200); // evita rate limit
          try {
            const data = await growattGet('/plant/data', token, { plant_id: p.plant_id || p.id });
            if (data.error_code === 0 && data.data) {
              return { ...p, ...data.data };
            }
          } catch(_) {}
          return p;
        }));

        return res.status(200).json({
          ok: true, source: 'growatt',
          total: enriched.length,
          data: enriched.map(normalizePlant),
          ...(debug ? { debugLog } : {}),
        });
      }
    }
  } catch(e) {
    if (debug) debugLog.push({ endpoint: '1-GET /plant/list', error: e.message });
  }

  await sleep(1000);

  // ── Tentativa 2: POST /plant/user_plant_list (plantas de um usuário)
  if (username) {
    try {
      const json = await growattPost('/plant/user_plant_list', token, {
        user_name: username, page: 1, perpage: 100,
      });
      if (debug) debugLog.push({ endpoint: '2-POST /plant/user_plant_list', response: json });

      if (json.error_code === 0) {
        const plants = json.data?.plants || [];
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
      if (debug) debugLog.push({ endpoint: '2-POST /plant/user_plant_list', error: e.message });
    }
  }

  await sleep(1000);

  // ── Tentativa 3: GET /user/c_user_list → plantas de sub-usuários
  try {
    const json = await growattGet('/user/c_user_list', token, { page: 1, perpage: 100 });
    if (debug) debugLog.push({ endpoint: '3-GET /user/c_user_list', response: json });

    if (json.error_code === 0) {
      const users = json.data?.c_user || [];
      const allPlants = [];

      for (const u of users.slice(0, 20)) {
        await sleep(300);
        try {
          const pJson = await growattGet('/plant/list', token, {
            C_user_id: u.c_user_id, page: 1, perpage: 50,
          });
          if (pJson.error_code === 0) {
            allPlants.push(...(pJson.data?.plants || []));
          }
        } catch(_) {}
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
    if (debug) debugLog.push({ endpoint: '3-GET /user/c_user_list', error: e.message });
  }

  return res.status(500).json({
    ok: false,
    error: 'Nenhum endpoint retornou plantas',
    ...(debug ? { debugLog } : { tip: 'Use ?debug=1 para detalhes' }),
  });
};
