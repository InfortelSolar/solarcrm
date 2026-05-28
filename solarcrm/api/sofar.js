// ============================================================
//  SolarCRM — Proxy SofarCloud Open API v2
//  api/sofar.js
//  Vars: SOFAR_APP_ID, SOFAR_APP_SECRET, SOFAR_EMAIL, SOFAR_PASSWORD
// ============================================================

const BASE = 'https://eu.sofarcloud.com/api/openapi';

let _tokenCache = { token: null, expiresAt: 0 };

async function getToken() {
  const now = Date.now();
  if (_tokenCache.token && now < _tokenCache.expiresAt) return _tokenCache.token;

  const res = await fetch(`${BASE}/account/v2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      appId:       process.env.SOFAR_APP_ID,
      appSecret:   process.env.SOFAR_APP_SECRET,
      accountName: process.env.SOFAR_EMAIL,
      accountType: 3, // 3 = email
      password:    process.env.SOFAR_PASSWORD,
    }),
  });

  if (!res.ok) throw new Error(`Sofar auth HTTP ${res.status}`);
  const json = await res.json();
  if (json.code !== '200' && json.code !== 200)
    throw new Error(`Sofar auth falhou: ${json.message}`);

  const token = json.data?.token;
  if (!token) throw new Error('Sofar: token não retornado');

  // Token válido por 30 dias — cache por 29 dias
  _tokenCache = { token, expiresAt: now + 29 * 24 * 60 * 60 * 1000 };
  return token;
}

async function sofarPost(path, token, body = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) throw new Error(`Sofar ${path} HTTP ${res.status}`);
  const json = await res.json();
  if (json.code !== '200' && json.code !== 200)
    throw new Error(`Sofar ${path} erro: ${json.message}`);
  return json;
}

function normalizePlant(station, realtime) {
  const rt = realtime?.data || {};

  // status: stationState 1=normal, 2=alarm, 3=offline, 4=no_data
  const stateMap = { 1: 'OK', 2: 'ALARMING', 3: 'OFFLINE', 4: 'OFFLINE' };
  const status = stateMap[station.stationState] || 'OFFLINE';

  return {
    id:            String(station.id),
    name:          station.stationName || station.name || 'Planta Sofar',
    status,
    manufacturer:  'Sofar',
    power:         parseFloat(station.installCapacity || 0).toFixed(2),
    energyDay:     parseFloat(rt.generationValue   || 0).toFixed(2),
    energyMonth:   parseFloat(rt.monthGenerationValue || 0).toFixed(2),
    energyTotal:   parseFloat(rt.totalGenerationValue || 0).toFixed(2),
    current_power: parseFloat(rt.generationPower   || 0).toFixed(2),
    updated_at:    new Date().toISOString(),
    created_at:    station.createDate || new Date().toISOString(),
    alert:         status !== 'OK',
  };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const debug = req.query.debug === '1';
  const debugLog = [];

  try {
    const token = await getToken();
    if (debug) debugLog.push({ step: 'auth', ok: true });

    // Lista todas as estações com paginação
    let page = 1;
    const allStations = [];

    while (true) {
      const json = await sofarPost('/station/v2/page', token, {
        pageable: { pageNo: page, pageSize: 100 },
      });

      const stations = json.data?.records || json.data?.content || [];
      allStations.push(...stations);

      const total = json.data?.total || json.data?.totalElements || stations.length;
      if (debug) debugLog.push({ step: `page-${page}`, count: stations.length, total });

      if (allStations.length >= total || stations.length === 0) break;
      page++;
    }

    if (debug && allStations.length > 0) {
      debugLog.push({ step: 'sample', station: allStations[0] });
    }

    // Busca dados em tempo real para cada estação em paralelo
    const plants = await Promise.all(
      allStations.map(async (station) => {
        try {
          const rt = await sofarPost('/station/v2/realTime', token, {
            stationId: station.id,
          });
          return normalizePlant(station, rt);
        } catch(_) {
          return normalizePlant(station, null);
        }
      })
    );

    return res.status(200).json({
      ok:     true,
      source: 'sofar',
      total:  plants.length,
      data:   plants,
      ...(debug ? { debugLog } : {}),
    });

  } catch (err) {
    console.error('[Sofar]', err.message);
    return res.status(500).json({
      ok: false, error: err.message,
      ...(debug ? { debugLog } : { tip: 'Use ?debug=1 para detalhes' }),
    });
  }
};
