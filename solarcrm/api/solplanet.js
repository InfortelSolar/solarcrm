/**
 * api/solplanet.js — Proxy SolPlanet / AiSWEI Cloud
 */

import crypto from 'crypto';

const BASE_URL = 'https://ap-southeast-1-api-genergal.aisweicloud.com';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const token     = process.env.SOLPLANET_TOKEN;
  const appKey    = process.env.SOLPLANET_APP_KEY;
  const appSecret = process.env.SOLPLANET_APP_SECRET;

  if (!token || !appKey || !appSecret) {
    return res.status(500).json({ error: 'Variáveis SOLPLANET_TOKEN, SOLPLANET_APP_KEY e SOLPLANET_APP_SECRET são obrigatórias' });
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
          totalEtodayKwh += parseFloat(p.etoday     ?? 0);
          totalEtotalKwh += parseFloat(p.etotal      ?? 0);
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

      // ── Energia de um dia específico ─────────────────────
      case 'dayEnergy': {
        const { plantId, date } = req.query;
        if (!plantId || !date) return res.status(400).json({ error: 'plantId e date obrigatórios' });

        // Tenta múltiplos endpoints possíveis
        const dateFormatted = date.replace(/-/g, '');
        const endpoints = [
          `/pro/getPlanEnergyByDate?token=${token}&apikey=${plantId}&date=${dateFormatted}`,
          `/pro/getPlantEnergyDay?token=${token}&apikey=${plantId}&date=${dateFormatted}`,
          `/pro/getPlanListPro?order=0&pageNum=1&pageSize=50&token=${token}`,
        ];

        for (const path of endpoints) {
          try {
            const data = await apiGet(path, appKey, appSecret);
            // Se for a lista de plantas, pega etoday da planta correta
            if (path.includes('getPlanListPro')) {
              const plants = data?.data?.result ?? [];
              const plant = plants.find(p => p.apikey === plantId);
              if (plant) {
                const today = new Date().toISOString().slice(0,10);
                const energy = date === today ? parseFloat(plant.etoday ?? 0) : 0;
                return res.status(200).json({ ok: true, energy, source: 'etoday' });
              }
            }
            const energy = parseFloat(
              data?.data?.etoday ?? data?.data?.energy ??
              data?.data?.dayEnergy ?? data?.data?.eDay ?? 0
            );
            if (energy > 0) return res.status(200).json({ ok: true, energy });
          } catch(e) { /* tenta próximo */ }
        }
        return res.status(200).json({ ok: true, energy: 0 });
      }

      // ── Energia de um mês específico ─────────────────────
      case 'monthEnergy': {
        const { plantId, month } = req.query;
        if (!plantId || !month) return res.status(400).json({ error: 'plantId e month obrigatórios' });

        const monthFormatted = month.replace(/-/g, '');
        const endpoints = [
          `/pro/getPlanEnergyByMonth?token=${token}&apikey=${plantId}&date=${monthFormatted}`,
          `/pro/getPlantEnergyMonth?token=${token}&apikey=${plantId}&date=${monthFormatted}`,
          `/pro/getPlanListPro?order=0&pageNum=1&pageSize=50&token=${token}`,
        ];

        for (const path of endpoints) {
          try {
            const data = await apiGet(path, appKey, appSecret);
            if (path.includes('getPlanListPro')) {
              const plants = data?.data?.result ?? [];
              const plant = plants.find(p => p.apikey === plantId);
              if (plant) {
                const curMonth = new Date().toISOString().slice(0,7);
                const energy = month === curMonth ? parseFloat(plant.emonth ?? 0) : 0;
                return res.status(200).json({ ok: true, energy, source: 'emonth' });
              }
            }
            const energy = parseFloat(
              data?.data?.emonth ?? data?.data?.energy ??
              data?.data?.monthEnergy ?? data?.data?.eMonth ?? 0
            );
            if (energy > 0) return res.status(200).json({ ok: true, energy });
          } catch(e) { /* tenta próximo */ }
        }
        return res.status(200).json({ ok: true, energy: 0 });
      }

      // ── Alarmes de uma planta específica ─────────────────
      case 'alarms': {
        const { plantId } = req.query;
        if (!plantId) return res.status(400).json({ error: 'plantId obrigatório' });

        const path = `/pro/getDeviceEventList?pageNum=1&pageSize=10&token=${token}&apikey=${plantId}&type=1`;
        const data = await apiGet(path, appKey, appSecret);
        const events = data?.data?.result || [];

        return res.status(200).json({
          success: true,
          alarms: events.map(e => ({
            code:    e.errorCode  || e.code || '—',
            message: e.errorMsg   || e.msg  || e.content || 'Sem descrição',
            advice:  e.solution   || e.advice || 'Consulte o manual do fabricante',
            level:   e.level      || '—',
            time:    e.createTime || e.time || null,
          })),
        });
      }

      default:
        return res.status(400).json({ error: `Action desconhecida: "${action}"`, available: ['summary', 'plants', 'alarms', 'dayEnergy', 'monthEnergy'] });
    }

  } catch (err) {
    console.error('[SolPlanet Error]', err.message);
    return res.status(500).json({ error: 'Erro ao comunicar com a API SolPlanet', detail: err.message });
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

  const signHeaders = {
    'x-ca-key':       appKey,
    'x-ca-nonce':     nonce,
    'x-ca-timestamp': timestamp,
  };

  const signHeaderNames = Object.keys(signHeaders).sort().join(',');
  const [pathOnly, queryString] = path.split('?');
  const sortedQuery = (queryString || '').split('&').filter(Boolean).sort().join('&');
  const sortedPath  = sortedQuery ? `${pathOnly}?${sortedQuery}` : pathOnly;

  const headersString = Object.keys(signHeaders).sort().map(k => `${k}:${signHeaders[k]}`).join('\n');
  const stringToSign  = ['GET', accept, '', '', date, headersString, sortedPath].join('\n');

  const signature = crypto.createHmac('sha256', appSecret).update(stringToSign, 'utf8').digest('base64');
  const url = `${BASE_URL}${sortedPath}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': accept, 'Date': date,
      'X-Ca-Key': appKey, 'X-Ca-Nonce': nonce,
      'X-Ca-Timestamp': timestamp, 'X-Ca-Signature-Headers': signHeaderNames,
      'X-Ca-Signature': signature, 'X-Ca-Stage': 'RELEASE',
    }
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    const xcaError = response.headers.get('x-ca-error-message') || '';
    throw new Error(`HTTP ${response.status} — xca: ${xcaError} — body: ${body.slice(0, 500)}`);
  }

  const json = await response.json();
  if (json.status && json.status !== 200) throw new Error(`API erro ${json.status}: ${json.info || 'sem mensagem'}`);
  return json;
}

function round(val, d = 2) { return Math.round(val * 10**d) / 10**d; }

function statusLabel(code) {
  switch (String(code ?? '')) {
    case '1': return 'normal';
    case '2': return 'warning';
    case '3': return 'error';
    default:  return 'offline';
  }
}
