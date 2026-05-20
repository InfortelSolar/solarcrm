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
      const path      = '/v1/api/userStationList';

      const { createHash, createHmac } = await import('node:crypto');

      function makeHeaders(bodyStr) {
        const contentMd5   = createHash('md5').update(bodyStr).digest('base64');
        const contentType  = 'application/json';
        const date         = new Date().toUTCString();
        const stringToSign = `POST\n${contentMd5}\n${contentType}\n${date}\n${path}`;
        const hmac         = createHmac('sha1', keySecret);
        hmac.update(stringToSign);
        const signature = hmac.digest('base64');
        return {
          'Content-Type':  contentType,
          'Content-MD5':   contentMd5,
          'Date':          date,
          'Authorization': `API ${keyId}:${signature}`,
        };
      }

      // Busca primeira página para saber o total
      const body1   = JSON.stringify({ pageNo: 1, pageSize: 100 });
      const resp1   = await fetch(`https://www.soliscloud.com:13333${path}`, {
        method: 'POST', headers: makeHeaders(body1), body: body1,
      });
      const data1   = await resp1.json();
      const total   = data1?.data?.page?.total || 0;
      let records   = data1?.data?.page?.records || [];

      // Se tiver mais páginas, busca o restante
      if (total > 100) {
        const totalPages = Math.ceil(total / 100);
        for (let page = 2; page <= totalPages; page++) {
          const bodyN  = JSON.stringify({ pageNo: page, pageSize: 100 });
          const respN  = await fetch(`https://www.soliscloud.com:13333${path}`, {
            method: 'POST', headers: makeHeaders(bodyN), body: bodyN,
          });
          const dataN  = await respN.json();
          const recs   = dataN?.data?.page?.records || [];
          records      = records.concat(recs);
        }
      }

      const plants = records.map(s => ({
        id:          String(s.id),
        name:        s.stationName,
        power:       s.capacity        || 0,
        powerNow:    s.power           || 0,
        energyDay:   s.dayEnergy       || 0,
        energyMonth: s.monthEnergy     || 0,
        energyTotal: s.allEnergy       || 0,
        status:      s.stationStatus === 1 ? 'OK' : s.stationStatus === 2 ? 'ALARMING' : 'OFFLINE',
        manufacturer:'Solis',
        updated_at:  new Date().toISOString(),
      }));

      return res.json({ ok: true, total: plants.length, data: plants });

    } catch (err) {
      console.error('[Solis]', err.message);
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  res.status(400).json({ ok: false, error: 'Source inválido' });
}
