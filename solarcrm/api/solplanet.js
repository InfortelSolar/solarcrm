// ============================================================
//  SolarCRM — Proxy Solplanet/AISWEI API (Vercel Serverless)
//  Autenticação: APP_KEY + APP_SECRET + HMAC-SHA1
// ============================================================

const crypto = require('crypto');

const BASE_URL = 'https://cloud.solplanet.net';

// Gera assinatura HMAC-SHA1
function sign(appSecret, params) {
  const sorted = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&');
  return crypto.createHmac('sha1', appSecret).update(sorted).digest('hex');
}

// Requisição autenticada
async function request(appKey, appSecret, path, params = {}) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const allParams = {
    appKey,
    timestamp,
    ...params,
  };
  allParams.sign = sign(appSecret, allParams);

  const qs  = new URLSearchParams(allParams).toString();
  const url = `${BASE_URL}${path}?${qs}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(10000),
  });

  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch(e) {
    throw new Error(`Resposta não-JSON (${res.status}): ${text.slice(0, 150)}`);
  }
}

function normalizePlant(p) {
  const status = p.status === 1 ? 'OK' : p.status === 2 ? 'ALARMING' : 'OFFLINE';
  const power  = parseFloat(p.peakPower || p.capacity || p.power || 0);

  return {
    id:          String(p.plantId || p.id || Math.random()),
    name:        p.plantName || p.name || 'Planta Solplanet',
    status,
    manufacturer:'Solplanet',
    power:       power.toFixed(2),
    energyDay:   parseFloat(p.todayEnergy  || p.eDay   || 0).toFixed(2),
    energyMonth: parseFloat(p.monthEnergy  || p.eMonth || 0).toFixed(2),
    energyTotal: parseFloat(p.totalEnergy  || p.eTotal || 0).toFixed(2),
    updated_at:  p.lastUpdateTime || new Date().toISOString(),
    created_at:  p.createTime     || new Date().toISOString(),
    alert:       status !== 'OK',
  };
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const appKey    = process.env.SOLPLANET_APP_KEY;
  const appSecret = process.env.SOLPLANET_APP_SECRET;
  const debug     = req.query.debug === '1';
  const debugLog  = [];

  if (!appKey || !appSecret) {
    return res.status(500).json({
      ok: false,
      error: 'Credenciais não configuradas (SOLPLANET_APP_KEY / SOLPLANET_APP_SECRET)',
    });
  }

  // Endpoints conhecidos da API Solplanet/AISWEI
  const plantEndpoints = [
    '/api/plant/list',
    '/api/v1/plant/list',
    '/openapi/plant/list',
    '/openapi/v1/plant/list',
  ];

  for (const path of plantEndpoints) {
    try {
      const json = await request(appKey, appSecret, path, { page: '1', size: '100' });

      if (debug) debugLog.push({ path, response: JSON.stringify(json).slice(0, 300) });

      if (json.errorCode === '0' || json.error_code === 0 || json.success === true) {
        const plants =
          json.data?.list    ||
          json.data?.plants  ||
          json.data?.records ||
          (Array.isArray(json.data) ? json.data : null) ||
          [];

        if (plants.length > 0) {
          return res.status(200).json({
            ok: true, source: 'solplanet',
            endpoint: `${BASE_URL}${path}`,
            total: plants.length,
            data: plants.map(normalizePlant),
            ...(debug ? { debugLog } : {}),
          });
        }
      }
    } catch(e) {
      if (debug) debugLog.push({ path, error: e.message });
    }
  }

  return res.status(500).json({
    ok: false,
    error: 'Nenhum endpoint retornou plantas',
    ...(debug ? { debugLog } : { tip: 'Use ?debug=1 para ver detalhes' }),
  });
};
