// api/fronius.js — Proxy Fronius Solar.web (SWQAPI)
// Variáveis de ambiente necessárias na Vercel:
//   FRONIUS_ACCESS_KEY_ID     → AccessKeyId gerado no Solar.web > User Settings > REST API
//   FRONIUS_ACCESS_KEY_VALUE  → AccessKeyValue correspondente
//   FRONIUS_USER              → e-mail de login do Solar.web
//   FRONIUS_PASS              → senha do Solar.web

const SWQAPI = "https://swqapi.solarweb.com";

let _tokenCache = { token: null, expiresAt: 0 };

async function getJwt() {
  const now = Date.now();
  if (_tokenCache.token && now < _tokenCache.expiresAt) {
    return _tokenCache.token;
  }

  const res = await fetch(`${SWQAPI}/iam/jwt`, {
    method: "POST",
    headers: {
      "AccessKeyId": process.env.FRONIUS_ACCESS_KEY_ID,
      "AccessKeyValue": process.env.FRONIUS_ACCESS_KEY_VALUE,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      UserId: process.env.FRONIUS_USER,
      Password: process.env.FRONIUS_PASS,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Falha na autenticação Fronius ${res.status}: ${body}`);
  }

  const data = await res.json();
  const jwt = data.jwtToken;

  _tokenCache = { token: jwt, expiresAt: now + 55 * 60 * 1000 };
  return jwt;
}

// AccessKeyId + AccessKeyValue obrigatórios em TODOS os requests
async function swqGet(path, jwt) {
  const res = await fetch(`${SWQAPI}${path}`, {
    headers: {
      "Authorization": `Bearer ${jwt}`,
      "AccessKeyId": process.env.FRONIUS_ACCESS_KEY_ID,
      "AccessKeyValue": process.env.FRONIUS_ACCESS_KEY_VALUE,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`SWQAPI ${path} → ${res.status}: ${body}`);
  }
  return res.json();
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  const debug = req.query.debug === "1";

  try {
    const jwt = await getJwt();

    const pvList = await swqGet("/pvsystems", jwt);
    const systems = pvList.pvSystems ?? [];

    if (debug) {
      return res.status(200).json({ jwt: jwt.slice(0, 20) + "…", systems });
    }

    const now = new Date();
    const year  = now.getFullYear();
    const month = now.getMonth() + 1;
    const day   = now.getDate();

    const plants = await Promise.all(
      systems.map(async (sys) => {
        const id = sys.pvSystemId;
        try {
          const aggDay = await swqGet(
            `/pvsystems/${id}/aggdata/years/${year}/months/${month}/days/${day}`,
            jwt
          );

          let powerNow = null;
          try {
            const flow = await swqGet(`/pvsystems/${id}/energyflow`, jwt);
            powerNow = flow?.site?.P_PV ?? flow?.inverters?.[0]?.P ?? null;
          } catch (_) {}

          const eToday =
            aggDay?.data?.[0]?.channels?.find(
              (c) => c.channelName === "EnergyProductionTotal"
            )?.value ?? null;

          return {
            id,
            name: sys.name ?? sys.pvSystemId,
            status: sys.status ?? "unknown",
            powerNow_W: powerNow,
            eToday_Wh: eToday,
            eToday_kWh: eToday !== null ? parseFloat((eToday / 1000).toFixed(2)) : null,
            peakPower_kWp: sys.peakPower ?? null,
            address: sys.address ?? null,
            timezone: sys.timezone ?? null,
          };
        } catch (err) {
          return { id, name: sys.name ?? id, error: err.message };
        }
      })
    );

    return res.status(200).json({
      source: "fronius",
      count: plants.length,
      timestamp: new Date().toISOString(),
      plants,
    });
  } catch (err) {
    console.error("[fronius]", err.message);
    return res.status(500).json({ error: err.message });
  }
};
