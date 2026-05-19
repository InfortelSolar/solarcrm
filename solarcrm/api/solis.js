// ============================================================
//  api/solis.js — Proxy Solis Cloud API para Vercel
//  Autenticação: HMAC-SHA1
// ============================================================

import crypto from 'crypto';

const KEY_ID     = process.env.SOLIS_KEY_ID;
const KEY_SECRET = process.env.SOLIS_KEY_SECRET;
const BASE_URL   = 'https://www.soliscloud.com:13333';

function solisAuth(path, body) {
  const contentMd5  = crypto.createHash('md5').update(body).digest('base64');
  const contentType = 'application/json';
  const date        = new Date().toUTCString();
  const stringToSign = `POST\n${contentMd5}\n${contentType}\n${date}\n${path}`;
  const hmac = crypto.createHmac('sha1', KEY_SECRET);
  hmac.update(stringToSign);
  const signature = hmac.digest('base64');
  return {
    'Content-Type':  contentType,
    'Content-MD5':   contentMd5,
    'Date':          date,
    'Authorization': `API ${KEY_ID}:${signature}`,
  };
}

async function fetchSolis(path, bodyObj) {
  const body    = JSON.stringify(bodyObj);
  const headers = solisAuth(path, body);
  const res     = await fetch(`${BASE_URL}${path}`, { method: 'POST', headers, body });
  if (!res.ok) throw new Error(`Solis API ${res.status}: ${await res.text()}`);
  return res.json();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const action = req.query.action || 'stations';

    if (action === 'stations') {
      // Lista todas as estações
      const data = await fetchSolis('/v1/api/stationList', {
        pageNo: 1,
        pageSize: 1000,
      });
      return res.json({ ok: true, data: normalizeStations(data) });
    }

    if (action === 'detail' && req.query.id) {
      // Detalhe de uma estação
      const data = await fetchSolis('/v1/api/stationDetail', {
        id: req.query.id,
      });
      return res.json({ ok: true, data: normalizeDetail(data) });
    }

    res.status(400).json({ ok: false, error: 'Ação inválida' });

  } catch (err) {
    console.error('[Solis API]', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
}

// ── Normalização dos dados ────────────────────────────────────

function normalizeStations(raw) {
  const records = raw?.data?.page?.records || [];
  return records.map(s => ({
    id:           s.id,
    name:         s.stationName,
    power:        s.capacity,           // kWp instalado
    powerNow:     s.power || 0,         // kW geração atual
    energyDay:    s.dayEnergy || 0,     // kWh hoje
    energyMonth:  s.monthEnergy || 0,   // kWh este mês
    energyTotal:  s.allEnergy || 0,     // kWh total
    status:       mapStatus(s.stationStatus),
    manufacturer: 'Solis',
    updated_at:   new Date().toISOString(),
  }));
}

function normalizeDetail(raw) {
  const s = raw?.data || {};
  return {
    id:          s.id,
    name:        s.stationName,
    power:       s.capacity,
    powerNow:    s.power || 0,
    energyDay:   s.dayEnergy || 0,
    energyMonth: s.monthEnergy || 0,
    energyTotal: s.allEnergy || 0,
    status:      mapStatus(s.stationStatus),
    manufacturer:'Solis',
    updated_at:  new Date().toISOString(),
  };
}

function mapStatus(code) {
  // Solis: 1=normal, 2=alarme, 3=offline
  if (code === 1) return 'OK';
  if (code === 2) return 'ALARMING';
  return 'OFFLINE';
}
