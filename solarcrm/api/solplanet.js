/**
 * api/solplanet.js — Proxy SolPlanet / AiSWEI Cloud
 * Com histórico via portal internation-pro-cloud.solplanet.net
 */

import crypto from 'crypto';

const BASE_URL   = 'https://ap-southeast-1-api-genergal.aisweicloud.com';
const PORTAL_URL = 'https://internation-pro-cloud.solplanet.net';

let _portalCache = { token: null, userId: null, expiresAt: 0 };

async function getPortalToken() {
  const now = Date.now();
  if (_portalCache.token && now < _portalCache.expiresAt) return _portalCache;

  const email    = process.env.SOLPLANET_PORTAL_EMAIL;
  const password = process.env.SOLPLANET_PORTAL_PASS;
  if (!email || !password) throw new Error('SOLPLANET_PORTAL_EMAIL ou SOLPLANET_PORTAL_PASS não configurados');

  const res = await fetch(`${PORTAL_URL}/api/user/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'localE': 'pt_BR' },
    body: JSON.stringify({ account: email, pwd: password, type: 'account' }),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) throw new Error(`Portal login HTTP ${res.status}`);
  const json = await res.json();
  if (json.code !== 200) throw new Error(`Portal login falhou: ${JSON.stringify(json)}`);

  const token  = json.result?.token || json.result;
  const userId = json.result?.userId || json.result?.id || '10000001';

  _portalCache = { token, userId: String(userId), expiresAt: now + 20 * 60 * 1000 };
  return _portalCache;
}

async function portalGet(path) {
  const { token, userId } = await getPortalToken();
  const url = `${PORTAL_URL}${path.replace('{userId}', userId)}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', 'token': token, 'localE': 'pt_BR' },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Portal GET ${path} HTTP ${res.status}`);
  const json = await res.json();
  const result = json.result;
  return typeof result === 'string' ? JSON.parse(result) : result;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const token     = process.env.SOLPLANET_TOKEN;
  const appKey    = process.env.SOLPLANET_APP_KEY;
  const appSecret = process.env.SOLPLANET_APP_SECRET;

  if (!token || !appKey || !appSecret) {
    return res.status(500).json({ error: 'Variáveis SOLPLANET não configuradas' });
  }

  const { action = 'summary' } = req.query;

  try {
    switch (action) {

      case 'plants': {
        const plants = await getAllPlants(token, appKey, appSecret);
        return res.status(200).json({ success: true, total: plants.length, data: plants });
      }

      case 'summary': {
        const plants = await getAllPlants(token, appKey, appSecret);
        let online = 0, offline = 0, warning = 0;
        let totalPowerKw = 0, totalEtodayKwh = 0, totalEtotalKwh = 0;
        for (const p of plants) {
          const s = String(p.status ?? '0');
          if (s === '1') online++;
          else if (s === '2') warning++;
          else offline++;
          totalPowerKw   += parseFloat(p.totalpower ?? 0);
          totalEtodayKwh += parseFloat(p.etoday ?? 0);
          totalEtotalKwh += parseFloat(p.etotal ?? 0);
        }
        return res.status(200).json({
          success: true, source: 'solplanet',
          summary: { totalPlants: plants.length, online, offline, warning,
            totalPowerKw: round(totalPowerKw), totalEtodayKwh: round(totalEtodayKwh), totalEtotalKwh: round(totalEtotalKwh) },
          plants: plants.map(p => ({
            id: p.apikey, name: p.name, status: statusLabel(p.status),
            statusCode: p.status, powerKw: p.totalpower ?? 0,
            etodayKwh: p.etoday ?? 0, etotalKwh: p.etotal ?? 0,
            lastUpdate: p.ludt, address: p.position, source: 'solplanet',
          }))
        });
      }

      // ── Histórico 7 dias via portal ───────────────────────
      case 'week': {
        const { plantId, date } = req.query;
        if (!plantId || !date) return res.status(400).json({ error: 'plantId e date obrigatórios' });
        const result = await portalGet(`/api/plant/production/international/week?userId={userId}&plantId=${plantId}&date=${date}&version=1`);
        return res.status(200).json({ ok: true, dates: result?.time || [], values: result?.data?.ac || [] });
      }

      // ── Histórico mensal via portal ───────────────────────
      case 'month': {
        const { plantId, month } = req.query;
        if (!plantId || !month) return res.status(400).json({ error: 'plantId e month obrigatórios' });
        const result = await portalGet(`/api/plant/production/international/month?userId={userId}&plantId=${plantId}&date=${month}&version=1`);
        return res.status(200).json({ ok: true, days: result?.time || [], values: result?.data?.ac || [], month });
      }

      // ── Energia de um dia específico ─────────────────────
      case 'dayEnergy': {
        const { plantId, date } = req.query;
        if (!plantId || !date) return res.status(400).json({ error: 'plantId e date obrigatórios' });
        try {
          const result = await portalGet(`/api/plant/production/international/week?userId={userId}&plantId=${plantId}&date=${date}&version=1`);
          const dates  = result?.time || [];
          const values = result?.data?.ac || [];
          const idx    = dates.indexOf(date);
          if (idx >= 0) return res.status(200).json({ ok: true, energy: parseFloat(values[idx] ?? 0) });
        } catch(_) {}
        // Fallback: etoday
        const plants = await getAllPlants(token, appKey, appSecret);
        const today  = new Date().toISOString().slice(0, 10);
        const plant  = plants.find(p => p.apikey === plantId);
        return res.status(200).json({ ok: true, energy: (plant && date === today) ? parseFloat(plant.etoday ?? 0) : 0 });
      }

      // ── Energia do mês ────────────────────────────────────
      case 'monthEnergy': {
        const { plantId, month } = req.query;
        if (!plantId || !month) return res.status(400).json({ error: 'plantId e month obrigatórios' });
        try {
          const result = await portalGet(`/api/plant/production/international/month?userId={userId}&plantId=${plantId}&date=${month}&version=1`);
          const values = result?.data?.ac || [];
          const total  = values.reduce((s, v) => s + parseFloat(v || 0), 0);
          return res.status(200).json({ ok: true, energy: parseFloat(total.toFixed(2)) });
        } catch(_) {}
        const plants   = await getAllPlants(token, appKey, appSecret);
        const curMonth = new Date().toISOString().slice(0, 7);
        const plant    = plants.find(p => p.apikey === plantId);
        return res.status(200).json({ ok: true, energy: (plant && month === curMonth) ? parseFloat(plant.emonth ?? 0) : 0 });
      }

      // ── Alarmes ───────────────────────────────────────────
      case 'alarms': {
        const { plantId } = req.query;
        if (!plantId) return res.status(400).json({ error: 'plantId obrigatório' });
        const path = `/pro/getDeviceEventList?pageNum=1&pageSize=10&token=${token}&apikey=${plantId}&type=1`;
        const data = await apiGet(path, appKey, appSecret);
        const events = data?.data?.result || [];
        return res.status(200).json({
          success: true,
          alarms: events.map(e => ({
            code:    e.errorCode || e.code || '—',
            message: e.errorMsg  || e.msg  || e.content || 'Sem descrição',
            advice:  e.solution  || e.advice || 'Consulte o manual do fabricante',
            level:   e.level     || '—',
            time:    e.createTime || e.time || null,
          })),
        });
      }

      default:
        return res.status(400).json({ error: `Action desconhecida: "${action}"` });
    }

  } catch (err) {
    console.error('[SolPlanet Error]', err.message);
    return res.status(500).json({ error: err.message });
  }
}

async function getAllPlants(token, appKey, appSecret) {
  let allPlants = [];
  let pageNum = 1, totalPages = 1;
  do {
    const path = `/pro/getPlanListPro?order=0&pageNum=${pageNum}&pageSize=50&token=${token}`;
    const data = await apiGet(path, appKey, appSecret);
    const list = data?.data?.result ?? [];
    allPlants = allPlants.concat(Array.isArray(list) ? list : []);
    totalPages = data?.data?.totalPages ?? 1;
    pageNum++;
  } while (pageNum <= totalPages);
  return allPlants;
}

async function apiGet(path, appKey, appSecret) {
  const timestamp = Date.now().toString();
  const nonce     = crypto.randomUUID();
  const accept    = 'application/json';
  const date      = new Date().toUTCString();
  const signHeaders = { 'x-ca-key': appKey, 'x-ca-nonce': nonce, 'x-ca-timestamp': timestamp };
  const signHeaderNames = Object.keys(signHeaders).sort().join(',');
  const [pathOnly, queryString] = path.split('?');
  const sortedQuery = (queryString || '').split('&').filter(Boolean).sort().join('&');
  const sortedPath  = sortedQuery ? `${pathOnly}?${sortedQuery}` : pathOnly;
  const headersString = Object.keys(signHeaders).sort().map(k => `${k}:${signHeaders[k]}`).join('\n');
  const stringToSign  = ['GET', accept, '', '', date, headersString, sortedPath].join('\n');
  const signature = crypto.createHmac('sha256', appSecret).update(stringToSign, 'utf8').digest('base64');
  const response = await fetch(`${BASE_URL}${sortedPath}`, {
    method: 'GET',
    headers: { 'Accept': accept, 'Date': date, 'X-Ca-Key': appKey, 'X-Ca-Nonce': nonce, 'X-Ca-Timestamp': timestamp, 'X-Ca-Signature-Headers': signHeaderNames, 'X-Ca-Signature': signature, 'X-Ca-Stage': 'RELEASE' }
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const json = await response.json();
  if (json.status && json.status !== 200) throw new Error(`API erro ${json.status}: ${json.info}`);
  return json;
}

function round(val, d = 2) { return Math.round(val * 10**d) / 10**d; }
function statusLabel(code) {
  switch (String(code ?? '')) {
    case '1': return 'normal'; case '2': return 'warning'; case '3': return 'error'; default: return 'offline';
  }
}
