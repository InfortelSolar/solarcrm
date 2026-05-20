export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const source = req.query.source || 'gdash';

  // ── GDASH ─────────────────────────────────────────────────
  if (source === 'gdash') {
    const response = await fetch(
      'https://public-api.gdash.io/api/v1/solar/plants?apikey=3HnfW02lkFxhrG92G9Ek8'
    );
    const data = await response.json();
    return res.json(data);
  }

  // ── SOLIS ─────────────────────────────────────────────────
  if (source === 'solis') {
    try {
      const keyId     = process.env.SOLIS_KEY_ID;
      const keySecret = process.env.SOLIS_KEY_SECRET;
      const path      = '/v1/api/stationList';
      const body      = JSON.stringify({ pageNo: 1, pageSize: 1000 });

      const { createHash, createHmac } = await import('node:crypto');
      const contentMd5   = createHash('md5').update(body).digest('base64');
      const contentType  = 'application/json';
      const date         = new Date().toUTCString();
      const stringToSign = `POST\n${contentMd5}\n${contentType}\n${date}\n${path}`;
      const hmac         = createHmac('sha1', keySecret);
      hmac.update(stringToSign);
      const signature = hmac.digest('base64');

      const response = await fetch(`https://www.soliscloud.com:13333${path}`, {
        method: 'POST',
        headers: {
          'Content-Type':  contentType,
          'Content-MD5':   contentMd5,
          'Date':          date,
          'Authorization': `API ${keyId}:${signature}`,
        },
        body,
      });

      const data    = await response.json();
      const records = data?.data?.page?.records || [];
      const plants  = records.map(s => ({
        id:          String(s.id),
        name:        s.stationName,
        power:       s.capacity,
        powerNow:    s.power       || 0,
        energyDay:   s.dayEnergy   || 0,
        energyMonth: s.monthEnergy || 0,
        status:      s.stationStatus === 1 ? 'OK' : s.stationStatus === 2 ? 'ALARMING' : 'OFFLINE',
        manufacturer:'Solis',
        updated_at:  new Date().toISOString(),
      }));

      return res.json({ ok: true, total: plants.length, data: plants });

    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  res.status(400).json({ ok: false, error: 'Source inválido' });
}
