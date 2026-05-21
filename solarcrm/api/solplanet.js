/**
 * api/solplanet.js — Proxy SolPlanet / AiSWEI Cloud
 * Vercel Serverless Function
 *
 * Variáveis de ambiente necessárias (Vercel):
 *   SOLPLANET_TOKEN      → User Token recebido por e-mail da SolPlanet
 *   SOLPLANET_APP_SECRET → APP Secret (reservado — usado apenas na assinatura do OLDAPI legado)
 *
 * Base URL: https://internation-pro-cloud.solplanet.net/pro/
 *
 * Endpoints implementados:
 *   ?action=plants           → getPlanListPro       (lista todas as plantas)
 *   ?action=overview&apikey= → getPlantOverviewPro  (resumo de uma planta)
 *   ?action=devices&apikey=  → getDeviceListPro     (inversores de uma planta)
 *   ?action=lastdata&isnos=  → getLastTsDataPro     (dados em tempo real dos inversores)
 *   ?action=errors&apikey=   → getInverterCurrentErrorPro (erros atuais)
 *   ?action=summary          → agrega KPIs de todas as plantas (para o dashboard)
 */

const BASE_URL = 'https://internation-pro-cloud.solplanet.net/pro';
const PAGE_SIZE = 100; // máximo por página

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const token = process.env.SOLPLANET_TOKEN;

  if (!token) {
    return res.status(500).json({
      error: 'SOLPLANET_TOKEN não configurado nas variáveis de ambiente da Vercel'
    });
  }

  const { action = 'summary', apikey, isnos, isno, date } = req.query;

  try {
    switch (action) {

      // ─── Lista todas as plantas (com paginação automática) ────────────────
      case 'plants': {
        const plants = await getAllPlants(token);
        return res.status(200).json({ success: true, data: plants });
      }

      // ─── Resumo de uma planta específica ──────────────────────────────────
      case 'overview': {
        if (!apikey) {
          return res.status(400).json({ error: 'Parâmetro apikey obrigatório' });
        }
        const data = await apiGet('/getPlantOverviewPro', { token, apikey });
        return res.status(200).json({ success: true, data: data.data });
      }

      // ─── Dispositivos/inversores de uma planta ────────────────────────────
      case 'devices': {
        if (!apikey) {
          return res.status(400).json({ error: 'Parâmetro apikey obrigatório' });
        }
        const data = await apiGet('/getDeviceListPro', { token, apikey });
        return res.status(200).json({ success: true, data: data.data });
      }

      // ─── Dados em tempo real dos inversores ───────────────────────────────
      case 'lastdata': {
        if (!isnos) {
          return res.status(400).json({ error: 'Parâmetro isnos obrigatório (SNs separados por vírgula)' });
        }
        const data = await apiGet('/getLastTsDataPro', { token, isnos });
        return res.status(200).json({ success: true, data: data.data });
      }

      // ─── Erros atuais (opcionalmente filtrados por planta/inversor) ───────
      case 'errors': {
        const params = { token };
        if (apikey) params.apikey = apikey;
        if (isno) params.isno = isno;
        const data = await apiGet('/getInverterCurrentErrorPro', params);
        return res.status(200).json({ success: true, data: data.data });
      }

      // ─── Overview dos inversores de uma planta ────────────────────────────
      case 'inverter_overview': {
        if (!apikey) {
          return res.status(400).json({ error: 'Parâmetro apikey obrigatório' });
        }
        const params = { token, apikey };
        if (date) params.date = date; // formato yyyy-MM (opcional)
        const data = await apiGet('/getInverterOverviewPro', params);
        return res.status(200).json({ success: true, data: data.data });
      }

      // ─── Eventos/alertas de uma planta ────────────────────────────────────
      case 'events': {
        if (!apikey) {
          return res.status(400).json({ error: 'Parâmetro apikey obrigatório' });
        }
        // sdt e edt são opcionais; padrão: últimos 7 dias
        const today = new Date();
        const sdt = req.query.sdt || formatDate(new Date(today - 7 * 86400000));
        const edt = req.query.edt || formatDate(today);
        const data = await apiGet('/getPlantEventPro', { token, apikey, sdt, edt });
        return res.status(200).json({ success: true, data: data.data });
      }

      // ─── Summary agregado para o Dashboard ───────────────────────────────
      // Retorna KPIs consolidados de todas as plantas SolPlanet
      case 'summary': {
        const plants = await getAllPlants(token);

        let totalPowerKw = 0;
        let totalEtodayKwh = 0;
        let totalEtotalKwh = 0;
        let online = 0;
        let offline = 0;
        let warning = 0;
        let error = 0;

        for (const plant of plants) {
          totalPowerKw += plant.totalpower || 0;
          totalEtodayKwh += plant.etoday || 0;
          totalEtotalKwh += plant.etotal || 0;

          switch (String(plant.status)) {
            case '1': online++;  break;
            case '2': warning++; break;
            case '3': error++;   break;
            default:  offline++; break;
          }
        }

        return res.status(200).json({
          success: true,
          source: 'solplanet',
          summary: {
            totalPlants: plants.length,
            online,
            offline,
            warning,
            error,
            totalPowerKw: round(totalPowerKw),
            totalEtodayKwh: round(totalEtodayKwh),
            totalEtotalKwh: round(totalEtotalKwh),
          },
          plants: plants.map(p => ({
            id: p.apikey,
            name: p.name,
            status: statusLabel(p.status),
            statusCode: p.status,
            powerKw: p.totalpower || 0,
            etodayKwh: p.etoday || 0,
            etotalKwh: p.etotal || 0,
            lastUpdate: p.ludt,
            address: p.position,
            source: 'solplanet',
          }))
        });
      }

      default:
        return res.status(400).json({
          error: `Action desconhecida: "${action}"`,
          available: ['plants', 'overview', 'devices', 'lastdata', 'errors', 'events', 'inverter_overview', 'summary']
        });
    }

  } catch (err) {
    console.error('[SolPlanet Proxy Error]', err.message);
    return res.status(500).json({
      error: 'Erro ao comunicar com a API SolPlanet/AiSWEI',
      detail: err.message
    });
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Busca todas as plantas com paginação automática
 */
async function getAllPlants(token) {
  let allPlants = [];
  let pageNum = 1;
  let totalPages = 1;

  do {
    const res = await apiGet('/getPlanListPro', {
      token,
      order: 0,         // ordenar por última atualização
      pageNum,
      pageSize: PAGE_SIZE
    });

    const data = res.data;
    if (data && data.result) {
      allPlants = allPlants.concat(data.result);
      totalPages = data.totalPages || 1;
    }
    pageNum++;
  } while (pageNum <= totalPages);

  return allPlants;
}

/**
 * Faz uma requisição GET para a API AiSWEI/SolPlanet
 */
async function apiGet(path, params = {}) {
  const url = new URL(`${BASE_URL}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      url.searchParams.append(key, value);
    }
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ao chamar ${path}`);
  }

  const json = await response.json();

  // A API retorna status 200 no body quando OK
  if (json.status && json.status !== 200) {
    throw new Error(`API SolPlanet erro ${json.status}: ${json.info || 'sem mensagem'}`);
  }

  return json;
}

function round(val, decimals = 2) {
  return Math.round(val * 10 ** decimals) / 10 ** decimals;
}

function formatDate(d) {
  return d.toISOString().split('T')[0]; // yyyy-MM-dd
}

function statusLabel(code) {
  switch (String(code)) {
    case '1': return 'normal';
    case '2': return 'warning';
    case '3': return 'error';
    default:  return 'offline';
  }
}
