// ============================================================
//  SolarCRM — Proxy SOLARMAN Pro API v1
//  api/sofar.js
//  Vars: SOFAR_APP_ID, SOFAR_APP_SECRET, SOFAR_EMAIL, SOFAR_PASSWORD
// ============================================================

import crypto from 'crypto';

const BASE = 'https://globalpro.solarmanpv.com';

let _tokenCache = { token: null, expiresAt: 0 };

function sha256(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

async function getToken() {
  const now = Date.now();
  if (_tokenCache.token && now < _tokenCache.expiresAt) return _tokenCache.token;

  const appId    = (process.env.SOFAR_APP_ID || '').trim();
  const appSecret = (process.env.SOFAR_APP_SECRET || '').trim();
  const email    = (process.env.SOFAR_EMAIL || '').trim();
  const password = (process.env.SOFAR_PASSWORD || '').trim();

  const res = await fetch(`${BASE}/account/v1.0/token?appId=${appId}&language=en`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      appSecret,
      email,
      password: sha256(password),
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) throw new Error(`SOLARMAN auth HTTP ${res.status}: ${await res.text()}`);
  const json = await res.json();

  const token = json.access_token || json.data?.access_token;
  if (!token) throw new Error(`SOLARMAN auth falhou: ${JSON.stringify(json)}`);

  // Token válido por 2 meses — cache por 55 dias
  _tokenCache = { token, expiresAt: now + 55 * 24 * 60 * 60 * 1000 };
  return token;
}

async function solarmanPost(path, token, body = {}) {
  const appId = (process.env.SOFAR_APP_ID || '').trim();
  const res = await fetch(`${BASE}${path}?appId=${appId}&language=en`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) throw new Error(`SOLARMAN ${path} HTTP ${res.status}`);
  return res.json();
}

function normalizePlant(station, realtime) {
  const rt = realtime?.data || realtime || {};

  // status: 1=normal, 2=alarm, 3=offline
  const stateMap = { 1: 'OK', 2: 'ALARMING', 3: 'OFFLINE', 4: 'OFFLINE' };
  const status = stateMap[station.stationState || station.status] || 'OFFLINE';

  return {
    id:            String(station.id || station.stationId),
    name:          station.name || station.stationName || 'Planta SOLARMAN',
    status,
    manufacturer:  'Sofar',
    power:         parseFloat(station.installedCapacity || station.capacity || 0).toFixed(2),
    energyDay:     parseFloat(rt.generationValue   || rt.todayEnergy   || 0).toFixed(2),
    energyMonth:   parseFloat(rt.monthGenerationValue || rt.monthEnergy || 0).toFixed(2),
    energyTotal:   parseFloat(rt.totalGenerationValue || rt.totalEnergy || station.generationValue || 0).toFixed(2),
    current_power: parseFloat(rt.generationPower   || rt.currentPower  || 0).toFixed(2),
    updated_at:    new Date().toISOString(),
    created_at:    station.createdDate || new Date().toISOString(),
    alert:         status !== 'OK',
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const debug = req.query.debug === '1';
  const debugLog = [];

  try {
    const token = await getToken();
    if (debug) debugLog.push({ step: 'auth', ok: true });

    // Lista todas as plantas com paginação
    let page = 1;
    const allStations = [];

    while (true) {
      const json = await solarmanPost('/station/v1.0/list', token, {
        page, size: 100,
      });

      if (debug) debugLog.push({ step: `page-${page}`, response: json });

      const stations = json.stationList || json.data?.stationList || json.list || [];
      allStations.push(...stations);

      const total = json.total || json.data?.total || stations.length;
      if (allStations.length >= total || stations.length === 0) break;
      page++;
    }

    if (debug && allStations.length > 0) {
      debugLog.push({ step: 'sample', station: allStations[0] });
      return res.status(200).json({ ok: true, total: allStations.length, debugLog });
    }

    // Busca dados em tempo real para cada planta em paralelo
    const plants = await Promise.all(
      allStations.map(async (station) => {
        try {
          const rt = await solarmanPost('/station/v1.0/realTime/get', token, {
            stationId: station.id || station.stationId,
          });
          return normalizePlant(station, rt.data || rt);
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
    });

  } catch (err) {
    console.error('[SOLARMAN]', err.message);
    return res.status(500).json({
      ok: false, error: err.message,
      ...(debug ? { debugLog } : { tip: 'Use ?debug=1 para detalhes' }),
    });
  }
}
