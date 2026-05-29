const Solis = (() => {
  let _cache = null;
  let _cacheTime = 0;
  const CACHE_TTL = 5 * 60 * 1000;

  async function fetchPlants() {
    const now = Date.now();
    if (_cache && now - _cacheTime < CACHE_TTL) return _cache;

    const res  = await fetch('/api/solis');
    if (!res.ok) throw new Error(`Solis API error: ${res.status}`);
    const json = await res.json();
    if (!json.ok) throw new Error('Solis retornou ok=false');

    _cache     = json.data;
    _cacheTime = now;
    return _cache;
  }

  function calcMetrics(plants) {
    const metrics = {
      total: plants.length,
      online: 0, offline: 0, alarming: 0, noComm: 0,
      totalPower: 0, onlinePower: 0,
      totalEnergyDay: 0, totalEnergyMonth: 0,
      alerts: [], byManufacturer: {}, plants,
    };
    for (const p of plants) {
      const status = (p.status || '').toUpperCase();
      const power  = parseFloat(p.power) || 0;
      metrics.totalPower       += power;
      metrics.totalEnergyDay   += parseFloat(p.energyDay)   || 0;
      metrics.totalEnergyMonth += parseFloat(p.energyMonth) || 0;

      if (status === 'OK')                  { metrics.online++; metrics.onlinePower += power; }
      else if (status === 'OFFLINE')          metrics.offline++;
      else if (status === 'ALARMING')         metrics.alarming++;
      else if (status === 'NO_COMMUNICATION') metrics.noComm++;

      if (p.alert || status !== 'OK') metrics.alerts.push(p);
      const mfr = p.manufacturer || 'Outros';
      metrics.byManufacturer[mfr] = (metrics.byManufacturer[mfr] || 0) + 1;
    }
    return metrics;
  }

  function plantToCliente(p) {
    const status = (p.status || '').toUpperCase();
    const st = status === 'OK' ? 'ok' : 'warn';
    const initials = p.name.split(' ').slice(0,2).map(w => w[0] || '').join('').toUpperCase();
    const bgMap = { ok: '#E1F5EE', warn: '#FAEEDA', err: '#FCEBEB' };
    const corMap = { ok: '#0F6E56', warn: '#854F0B', err: '#A32D2D' };
    const power       = parseFloat(p.power) || 0;
    const geracaoHoje = parseFloat(p.energyDay)   || 0;
    const geracaoMes  = parseFloat(p.energyMonth) || 0;
    const meta        = Math.round(power * 110);
    const perf        = meta > 0 ? Math.min(100, Math.round((geracaoMes / meta) * 100)) : 0;

    return {
      id: p.id, iniciais: initials,
      avBg: bgMap[st], avCor: corMap[st],
      nome: p.name, tipo: 'Solar',
      endereco: '', email: '', whats: '',
      dataInstalacao: p.created_at ? new Date(p.created_at).toLocaleDateString('pt-BR') : '',
      tarifa: 0.82,
      potencia: power,
      paineis: Math.round(power / 0.55),
      inversor: p.manufacturer || '—',
      status: st,
      statusLabel: st === 'ok' ? 'Normal' : 'Offline',
      geracaoHoje,
      geracaoMes,
      metaMes: meta,
      hist12: [0,0,0,0,0,0,0,0,0,0,0,0],
      performance: perf,
      relatoriosEnviados: [],
      updated_at: p.updated_at,
      alarmCount: p.alarmCount || 0,
      inverterOnlineCount: p.inverterOnlineCount || 0,
      inverterCount: p.inverterCount || 0,
    };
  }

  function plantToInversor(p, idx) {
    const status = (p.status || '').toUpperCase();
    const st = status === 'OK' ? 'ok' : 'warn';
    return {
      id: p.id,
      sigla: 'SOL',
      bgCol: '#E1F5EE', txtCol: '#0F6E56',
      modelo: `Solis ${parseFloat(p.power).toFixed(2)} kWp`,
      cliente: p.name,
      serial: p.id.slice(0,8).toUpperCase(),
      api: 'Solis Cloud',
      status: st,
      statusLabel: st === 'ok' ? 'Online' : 'Offline',
      geracaoHoje: parseFloat(p.energyDay) || 0,
      temp: st === 'ok' ? (35 + (idx % 10)) : null,
    };
  }

  function plantToAlerta(p) {
    const alarmCount          = parseInt(p.alarmCount || 0);
    const inverterOnlineCount = parseInt(p.inverterOnlineCount || 0);
    const inverterCount       = parseInt(p.inverterCount || 0);

    return {
      id: p.id,
      tipo: 'warn',
      tipoAlerta: 'offline',
      icon: 'ti-wifi-off',
      titulo: `${p.name}: Sistema offline`,
      detalhe: `${p.manufacturer} · ${p.power} kWp · ${new Date(p.updated_at).toLocaleString('pt-BR')}`,
      acao: 'Diagnosticar',
      alarmCount,
      inverterOnlineCount,
      inverterCount,
    };
  }

  async function load() {
    try {
      const plants = await fetchPlants();
      const m      = calcMetrics(plants);

      DB.clientes   = plants.map((p)    => plantToCliente(p));
      DB.inversores = plants.map((p, i) => plantToInversor(p, i));
      DB.alertas    = m.alerts.map((p)  => plantToAlerta(p));

      DB.dashKpis.clientesAtivos = (DB.dashKpis.clientesAtivos || 0) + m.total;
      DB.dashKpis.alertasAtivos  = (DB.dashKpis.alertasAtivos  || 0) + m.alerts.length;
      DB.dashKpis.geracaoHoje    = parseFloat(((DB.dashKpis.geracaoHoje || 0) + m.totalEnergyDay).toFixed(2));
      DB.dashKpis.economiaMes    = Math.round(((DB.dashKpis.economiaMes || 0) + m.totalEnergyMonth * 0.82));

      const base = m.totalEnergyDay;
      DB.dashKpis.geracaoDias = [
        Math.round(base * 0.91), Math.round(base * 0.95), Math.round(base * 1.02),
        Math.round(base * 0.98), Math.round(base * 1.05), Math.round(base * 0.72),
        Math.round(base * 0.68),
      ];

      const eco = DB.dashKpis.economiaMes;
      DB.dashKpis.economiaMeses = [
        Math.round(eco * 0.78), Math.round(eco * 0.82), Math.round(eco * 0.88),
        Math.round(eco * 0.94), Math.round(eco),
      ];

      await DB.loadClientesExtra();

      console.log('[Solis] OK:', {
        total:    m.total,
        online:   m.online,
        offline:  m.offline,
        alarming: m.alarming,
        alertas:  m.alerts.length,
        energyDay:   m.totalEnergyDay.toFixed(1) + ' kWh',
        energyMonth: m.totalEnergyMonth.toFixed(1) + ' kWh',
      });

    } catch (err) {
      console.warn('[Solis] Falha ao carregar:', err.message);
      DB.clientes   = DB.clientes   || [];
      DB.inversores = DB.inversores || [];
      DB.alertas    = DB.alertas    || [];
      DB.dashKpis.clientesAtivos = DB.dashKpis.clientesAtivos || 0;
      DB.dashKpis.alertasAtivos  = DB.dashKpis.alertasAtivos  || 0;
      DB.dashKpis.geracaoHoje    = DB.dashKpis.geracaoHoje    || 0;
      DB.dashKpis.economiaMes    = DB.dashKpis.economiaMes    || 0;
      DB.dashKpis.geracaoDias    = DB.dashKpis.geracaoDias    || [0,0,0,0,0,0,0];
      DB.dashKpis.economiaMeses  = DB.dashKpis.economiaMeses  || [0,0,0,0,0];
    }
  }

  return { fetchPlants, calcMetrics, plantToCliente, plantToInversor, plantToAlerta, load };
})();
