// ============================================================
//  SolarCRM — Proxy Growatt ShineServer API (Vercel Serverless)
//  Autenticação via Token (32 chars) conforme documentação oficial
// ============================================================

const ENDPOINTS = [
  'https://server.growatt.com',
  'https://openapi.growatt.com',
  'https://oss.growatt.com',
];

// Busca lista de plantas usando token
async function getPlantList(baseUrl, token, username) {
  const endpoints = [
    { url: `${baseUrl}/PlantListAPI.do`,           body: { token, currPage: '1' } },
    { url: `${baseUrl}/index/getPlantListTitle`,   body: { token, currPage: '1' } },
    { url: `${baseUrl}/newTwoPlant/getPlantList`,  body: { token, currPage: '1' } },
  ];

  // Se tiver username, inclui nas tentativas
  if (username) {
    endpoints.unshift(
      { url: `${baseUrl}/PlantListAPI.do`, body: { token, currPage: '1', userId: username } }
    );
  }

  for (const ep of endpoints) {
    try {
      const res = await fetch(ep.url, {
        method:  'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'token': token,
        },
        body: new URLSearchParams(ep.body).toString(),
      });

      if (!res.ok) continue;

      const text = await res.text();
      let json;
      try { json = JSON.parse(text); } catch(e) { continue; }

      console.log(`[getPlantList] ${ep.url} →`, JSON.stringify(json).slice(0, 200));

      // Trata diferentes estruturas de resposta
      const plants =
        json.data?.datas      ||
        json.data?.plantList  ||
        json.back?.data       ||
        json.result?.data     ||
        json.obj?.datas       ||
        (Array.isArray(json.data) ? json.data : null) ||
        [];

      if (plants.length > 0) {
        console.log(`[Growatt] ${plants.length} plantas via ${ep.url}`);
        return { plants, endpoint: ep.url };
      }

      // Sem plantas mas resposta válida — pode ser conta vazia
      if (json.result === 1 || json.success === true) {
        console.log(`[Growatt] Login OK mas sem plantas via ${ep.url}`);
        return { plants: [], endpoint: ep.url };
      }

    } catch(e) {
      console.warn(`[getPlantList] ${ep.url} erro: ${e.message}`);
    }
  }

  return null;
}

// Normaliza planta para formato padrão SolarCRM
function normalizePlant(p) {
  const statusMap = {
    '1': 'OK',
    '0': 'NO_COMMUNICATION',
    '2': 'OFFLINE',
    '3': 'ALARMING',
  };
  const rawStatus = String(p.status ?? p.plantStatus ?? '2');
  const status    = statusMap[rawStatus] || 'OFFLINE';
  const power     = parseFloat(p.nominalPower || p.peakPower || p.capacity || p.power || 0);

  return {
    id:           String(p.id || p.plantId || p.plant_id || Math.random()),
    name:         p.plantName || p.name || 'Planta Growatt',
    status,
    manufacturer: 'Growatt',
    power:        power.toFixed(2),
    energyDay:    parseFloat(p.todayEnergy  || p.eDay    || p.pac || 0).toFixed(2),
    energyMonth:  parseFloat(p.monthEnergy  || p.eMonth  || 0).toFixed(2),
    energyTotal:  parseFloat(p.totalEnergy  || p.eTotal  || 0).toFixed(2),
    updated_at:   p.lastUpdateTime || p.updateTime || new Date().toISOString(),
    created_at:   p.createTime     || p.createDate || new Date().toISOString(),
    alert:        status !== 'OK',
  };
}

// Handler principal Vercel
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const token    = process.env.GROWATT_TOKEN;
  const username = process.env.GROWATT_USER; // opcional, ajuda em alguns endpoints

  if (!token) {
    return res.status(500).json({
      ok:    false,
      error: 'Token não configurado. Adicione GROWATT_TOKEN nas variáveis de ambiente da Vercel.',
    });
  }

  const errors = [];

  for (const baseUrl of ENDPOINTS) {
    try {
      console.log(`[Growatt] Tentando ${baseUrl}...`);

      const result = await getPlantList(baseUrl, token, username);

      if (!result) {
        errors.push(`${baseUrl}: nenhum endpoint de plantas respondeu`);
        continue;
      }

      const data = result.plants.map(normalizePlant);

      return res.status(200).json({
        ok:       true,
        source:   'growatt',
        endpoint: result.endpoint,
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
    hint:   'Verifique se o GROWATT_TOKEN está correto e se o token foi aprovado pela Growatt',
  });
};
