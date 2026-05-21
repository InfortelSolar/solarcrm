const crypto = require('crypto');
const https  = require('https');

const APP_KEY    = process.env.SOLPLANET_APP_KEY;
const APP_SECRET = process.env.SOLPLANET_APP_SECRET;
const TOKEN      = process.env.SOLPLANET_TOKEN;
const BASE_HOST  = 'gateway.isolarcloud.com';

function sign(params, secret) {
  const sorted = Object.keys(params).sort()
    .map(k => `${k}${params[k]}`).join('');
  return crypto.createHmac('sha256', secret)
    .update(sorted).digest('hex').toUpperCase();
}

function post(path, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const options = {
      hostname: BASE_HOST,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'x-access-key': APP_KEY,
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
    const action = req.query.action || 'summary';

    if (action === 'summary') {
      const now = Date.now();
      const params = {
        appkey: APP_KEY,
        token:  TOKEN,
        lang:   'pt_BR',
        time:   String(now),
      };
      params.sign = sign(params, APP_SECRET);

      const data = await post('/openapi/getPsList', {
        ...params,
        page_size: 100,
        page_no:   1,
      });

      if (!data || data.result_code !== '1') {
        return res.status(502).json({
          success: false,
          error: data?.result_msg || 'SolPlanet API error',
        });
      }

      const plants = (data.result_data?.pageList || []).map(p => ({
        id:         String(p.ps_id),
        name:       p.ps_name,
        address:    p.address || '',
        powerKw:    parseFloat(p.designed_capacity) || 0,
        status:     p.ps_status === 1 ? 'normal' : p.ps_status === 2 ? 'warning' : 'error',
        etodayKwh:  parseFloat(p.today_energy) || 0,
        etotalKwh:  parseFloat(p.total_energy)  || 0,
        lastUpdate: p.last_update_time || '',
      }));

      return res.status(200).json({ success: true, plants });
    }

    return res.status(400).json({ success: false, error: 'Unknown action' });

  } catch (err) {
    console.error('[api/solplanet]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
};
