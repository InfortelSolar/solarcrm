// ============================================================
//  SolarCRM — Proxy Growatt API (Vercel Serverless)
//  v2 — Testa múltiplas estratégias de autenticação
// ============================================================

const crypto = require('crypto');

const ENDPOINTS = [
  'https://server.growatt.com',
  'https://openapi.growatt.com',
];

function md5(str) {
  return crypto.createHash('md5').update(str).digest('hex');
}

// Tenta login com diferentes combinações de senha
async function tryLogin(baseUrl, user, pass) {
  const strategies = [
    { label: 'MD5',       password: md5(pass) },
    { label: 'plaintext', password: pass },
    { label: 'MD5-upper', password: md5(pass).toUpperCase() },
  ];

  for (const s of strategies) {
    try {
      const body = new URLSearchParams({
        account:      user,
        password:     s.password,
        validateCode: '',
        isReadPact:   '0',
      });

      const res = await fetch(`${baseUrl}/login`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body:    body.toString(),
        redirect: 'manual',
      });

      const text = await res.text();
      let json;
      try { json = JSON.parse(text); } catch(e) {
        console.warn(`[${s.label}] Resposta não-JSON: ${text.slice(0,100)}`);
        continue;
      }

      console.log(`[${baseUrl}][${s.label}] resultado:`, JSON.stringify(json).slice(0,150));

      if (json.result === 1 || json.success === true || json.error === 0) {
        // Login OK — extrai cookie
        const setCookie = res.headers.get('set-cookie') || '';
        const match = setCookie.match(/JSESSIONID=[^;]+/);
        if (match) return { cookie: match[0], strategy: s.label };

        // Alguns endpoints retornam token no body
        if (json.back?.token || json.data?.token) {
          return { token: json.back?.token || json.data?.token, strategy: s.label };
        }
      }
    } catch(e) {
      console.warn(`[${s.label}] Erro: ${e.message}`);
    }
  }

  return null;
}

// Busca plantas com cookie ou token
async function getPlants(baseUrl, auth) {
  const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
  if (auth.cookie) headers['Cookie'] = auth.cookie;
  if (auth.token)  headers['token']  = auth.token;

  // Tenta diferentes endpoints de lista de plantas
  const plantEndpoints = [
    '/index/getPlantListTitle',
    '/PlantListAPI.do',
    '/newTwoPlant/getPlantList',
  ];

  for (const ep of plantEndpoints) {
    try {
      const res = await fetch(`${baseUrl}${ep}`, {
        method:  'POST',
        headers,
        body: new URLSearchParams({ currPage: '1', plantType: '-1' }).toString(),
      });

      const text = await res.text();
      let json;
      try { json = JSON.parse(text); } catch(e) { continue; }

      const plants =
        json.data?.datas      ||
        json.data?.plantList  ||
        json.back?.data       ||
        json.result?.data     ||
        json.obj?.datas       ||
        [];

      if (plants.length > 0) {
        console.log(`[getPlants] OK via ${ep}: ${plants.length} plantas`);
        return plants;
      }
    } catch(e) {
      console.warn(`[getPlants] ${ep} falhou: ${e.message}`);
    }
  }

  return [];
}

function normalizePlant(p) {
  const statusMap = { '1': 'OK', '0': 'NO_COMMUNICATION', '2': 'OFFLINE', '3': 'ALARMING' };
  const status    = statusMap[String(p.status)] || 'OFFLINE';
  const power     = parseFloat(p.nominalPower || p.peakPower || p.capacity || 0);

  return {
    id:           String(p.id || p.plantId || p.plant_id || Math.random()),
    name:         p.plantName || p.name || 'Planta Growatt',
    status,
    manufacturer: 'Growatt',
    power:        power.toFixed(2),
    energyDay:    parseFloat(p.todayEnergy  || p.eDay   || 0).toFixed(2),
    energyMonth:  parseFloat(p.monthEnergy  || p.eMonth || 0).toFixed(2),
    updated_at:   p.lastUpdateTime || new Date().toISOString(),
    created_at:   p.createTime     || new Date().toISOString(),
    alert:        status !== 'OK',
  };
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const user = process.env.GROWATT_USER;
  const pass = process.env.GROWATT_PASS;

  if (!user || !pass) {
    return res.status(500).json({
      ok: false,
      error: 'Credenciais não configuradas (GROWATT_USER / GROWATT_PASS)',
    });
  }

  const errors = [];

  for (const baseUrl of ENDPOINTS) {
    try {
      console.log(`[Growatt] Tentando ${baseUrl}...`);

      const auth = await tryLogin(baseUrl, user, pass);
      if (!auth) {
        errors.push(`${baseUrl}: nenhuma estratégia de login funcionou`);
        continue;
      }

      console.log(`[Growatt] Login OK (${auth.strategy}) em ${baseUrl}`);

      const plants = await getPlants(baseUrl, auth);
      const data   = plants.map(normalizePlant);

      return res.status(200).json({
        ok:       true,
        source:   'growatt',
        endpoint: baseUrl,
        strategy: auth.strategy,
        total:    data.length,
        data,
      });

    } catch(err) {
      errors.push(`${baseUrl}: ${err.message}`);
      console.warn(`[Growatt] Falhou em ${baseUrl}: ${err.message}`);
    }
  }

  return res.status(500).json({
    ok:     false,
    error:  'Todos os endpoints falharam',
    errors,
  });
};
