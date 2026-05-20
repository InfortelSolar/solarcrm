// ============================================================
//  SolarCRM — Proxy Growatt / PvButler API (Vercel Serverless)
//  v4 — Inclui server.pvbutler.com conforme painel OSS
// ============================================================

const ENDPOINTS = [
  'https://server.pvbutler.com',   // ← servidor correto do painel
  'https://server.growatt.com',
  'https://openapi.growatt.com',
  'https://oss.growatt.com',
];

const PLANT_PATHS = [
  '/PlantListAPI.do',
  '/index/getPlantListTitle',
  '/newTwoPlant/getPlantList',
  '/plant/user/getAllPlantByToken',
  '/v1/plant/list',
];

function normalizePlant(p) {
  const statusMap = { '1': 'OK', '0': 'NO_COMMUNICATION', '2': 'OFFLINE', '3': 'ALARMING' };
  const rawStatus = String(p.status ?? p.plantStatus ?? '2');
  const status    = statusMap[rawStatus] || 'OFFLINE';
  const power     = parseFloat(p.nominalPower || p.peakPower || p.capacity || p.power || 0);

  return {
    id:          String(p.id || p.plantId || p.plant_id || Math.random()),
    name:        p.plantName || p.name || 'Planta Growatt',
    status,
    manufacturer:'Growatt',
    power:       power.toFixed(2),
    energyDay:   parseFloat(p.todayEnergy || p.eDay   || p.pac   || 0).toFixed(2),
    energyMonth: parseFloat(p.monthEnergy || p.eMonth || 0).toFixed(2),
    energyTotal: parseFloat(p.totalEnergy || p.eTotal || 0).toFixed(2),
    updated_at:  p.lastUpdateTime || p.updateTime || new Date().toISOString(),
    created_at:  p.createTime     || p.createDate || new Date().toISOString(),
    alert:       status !== 'OK',
  };
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const token    = process.env.GROWATT_TOKEN;
  const username = process.env.GROWATT_USER;
  const debug    = req.query.debug === '1';
  const debugLog = [];

  if (!token) {
    return res.status(500).json({ ok: false, error: 'GROWATT_TOKEN não configurado' });
  }

  for (const baseUrl of ENDPOINTS) {
    for (const path of PLANT_PATHS) {
      try {
        const url  = `${baseUrl}${path}`;
        const body = new URLSearchParams({
          token,
          currPage: '1',
          ...(username ? { userId: username } : {}),
        });

        const r = await fetch(url, {
          method:  'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'token': token,
          },
          body: body.toString(),
          signal: AbortSignal.timeout(8000),
        });

        const text = await r.text();
        const snippet = text.slice(0, 300);

        let json;
        try { json = JSON.parse(text); } catch(e) {
          if (debug) debugLog.push({ url, httpStatus: r.status, response: snippet, error: 'não-JSON' });
          continue;
        }

        if (debug) debugLog.push({ url, httpStatus: r.status, response: snippet });

        const plants =
          json.data?.datas      ||
          json.data?.plantList  ||
          json.data?.list       ||
          json.back?.data       ||
          json.result?.data     ||
          json.obj?.datas       ||
          json.obj?.plantList   ||
          (Array.isArray(json.data)   ? json.data   : null) ||
          (Array.isArray(json.result) ? json.result : null) ||
          [];

        if (plants.length > 0) {
          const data = plants.map(normalizePlant);
          return res.status(200).json({
            ok: true, source: 'growatt',
            endpoint: url, total: data.length,
            data,
            ...(debug ? { debugLog } : {}),
          });
        }

        // Resposta válida mas sem plantas
        if (json.result === 1 || json.success === true) {
          if (debug) debugLog.push({ url, note: 'Login OK mas sem plantas' });
          return res.status(200).json({
            ok: true, source: 'growatt',
            endpoint: url, total: 0, data: [],
            ...(debug ? { debugLog } : {}),
          });
        }

      } catch(e) {
        if (debug) debugLog.push({ url: `${baseUrl}${path}`, error: e.message });
      }
    }
  }

  return res.status(500).json({
    ok: false,
    error: 'Nenhum endpoint retornou plantas',
    hint: 'Verifique se o token está vinculado às plantas no painel OSS',
    ...(debug ? { debugLog } : { tip: 'Use ?debug=1 para ver detalhes' }),
  });
};
