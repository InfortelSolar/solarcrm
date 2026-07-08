// ============================================================
//  SolarCRM — Proxy Growatt API v1 (server.pvbutler.com)
//  Token: GROWATT_TOKEN | Usuário: GROWATT_USER
// ============================================================

const SERVER        = 'https://openapi.growatt.com';
const PORTAL_SERVER  = 'https://oss.growatt.com';
const PORTAL_DATA    = 'https://server.growatt.com';

let _portalCache = { cookie: null, expiresAt: 0 };

async function getPortalCookie() {
  const now = Date.now();
  if (_portalCache.cookie && now < _portalCache.expiresAt) return _portalCache.cookie;

  const account  = (process.env.GROWATT_PORTAL_ACCOUNT || '').trim();
  const password = (process.env.GROWATT_PORTAL_PASS    || '').trim();
  if (!account || !password) throw new Error('GROWATT_PORTAL_ACCOUNT ou GROWATT_PORTAL_PASS não configurados');

  const now2 = new Date().toISOString().replace('T',' ').slice(0,19);
  const body = new URLSearchParams({
    userName: account, password, loginTime: now2,
    isReadPact: '0', changeNotice: '0', lang: 'en', type: '1', passwordCrc: '',
  });

  const res = await fetch(`${PORTAL_SERVER}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest' },
    body: body.toString(),
    redirect: 'manual',
    signal: AbortSignal.timeout(15000),
  });

  const text = await res.text();
  console.log('[Growatt Portal Login]', res.status, text.slice(0, 200));

  // Extrai cookies da resposta
  const setCookies = res.headers.getSetCookie?.() || [];
  const cookieStr  = setCookies.map(c => c.split(';')[0]).join('; ');
  if (!cookieStr) throw new Error(`Growatt portal login falhou — sem cookie. Status: ${res.status}. Body: ${text.slice(0,100)}`);

  // Verifica se o login foi bem sucedido
  try {
    const json = JSON.parse(text);
    if (json.result === -1 || json.result === 0) throw new Error(`Login rejeitado: ${JSON.stringify(json)}`);
  } catch(_) {}

  _portalCache = { cookie: cookieStr, expiresAt: now + 25 * 60 * 1000 };
  return cookieStr;
}

async function portalPost(path, params) {
  const cookie = await getPortalCookie();
  const body   = new URLSearchParams(params);
  const res    = await fetch(`${PORTAL_DATA}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type':     'application/x-www-form-urlencoded',
      'X-Requested-With': 'XMLHttpRequest',
      'Cookie':           cookie,
      'Referer':          `${PORTAL_SERVER}/index`,
    },
    body: body.toString(),
    signal: AbortSignal.timeout(15000),
  });
  const text = await res.text();
  try { return JSON.parse(text); }
  catch(e) { throw new Error(`Portal ${path} retornou HTML (${res.status}): ${text.slice(0,200)}`); }
}

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
    energyDay:     parseFloat(p.today_energy   || p.energyDay   || p.eDay   || 0).toFixed(2),
    energyMonth:   parseFloat(p.monthly_energy || p.month_energy || p.energyMonth || p.eMonth || 0).toFixed(2),
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
    return res.status(500).json({ ok: false, error: 'GROWATT_TOKEN não configurado' });
  }

  // ── Teste de energia de uma planta específica ────────────
  if (req.query.testEnergy) {
    try {
      const pid = req.query.testEnergy;
      const r   = await fetchWithToken(`${SERVER}/v1/plant/data`, token, { plant_id: pid }, 'GET');
      return res.status(200).json({ ok: true, pid, result: r });
    } catch(err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  // ── Histórico mensal via portal ──────────────────────────
  if (req.query.portalHistory) {
    try {
      const { plantId, month } = req.query;
      if (!plantId || !month) return res.status(400).json({ ok: false, error: 'plantId e month obrigatórios' });
      const json = await portalPost('/panel/max/getMAXMonthChart', { date: month, plantId });
      const energy = json?.obj?.energy || [];
      return res.status(200).json({ ok: true, month, energy });
    } catch(err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  // ── Tentativa 1: GET /v1/plant/list ──────────────────────
  try {
    const url  = `${SERVER}/v1/plant/list`;
    const json = await fetchWithToken(url, token, { page: '1', perpage: '100' }, 'GET');
    if (debug) debugLog.push({ endpoint: '1-plant/list', response: json });

    if (json.error_code === 0) {
      const plants = json.data?.plants || json.data?.datas || [];
      if (plants.length > 0) {
        // Busca energia via /v1/plant/data em paralelo
        const energyData = await Promise.all(
          plants.map(async (p) => {
            const pid = String(p.plant_id || p.id);
            try {
              const d = await fetchWithToken(
                `${SERVER}/v1/plant/data`,
                token, { plant_id: pid }, 'GET'
              );
              if (debug) debugLog.push({ endpoint: `data-${pid}`, response: d?.data });
              return {
                plant_id:     pid,
                today_energy: d?.data?.today_energy   ?? 0,
                month_energy: d?.data?.monthly_energy ?? 0,
              };
            } catch(_) { return { plant_id: pid, today_energy: 0, month_energy: 0 }; }
          })
        );

        const energyMap = {};
        energyData.forEach(d => { energyMap[d.plant_id] = d; });

        const normalized = plants.map(p => {
          const pid = String(p.plant_id || p.id);
          const en = energyMap[pid] || {};
          return normalizePlant({ ...p, today_energy: en.today_energy, monthly_energy: en.month_energy });
        });

        return res.status(200).json({
          ok: true, source: 'growatt',
          total: normalized.length,
          data: normalized,
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
