// ============================================================
//  SolarCRM — Proxy Growatt API (Vercel Serverless)
//  Endpoints testados: server.growatt.com e openapi.growatt.com
// ============================================================

const crypto = require('crypto');

// Tenta os dois endpoints conhecidos da Growatt
const ENDPOINTS = [
  'https://server.growatt.com',
  'https://openapi.growatt.com',
];

function md5(str) {
  return crypto.createHash('md5').update(str).digest('hex');
}

// Faz login e retorna cookie de sessão
async function login(baseUrl, user, pass) {
  const url  = `${baseUrl}/login`;
  const body = new URLSearchParams({
    account:       user,
    password:      md5(pass),
    validateCode:  '',
    isReadPact:    '0',
  });

  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    body.toString(),
    redirect: 'manual',
  });

  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch(e) {
    throw new Error(`Login: resposta inválida — ${text.slice(0, 200)}`);
  }

  if (json.result !== 1 && json.success !== true) {
    throw new Error(`Login falhou: ${JSON.stringify(json)}`);
  }

  // Extrai cookie de sessão
  const setCookie = res.headers.get('set-cookie') || '';
  const match     = setCookie.match(/JSESSIONID=[^;]+/);
  if (!match) throw new Error('Login OK mas sem cookie de sessão');

  return match[0];
}

// Busca lista de plantas
async function getPlants(baseUrl, cookie) {
  const url = `${baseUrl}/index/getPlantListTitle`;
  const res = await fetch(url, {
    method:  'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie':        cookie,
    },
    body: new URLSearchParams({ currPage: '1' }).toString(),
  });

  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch(e) {
    throw new Error(`getPlants: resposta inválida — ${text.slice(0, 200)}`);
  }

  // Tenta diferentes estruturas de resposta
  const plants =
    json.data?.datas ||
    json.data?.plantList ||
    json.result?.data ||
    json.back?.data ||
    [];

  return plants;
}

// Normaliza planta Growatt para o formato padrão SolarCRM
function normalizePlant(p) {
  // Status: 1=Online, 2=Offline, 3=Alarme, 0=Sem comunicação
  const statusMap = { '1': 'OK', '0': 'NO_COMMUNICATION', '2': 'OFFLINE', '3': 'ALARMING' };
  const status    = statusMap[String(p.status)] || 'OFFLINE';

  const power      = parseFloat(p.nominalPower || p.peakPower || p.capacity || 0);
  const energyDay  = parseFloat(p.todayEnergy  || p.eDay   || 0);
  const energyMonth= parseFloat(p.monthEnergy  || p.eMonth || 0);

  return {
    id:           String(p.id || p.plantId || p.plant_id),
    name:         p.plantName || p.name || 'Planta Growatt',
    status,
    manufacturer: 'Growatt',
    power:        power.toFixed(2),
    energyDay:    energyDay.toFixed(2),
    energyMonth:  energyMonth.toFixed(2),
    updated_at:   p.lastUpdateTime || new Date().toISOString(),
    created_at:   p.createTime     || new Date().toISOString(),
    alert:        status !== 'OK',
    raw:          p, // mantém dados originais para debug
  };
}

// Handler principal Vercel
module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const user = process.env.GROWATT_USER;
  const pass = process.env.GROWATT_PASS;

  if (!user || !pass) {
    return res.status(500).json({
      ok:    false,
      error: 'Credenciais Growatt não configuradas (GROWATT_USER / GROWATT_PASS)',
    });
  }

  let lastError = '';

  // Tenta cada endpoint até um funcionar
  for (const baseUrl of ENDPOINTS) {
    try {
      console.log(`[Growatt] Tentando ${baseUrl}...`);

      const cookie = await login(baseUrl, user, pass);
      console.log(`[Growatt] Login OK em ${baseUrl}`);

      const plants = await getPlants(baseUrl, cookie);
      console.log(`[Growatt] ${plants.length} plantas encontradas`);

      const data = plants.map(normalizePlant);

      return res.status(200).json({
        ok:       true,
        source:   'growatt',
        endpoint: baseUrl,
        total:    data.length,
        data,
      });

    } catch (err) {
      lastError = err.message;
      console.warn(`[Growatt] Falhou em ${baseUrl}: ${err.message}`);
      // Tenta próximo endpoint
    }
  }

  // Todos os endpoints falharam
  return res.status(500).json({
    ok:    false,
    error: `Todos os endpoints falharam. Último erro: ${lastError}`,
  });
};
