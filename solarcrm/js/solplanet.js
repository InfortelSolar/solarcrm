/**
 * js/solplanet.js — Integração SolPlanet para o SolarCRM
 * Segue o mesmo padrão do js/gdash.js (Solis)
 */

const SolPlanet = (() => {
  let _cache = null;
  let _cacheTime = 0;
  const CACHE_TTL = 5 * 60 * 1000;

  async function fetchPlants() {
    const now = Date.now();
    if (_cache && now - _cacheTime < CACHE_TTL) return _cache;

    const res = await fetch('/api/solplanet?action=summary');
    if (!res.ok) throw new Error(`SolPlanet API error: ${res.status}`);
    const json = await res.json();
    if (!json.success) throw new Error('SolPlanet retornou success=false');

    _cache     = json.plants;
    _cacheTime = now;
    return _cache;
  }

  function plantToCliente(p) {
    const st = p.status === 'normal' ? 'ok' : p.status === 'warning' ? 'warn' : 'err';
    const initials = (p.name || '').split(' ').slice(0,2).map(w => w[0] || '').join('').toUpperCase();
    const bgMap  = { ok: '#E1F5EE', warn: '#FAEEDA', err: '#FCEBEB' };
    const corMap = { ok: '#0F6E56', warn: '#854F0B', err: '#A32D2D' };
    const power  = parseFloat(p.powerKw) || 0;
    const meta   = Math.round(power * 110);
    const perf   = meta > 0 ? Math.min(100, Math.round((p.etodayKwh * 30 / meta) * 100)) : 0;

    return {
      id: p.id,
      iniciais: initials,
      avBg: bgMap[st],
      avCor: corMap[st],
      nome: p.name,
      tipo: 'Solar',
      endereco: p.address || '',
      email: '', whats: '',
      dataInstalacao: '',
      tarifa: 0.82,
      potencia: power,
      paineis: Math.round(power / 0.55),
      inversor: 'SolPlanet',
      status: st,
      statusLabel: st === 'err' ? 'Crítico' : st === 'warn' ? 'Offline' : 'Normal',
      geracaoHoje:  parseFloat(p.etodayKwh)  || 0,
      geracaoMes:   parseFloat(p.etotalKwh)  || 0,
      metaMes: meta,
      hist12: [0,0,0,0,0,0,0,0,0,0,0,0],
      performance: perf,
      relatoriosEnviados: [],
      fonte: 'solplanet',
    };
  }

  function plantToInversor(p, idx) {
    const st = p.status === 'normal' ? 'ok' : p.status === 'warning' ? 'warn' : 'err';
    return {
      id: p.id,
      sigla: 'SP',
      bgCol: '#EEF2FF', txtCol: '#3730A3',
      modelo: `SolPlanet ${parseFloat(p.powerKw).toFixed(2)} kWp`,
      cliente: p.name,
      serial: (p.id || '').slice(0,8).toUpperCase(),
      api: 'SolPlanet Cloud',
      status: st,
      statusLabel: st === 'ok' ? 'Online' : st === 'err' ? 'Alarme' : 'Offline',
      geracaoHoje: parseFloat(p.etodayKwh) || 0,
      temp: st === 'ok' ? (34 + (idx % 10)) : null,
      fonte: 'solplanet',
    };
  }

  function plantToAlerta(p) {
    const tipo = p.status === 'error' ? 'err' : 'warn';
    return {
      id: p.id, tipo,
      icon: tipo === 'err' ? 'ti-alert-circle' : 'ti-alert-triangle',
      titulo: `${p.name}: ${p.status === 'error' ? 'Alarme ativo' : 'Sistema offline'}`,
      detalhe: `SolPlanet · ${p.powerKw} kWp · ${p.lastUpdate || ''}`,
      acao: 'Diagnosticar',
    };
  }

  async function load() {
    try {
      const plants = await fetchPlants();

      let online = 0, offline = 0, warning = 0;
      let totalEnergyDay = 0, totalEnergyMonth = 0;
      const alerts = [];

      for (const p of plants) {
        if (p.status === 'normal')       online++;
        else if (p.status === 'warning') warning++;
        else                             offline++;

        totalEnergyDay   += parseFloat(p.etodayKwh) || 0;
        totalEnergyMonth += parseFloat(p.etotalKwh) || 0;

        if (p.status !== 'normal') alerts.push(p);
      }

      DB.clientes   = [...(DB.clientes   || []), ...plants.map(p => plantToCliente(p))];
      DB.inversores = [...(DB.inversores || []), ...plants.map((p, i) => plantToInversor(p, i))];
      DB.alertas    = [...(DB.alertas    || []), ...alerts.map(p => plantToAlerta(p))];

      DB.dashKpis.clientesAtivos = (DB.dashKpis.clientesAtivos || 0) + plants.length;
      DB.dashKpis.alertasAtivos  = (DB.dashKpis.alertasAtivos  || 0) + alerts.length;
      DB.dashKpis.geracaoHoje    = parseFloat(((DB.dashKpis.geracaoHoje || 0) + totalEnergyDay).toFixed(2));
      DB.dashKpis.economiaMes    = (DB.dashKpis.economiaMes || 0) + Math.round(totalEnergyMonth * 0.82);

      console.log('[SolPlanet] OK:', {
        total:    plants.length,
        online, offline, warning,
        alertas:  alerts.length,
        energyDay: totalEnergyDay.toFixed(1) + ' kWh',
      });

    } catch (err) {
      console.warn('[SolPlanet] Falha ao carregar:', err.message);
    }
  }

  return { fetchPlants, plantToCliente, plantToInversor, plantToAlerta, load };
})();
