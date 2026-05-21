/**
 * api/solplanet.js — Proxy SolPlanet / AiSWEI Cloud
 * Vercel Serverless Function
 *
 * Variáveis de ambiente necessárias (Vercel):
 *   SOLPLANET_TOKEN → token enviado no header de cada requisição
 *
 * Base URL: https://internation-pro-cloud.solplanet.net/api/
 *
 * Endpoints implementados:
 *   ?action=summary  → agrega KPIs de todas as plantas (dashboard)
 *   ?action=plants   → lista todas as plantas
 *   ?action=overview → resumo geral (getPlantOverview)
 */

const BASE_URL = 'https://internation-pro-cloud.solplanet.net/api';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const token = process.env.SOLPLANET_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'SOLPLANET_TOKEN não configurado na Vercel' });
  }

  const { action = 'summary' } = req.query;

  try {
    switch (action) {

      // ─── Lista todas as plantas ───────────────────────────────────────────
      case 'plants': {
        const plants = await getAllPlants(token);
        return res.status(200).json({ success: true, total: plants.length, data: plants });
      }

      // ─── Overview geral ───────────────────────────────────────────────────
      case 'overview': {
        const data = await apiGet('/overview/getPlantOverview?version=1', token);
        return res.status(200).json({ success: true, data });
      }

      // ─── Summary para o Dashboard ─────────────────────────────────────────
      case 'summary': {
        const [plants, overview] = await Promise.all([
          getAllPlants(token),
          apiGet('/overview/getPlantOverview?version=1', token)
        ]);

        let online = 0, offline = 0, warning = 0;
        for (const p of plants) {
          const s = String(p.status ?? p.plantStatus ?? '');
          if (s === '1' || s === 'normal')       online++;
          else if (s === '2' || s === 'warning') warning++;
          else                                    offline++;
        }

        return res.status(200).json({
          success: true,
          source: 'solplanet',
          summary: {
            totalPlants: plants.length,
            online,
            offline,
            warning,
            // Campos do getPlantOverview — usa o que vier disponível
            totalPowerKw:   overview?.totalPower   ?? overview?.installedPower ?? 0,
            totalEtodayKwh: overview?.todayEnergy  ?? overview?.eToday         ?? 0,
            totalEtotalKwh: overview?.totalEnergy  ?? overview?.eTotal         ?? 0,
          },
          plants: plants.map(p => ({
            id:          p.plantId   ?? p.id ?? p.apikey,
            name:        p.plantName ?? p.name,
            status:      statusLabel(p.status ?? p.plantStatus),
            statusCode:  p.status    ?? p.plantStatus,
            powerKw:     p.power     ?? p.totalPower ?? 0,
            etodayKwh:   p.eToday    ?? p.todayEnergy ?? 0,
            etotalKwh:   p.eTotal    ?? p.totalEnergy ?? 0,
            lastUpdate:  p.lastUpdateTime ?? p.ludt,
            address:     p.address   ?? p.position,
            source:      'solplanet',
          }))
        });
      }

      default:
        return res.status(400).json({
          error: `Action desconhecida: "${action}"`,
          available: ['summary', 'plants', 'overview']
        });
    }

  } catch (err) {
    console.error('[SolPlanet Proxy Error]', err.message);
    return res.status(500).json({
      error: 'Erro ao comunicar com a API SolPlanet',
      detail: err.message
    });
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getAllPlants(token) {
  let allPlants = [];
  let current = 1;
  let totalPageNum = 1;

  do {
    const data = await apiGet(
      `/overview/getPlantList?current=${current}&pageSize=50&devType=3&version=1`,
      token
    );

    const result = data?.result ?? data?.data?.result ?? [];
    const list = Array.isArray(result) ? result : (result.list ?? result.records ?? []);
    allPlants = allPlants.concat(list);

    totalPageNum = data?.result?.totalPageNum ?? data?.totalPageNum ?? 1;
    current++;
  } while (current <= totalPageNum);

  return allPlants;
}

async function apiGet(path, token) {
  const url = `${BASE_URL}${path}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept':       'application/json',
      'Content-Type': 'application/json',
      'token':        token,
      'localE':       'pt_BR',
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ao chamar ${path}`);
  }

  const json = await response.json();

  if (json.code && json.code !== 200) {
    throw new Error(`API SolPlanet erro ${json.code}: ${json.msg || 'sem mensagem'}`);
  }

  return json;
}

function statusLabel(code) {
  switch (String(code ?? '')) {
    case '1': case 'normal':  return 'normal';
    case '2': case 'warning': return 'warning';
    case '3': case 'error':   return 'error';
    default:                  return 'offline';
  }
}
