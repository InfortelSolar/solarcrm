// ============================================================
//  SolarCRM — Proxy Solis Cloud API (Vercel Serverless)
//  api/gdash.js
// ============================================================
import crypto from 'crypto';

const SOLIS_BASE    = 'https://www.soliscloud.com:13333';
const SOLIS_KEY_ID  = process.env.SOLIS_KEY_ID;
const SOLIS_SECRET  = process.env.SOLIS_KEY_SECRET;

function solisSign(keySecret, method, contentMd5, contentType, date, path) {
  const str = [method, contentMd5, contentType, date, path].join('\n');
  return crypto.createHmac('sha1', keySecret).update(str).digest('base64');
}

async function solisRequest(path, body = {}) {
  const method      = 'POST';
  const contentType = 'application/json';
  const date        = new Date().toUTCString();
  const bodyStr     = JSON.stringify(body);
  const contentMd5  = crypto.createHash('md5').update(bodyStr).digest('base64');
  const sign        = solisSign(SOLIS_SECRET, method, contentMd5, contentType, date, path);
  const auth        = `API ${SOLIS_KEY_ID}:${sign}`;

  const res = await fetch(`${SOLIS_BASE}${path}`, {
    method,
    headers: {
      'Content-Type':  contentType,
      'Content-MD5':   contentMd5,
      'Date':          date,
      'Authorization': auth,
    },
    body: bodyStr,
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) throw new Error(`Solis HTTP ${res.status}`);
  return res.json();
}

function normalizeSolisPlant(p) {
  // state: 1=online, qualquer outra coisa=offline
  // alarmCount indica alarmes ativos mas não muda o status principal
  const rawState = String(p.state ?? '3');
  const alarmCount = parseInt(p.alarmCount || 0);
  const status = rawState === '1' ? 'OK' : 'OFFLINE';

  return {
    id:            String(p.id),
    name:          p.stationName || p.name || 'Planta Solis',
    status,
    manufacturer:  'Solis',
    power:         parseFloat(p.capacity || p.installedPower || 0).toFixed(2),
    energyDay:     parseFloat(p.dayEnergy   || p.eToday  || 0).toFixed(2),
    energyMonth:   parseFloat(p.monthEnergy || p.eMonth  || 0).toFixed(2),
    energyTotal:   parseFloat(p.allEnergy   || p.eTotal  || 0).toFixed(2),
    current_power: parseFloat(p.power       || p.pac     || 0).toFixed(2),
    updated_at:    p.updateDate || new Date().toISOString(),
    created_at:    p.createDate || new Date().toISOString(),
    alert:         status !== 'OK',
    alarmCount:    parseInt(p.alarmCount || 0),
    inverterOnlineCount: parseInt(p.inverterOnlineCount || 0),
    inverterCount: parseInt(p.inverterCount || 0),
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const source = req.query.source || 'solis';
  if (source !== 'solis') {
    return res.status(400).json({ ok: false, error: `Source desconhecido: ${source}` });
  }

  if (!SOLIS_KEY_ID || !SOLIS_SECRET) {
    return res.status(500).json({ ok: false, error: 'SOLIS_KEY_ID ou SOLIS_KEY_SECRET não configurados' });
  }

  try {
    let allPlants = [];
    let pageNo = 1;
    const pageSize = 100;

    while (true) {
      const json = await solisRequest('/v1/api/userStationList', { pageNo, pageSize });
      const records = json?.data?.page?.records || [];
      allPlants = allPlants.concat(records);
      const total = json?.data?.page?.total || 0;
      if (allPlants.length >= total || records.length === 0) break;
      pageNo++;
    }

    // Debug mode — mostra campos brutos para diagnóstico
    if (req.query.debug === '1') {
      return res.status(200).json({
        ok: true, source: 'solis',
        total: allPlants.length,
        raw_sample: allPlants.slice(0, 5).map(p => ({
          id: p.id,
          stationName: p.stationName,
          status: p.status,
          stationStatus: p.stationStatus,
          state: p.state,
          power: p.power,
          dayEnergy: p.dayEnergy,
          capacity: p.capacity,
          allKeys: Object.keys(p),
        })),
      });
    }

    const plants = allPlants.map(normalizeSolisPlant);

    return res.status(200).json({
      ok:     true,
      source: 'solis',
      total:  plants.length,
      data:   plants,
    });

  } catch (err) {
    console.error('[api/gdash Solis]', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
