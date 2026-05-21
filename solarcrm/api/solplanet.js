// ============================================================
//  SolarCRM — Proxy Solplanet/AISWEI API (Vercel Serverless)
//  Base URL: pro-cloud.solplanet.net
//  Auth: APP_KEY + APP_SECRET (HMAC-SHA256) + TOKEN
// ============================================================

const crypto = require('crypto');

const BASE_URLS = [
  'https://pro-cloud.solplanet.net',
  'https://cloud.solplanet.net',
];

// Gera assinatura HMAC-SHA256
function sign(appSecret, params) {
  const sorted = Object.keys(params).sort()
    .map(k => `${k}=${params[k]}`)
    .join('&');
  return crypto.createHmac('sha256', appSecret).update(sorted).digest('hex');
}

// Também tenta HMAC-SHA1
function signSHA1(appSecret, params) {
  const sorted = Object.keys(params).sort()
    .map(k => `${k}=${params[k]}`)
    .join('&');
  return crypto.createHmac('sha1', appSecret).update(sorted).digest('hex');
}

async function apiRequest(baseUrl, path, appKey, appSecret, token, extraParams = {}) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce     = Math.random().toString(36).slice(2, 10);

  const params = {
    appKey,
    timestamp,
    nonce,
    ...extraParams,
  };

  // Tenta SHA256 primeiro
  params.sign = sign(appSecret, params);

  const headers = {
    'Content-Type': 'application/json',
    'appKey':       appKey,
    'timestamp':    timestamp,
    'nonce':        nonce,
    'sign':         params.sign,
  };
  if (token) headers['token'] = token;

  const qs  = new URLSearchParams(extraParams).toString();
  const url = `${baseUrl}${path}${qs ? '?' + qs : ''}`;

  const res = await fetch(url, {
    method:  'GET',
    headers,
    signal: AbortSignal.timeout(10000),
  });

  const text = await res.text();
  try {
    return { json: JSON.parse(text), url };
  } catch(e) {
    return { error: `Resposta não-JSON (${res.status}): ${text.slice(0, 150)}`, url };
  }
}

function normalizePlant(p) {
  const rawStatus = p.status ?? p.plantStatus ?? 0;
  const status = rawStatus === 1 ? 'OK' : rawStatus === 2 ? 'ALARMING' : 'OFFLINE';
  const power  = parseFloat(p.peakPower || p.capacity || p.installedCapacity || p.power || 0);

  return {
    id:          String(p.plantId || p.psno || p.id || Math.random()),
    name:        p.plantName || p.psname || p.name || 'Planta Solplanet',
    status,
    manufacturer:'Solplanet',
    power:       power.toFixed(2),
    energyDay:   parseFloat(p.todayEnergy  || p.etoday || p.eDay   || 0).toFixed(2),
    energyMonth: parseFloat(p.monthEnergy  || p.eMonth || 0).toFixed(2),
    energyTotal: parseFloat(p.totalEnergy  || p.etotal || p.eTotal || 0).toFixed(2),
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

  const appKey    = (process.env.SOLPLANET_APP_KEY    || '').trim();
  const appSecret = (process.env.SOLPLANET_APP_SECRET || '').trim();
  const token     = (process.env.SOLPLANET_TOKEN      || '').trim();
  const debug     = req.query.debug === '1';
  const debugLog  = [];

  if (!appKey || !appSecret) {
    return res.status(500).json({
      ok: false,
      error: 'Credenciais não configuradas (SOLPLANET_APP_KEY / SOLPLANET_APP_SECRET)',
    });
  }

  const plantPaths = [
    '/api/plant/list',
    '/api/v1/plant/list',
    '/api/pro/plant/list',
    '/api/installer/plant/list',
    '/v1/plant/list',
    '/plant/list',
  ];

  for (const baseUrl of BASE_URLS) {
    for (const path of plantPaths) {
      try {
        const { json, url, error } = await apiRequest(
          baseUrl, path, appKey, appSecret, token,
          { page: '1', size: '100', pageSize: '100' }
        );

        if (error) {
          if (debug) debugLog.push({ url, error });
          continue;
        }

        if (debug) debugLog.push({ url, response: JSON.stringify(json).slice(0, 300) });

        if (json.errorCode === '0' || json.error_code === 0 || json.success === true || json.code === 0) {
          const plants =
            json.data?.list     ||
            json.data?.plants   ||
            json.data?.records  ||
            json.data?.plantList||
            (Array.isArray(json.data) ? json.data : null) ||
            [];

          if (plants.length > 0) {
            return res.status(200).json({
              ok: true, source: 'solplanet',
              endpoint: url, total: plants.length,
              data: plants.map(normalizePlant),
              ...(debug ? { debugLog } : {}),
            });
          }

          // Resposta OK mas sem plantas
          if (json.errorCode === '0' || json.success === true) {
            return res.status(200).json({
              ok: true, source: 'solplanet',
              endpoint: url, total: 0, data: [],
              note: 'API respondeu OK mas sem plantas',
              ...(debug ? { debugLog } : {}),
            });
          }
        }
      } catch(e) {
        if (debug) debugLog.push({ url: `${baseUrl}${path}`, error: e.message });
      }
    }
  }

  return res.status(500).json({
    ok: false,
    error: 'Nenhum endpoint retornou plantas',
    ...(debug ? { debugLog } : { tip: 'Use ?debug=1 para ver detalhes' }),
  });
};
