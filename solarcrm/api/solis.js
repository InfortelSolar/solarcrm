import crypto from 'crypto';

const KEY_ID     = process.env.SOLIS_KEY_ID;
const KEY_SECRET = process.env.SOLIS_KEY_SECRET;
const BASE_URL   = 'https://www.soliscloud.com:13333';

function solisAuth(path, body) {
  const contentMd5   = crypto.createHash('md5').update(body).digest('base64');
  const contentType  = 'application/json';
  const date         = new Date().toUTCString();
  const stringToSign = `POST\n${contentMd5}\n${contentType}\n${date}\n${path}`;
  const hmac         = crypto.createHmac('sha1', KEY_SECRET);
  hmac.update(stringToSign);
  const signature    = hmac.digest('base64');
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
  if (!res.ok) throw new Error(`Solis ${res.status}: ${await res.text()}`);
  return res.json();
}

function mapStatus(code) {
  if (code === 1) return 'OK';
  if (code === 2) return 'ALARMING';
  return 'OFFLINE';
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    const action = req.query.action || 'stations';

    if (action === 'stations') {
      const data    = await fetchSolis('/v1/api/stationList', { pageNo: 1, pageSize: 1000 });
      const records = data?.data?.page?.records || [];
      const plants  = records.map(s => ({
        id:          String(s.id),
        name:        s.stationName,
        power:       s.capacity,
        powerNow:    s.power    || 0,
        energyDay:   s.dayEnergy   || 0,
        energyMonth: s.monthEnergy || 0,
        status:      mapStatus(s.stationStatus),
        manufacturer:'Solis',
        updated_at:  new Date().toISOString(),
      }));
      return res.json({ ok: true, data: plants });
    }

    res.status(400).json({ ok: false, error: 'Ação inválida' });

  } catch (err) {
    console.error('[Solis]', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
}
