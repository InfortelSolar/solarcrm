// ============================================================
//  SolarCRM — Proxy Solis Cloud API (Vercel Serverless)
//  api/solis.js
// ============================================================
import crypto from 'crypto';

const SOLIS_BASE   = 'https://www.soliscloud.com:13333';
const SOLIS_KEY_ID = process.env.SOLIS_KEY_ID;
const SOLIS_SECRET = process.env.SOLIS_KEY_SECRET;

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
  const rawState   = String(p.state ?? '3');
  const alarmCount = parseInt(p.alarmCount || 0);
  const status     = rawState === '1' ? 'OK' : 'OFFLINE';

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
    alarmCount,
    inverterOnlineCount: parseInt(p.inverterOnlineCount || 0),
    inverterCount:       parseInt(p.inverterCount || 0),
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!SOLIS_KEY_ID || !SOLIS_SECRET) {
    return res.status(500).json({ ok: false, error: 'SOLIS_KEY_ID ou SOLIS_KEY_SECRET não configurados' });
  }

  // ── Alarmes de uma planta ─────────────────────────────────
  if (req.query.alarms === '1' && req.query.stationId) {
    try {
      const json = await solisRequest('/v1/api/alarmList', {
        pageNo: 1, pageSize: 10,
        stationId: req.query.stationId,
        state: '0',
      });
      const alarms = json?.data?.records || [];
      return res.status(200).json({
        ok: true,
        alarms: alarms.map(a => ({
          code:      a.alarmCode  || '—',
          level:     a.alarmLevel || '—',
          message:   a.alarmMsg   || 'Sem descrição',
          advice:    a.advice     || 'Consulte o manual do fabricante',
          startTime: a.alarmBeginTime || null,
          status:    a.state || '0',
        })),
      });
    } catch(err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  // ── Histórico por dia ou mês ──────────────────────────────
  if (req.query.history === '1' && req.query.stationId) {
    try {
      if (req.query.date) {
        // stationDay retorna leituras intraday — pega a última leitura do dia
        const json = await solisRequest('/v1/api/stationDay', {
          id: req.query.stationId, time: req.query.date, money: '0',
        });
        // Tenta campo direto primeiro, depois última leitura do array
        let energy = json?.data?.energy ?? json?.data?.eDay ?? null;
        if (energy === null || energy === 0) {
          const records = json?.data?.records || json?.data || [];
          if (Array.isArray(records) && records.length > 0) {
            const last = records[records.length - 1];
            energy = last?.produceEnergy ?? last?.energy ?? last?.eToday ?? 0;
          }
        }
        return res.status(200).json({ ok: true, energy: parseFloat(energy || 0), raw: json?.data });
      }
      if (req.query.month) {
        const json = await solisRequest('/v1/api/stationMonth', {
          id: req.query.stationId, time: req.query.month, money: '0',
        });
        let energy = json?.data?.energy ?? json?.data?.eMonth ?? null;
        if (energy === null || energy === 0) {
          const records = json?.data?.records || json?.data || [];
          if (Array.isArray(records) && records.length > 0) {
            energy = records.reduce((s, r) => s + parseFloat(r.produceEnergy || r.energy || 0), 0);
          }
        }
        return res.status(200).json({ ok: true, energy: parseFloat(energy || 0), raw: json?.data });
      }
      return res.status(400).json({ ok: false, error: 'Informe date ou month' });
    } catch(err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  // ── Debug mode ────────────────────────────────────────────
  const debug = req.query.debug === '1';

  try {
    let allPlants = [];
    let pageNo    = 1;
    const pageSize = 100;

    while (true) {
      const json    = await solisRequest('/v1/api/userStationList', { pageNo, pageSize });
      const records = json?.data?.page?.records || [];
      allPlants     = allPlants.concat(records);
      const total   = json?.data?.page?.total || 0;
      if (allPlants.length >= total || records.length === 0) break;
      pageNo++;
    }

    if (debug) {
      return res.status(200).json({
        ok: true, source: 'solis',
        total: allPlants.length,
        raw_sample: allPlants.slice(0, 5).map(p => ({
          id: p.id, stationName: p.stationName,
          state: p.state, alarmCount: p.alarmCount,
          inverterOnlineCount: p.inverterOnlineCount,
          allKeys: Object.keys(p),
        })),
      });
    }

    const plants = allPlants.map(normalizeSolisPlant);
    return res.status(200).json({ ok: true, source: 'solis', total: plants.length, data: plants });

  } catch (err) {
    console.error('[api/solis]', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
