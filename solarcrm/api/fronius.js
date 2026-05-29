// api/fronius.js — Proxy Fronius Solar.web (SWQAPI)

const SWQAPI = 'https://swqapi.solarweb.com';
let _tokenCache = { token: null, expiresAt: 0 };

async function getJwt() {
  const now = Date.now();
  if (_tokenCache.token && now < _tokenCache.expiresAt) return _tokenCache.token;
  const res = await fetch(`${SWQAPI}/iam/jwt`, {
    method: 'POST',
    headers: {
      'AccessKeyId':    process.env.FRONIUS_ACCESS_KEY_ID,
      'AccessKeyValue': process.env.FRONIUS_ACCESS_KEY_VALUE,
      'Content-Type':   'application/json',
    },
    body: JSON.stringify({ UserId: process.env.FRONIUS_USER, Password: process.env.FRONIUS_PASS }),
  });
  if (!res.ok) throw new Error(`Fronius auth failed ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const jwt  = data.jwtToken;
  _tokenCache = { token: jwt, expiresAt: now + 55 * 60 * 1000 };
  return jwt;
}

async function swqGet(path, jwt) {
  const res = await fetch(`${SWQAPI}${path}`, {
    headers: {
      'Authorization': `Bearer ${jwt}`,
      'AccessKeyId':    process.env.FRONIUS_ACCESS_KEY_ID,
      'AccessKeyValue': process.env.FRONIUS_ACCESS_KEY_VALUE,
      'Content-Type':   'application/json',
    },
  });
  if (!res.ok) throw new Error(`SWQAPI ${path} → ${res.status}: ${await res.text()}`);
  return res.json();
}

function getStatusFromLastImport(lastImport) {
  if (!lastImport) return 'OFFLINE';
  const hoursAgo = (Date.now() - new Date(lastImport)) / 1000 / 60 / 60;
  return hoursAgo <= 24 ? 'OK' : 'OFFLINE';
}

async function getFroniusAlarms(pvSystemId, jwt) {
  try {
    const data = await swqGet(`/pvsystems/${pvSystemId}/messages`, jwt);
    const messages = data?.messages || data?.data || [];
    return messages
      .filter(m => m.messageType === 'Error' || m.messageType === 'Warning' || m.severity === 'Error')
      .slice(0, 10)
      .map(m => ({
        code:    m.messageCode || m.code || '—',
        message: m.message || m.text || m.description || 'Sem descrição',
        advice:  m.advice || m.solution || 'Verifique o display do inversor',
        level:   m.messageType || m.severity || '—',
        time:    m.logDateTime || m.timestamp || null,
      }));
  } catch(_) { return []; }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── Alarmes ───────────────────────────────────────────────
  if (req.query.alarms === '1' && req.query.pvSystemId) {
    try {
      const jwt = await getJwt();
      const alarms = await getFroniusAlarms(req.query.pvSystemId, jwt);
      return res.status(200).json({ ok: true, alarms });
    } catch(err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  // ── Histórico por dia ─────────────────────────────────────
  if (req.query.pvSystemId && req.query.day) {
    try {
      const jwt = await getJwt();
      const { pvSystemId: id, year: y, month: m, day: d } = req.query;
      const data = await swqGet(`/pvsystems/${id}/aggdata/years/${y}/months/${m}/days/${d}`, jwt);
      const channels = data?.data?.channels || [];
      const ch  = channels.find(c => c.channelName === 'EnergyProductionTotal');
      const val = ch?.values?.[String(d)] ?? 0;
      return res.status(200).json({ ok: true, eToday_kWh: parseFloat((val / 1000).toFixed(2)) });
    } catch(err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  // ── Histórico por mês ─────────────────────────────────────
  if (req.query.pvSystemId && req.query.month && req.query.year && !req.query.day) {
    try {
      const jwt = await getJwt();
      const { pvSystemId: id, year: y, month: m } = req.query;
      const data = await swqGet(`/pvsystems/${id}/aggdata/years/${y}/months/${m}`, jwt);
      const channels = data?.data?.channels || [];
      const ch = channels.find(c => c.channelName === 'EnergyProductionTotal');
      const total = ch ? Object.values(ch.values || {}).reduce((s, v) => s + v, 0) : 0;
      return res.status(200).json({ ok: true, eMonth_kWh: parseFloat((total / 1000).toFixed(2)) });
    } catch(err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  // ── Debug ─────────────────────────────────────────────────
  const debug = req.query.debug === '1';
  if (req.query.debug === '2' && req.query.pvSystemId) {
    try {
      const jwt = await getJwt();
      const id = req.query.pvSystemId;
      const now = new Date();
      const year = now.getFullYear(), month = now.getMonth() + 1, day = now.getDate();
      const aggDay = await swqGet(`/pvsystems/${id}/aggdata/years/${year}/months/${month}/days/${day}`, jwt).catch(e => ({ error: e.message }));
      const flow   = await swqGet(`/pvsystems/${id}/energyflow`, jwt).catch(e => ({ error: e.message }));
      const detail = await swqGet(`/pvsystems/${id}`, jwt).catch(e => ({ error: e.message }));
      return res.status(200).json({ aggDay, flow, detail });
    } catch(err) {
      return res.status(500).json({ error: err.message });
    }
  }

  try {
    const jwt = await getJwt();
    const pvList  = await swqGet('/pvsystems', jwt);
    const systems = pvList.pvSystems ?? [];

    if (debug) return res.status(200).json({ jwt: jwt.slice(0, 20) + '…', systems });

    const now = new Date();
    const year = now.getFullYear(), month = now.getMonth() + 1, day = now.getDate();

    const plants = await Promise.all(systems.map(async (sys) => {
      const id     = sys.pvSystemId;
      const status = getStatusFromLastImport(sys.lastImport);
      try {
        const aggDay   = await swqGet(`/pvsystems/${id}/aggdata/years/${year}/months/${month}/days/${day}`, jwt);
        const channels = aggDay?.data?.channels || [];
        const eChannel = channels.find(c => c.channelName === 'EnergyProductionTotal');
        const eToday_Wh = eChannel?.values?.[String(day)] ?? null;

        let powerNow = null;
        try {
          const flow = await swqGet(`/pvsystems/${id}/energyflow`, jwt);
          powerNow = flow?.site?.P_PV ?? flow?.inverters?.[0]?.P ?? null;
        } catch(_) {}

        return {
          id, name: sys.name ?? id, status, powerNow_W: powerNow,
          eToday_Wh, eToday_kWh: eToday_Wh !== null ? parseFloat((eToday_Wh/1000).toFixed(2)) : null,
          peakPower_kWp: sys.peakPower ? parseFloat((sys.peakPower/1000).toFixed(2)) : null,
          address: sys.address ?? null, lastImport: sys.lastImport ?? null,
        };
      } catch(err) {
        return {
          id, name: sys.name ?? id, status, error: err.message,
          peakPower_kWp: sys.peakPower ? parseFloat((sys.peakPower/1000).toFixed(2)) : null,
          lastImport: sys.lastImport ?? null,
        };
      }
    }));

    return res.status(200).json({ source: 'fronius', count: plants.length, timestamp: new Date().toISOString(), plants });

  } catch(err) {
    console.error('[fronius]', err.message);
    return res.status(500).json({ error: err.message });
  }
};
