const crypto = require('crypto');
const https  = require('https');

const APP_KEY    = process.env.SOLPLANET_APP_KEY;
const APP_SECRET = process.env.SOLPLANET_APP_SECRET;
const TOKEN      = process.env.SOLPLANET_TOKEN;
const BASE_HOST  = 'gateway.isolarcloud.com';

function buildSign(params, secret) {
  const str = Object.keys(params).sort()
    .map(k => `${k}${params[k]}`).join('');
  return crypto.createHmac('sha256', secret)
    .update(str).digest('hex').toUpperCase();
}

function httpsPost(path, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const options = {
      hostname: BASE_HOST,
      path,
      method: 'POST',
      headers: {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'x-access-key':   APP_KEY,
      },
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const nonce     = crypto.randomBytes(8).toString('hex');
    const timestamp = String(Date.now());

    const signParams = {
      appkey:    APP_KEY,
      nonce,
      timestamp,
      token:     TOKEN,
    };
    const sign = buildSign(signParams, APP_SECRET);

    const body = {
      appkey:    APP_KEY,
      nonce,
      order:     '0',
      pageNum:   '1',
      pageSize:  '50',
      timestamp,
      token:     TOKEN,
      sign,
    };

    const data = await httpsPost('/pro/getPlanListPro', body);

    if (!data || data.success !== true) {
      return res.status(502).json({
        success: false,
        error: data?.detail || 'SolPlanet API error',
        raw: data,
      });
    }

    const plants = (data.data || []).map(p => ({
      id:        String(p.id),
      name:      p.name,
      address:   [p.address, p.city, p.province].filter(Boolean).join(', '),
      powerKw:   parseFloat(p.totalpower) || 0,
      status:    p.status === 1 ? 'normal' : p.status === 2 ? 'warning' : 'error',
      etodayKwh: parseFloat(p.etoday)  || 0,
      etotalKwh: parseFloat(p.etotal)  || 0,
      lastUpdate: p.createdt || '',
    }));

    return res.status(200).json({
      success: true,
      source:  'solplanet',
      total:   data.total || plants.length,
      plants,
    });

  } catch (err) {
    console.error('[api/solplanet]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};
