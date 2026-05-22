// js/fronius.js — Integração Fronius Solar.web para o SolarCRM
// Padrão idêntico ao gdash.js: popula DB.clientes, DB.inversores, DB.alertas

const Fronius = (() => {

  function plantToCliente(p) {
    const st = p.error ? 'warn' : 'ok';
    const initials = p.name.split(' ').slice(0,2).map(w => w[0] || '').join('').toUpperCase();
    const bgMap  = { ok: '#E1F5EE', warn: '#FAEEDA', err: '#FCEBEB' };
    const corMap = { ok: '#0F6E56', warn: '#854F0B', err: '#A32D2D' };
    const power      = parseFloat(p.peakPower_kWp) || 0;
    const geracaoHoje = parseFloat(p.eToday_kWh)   || 0;
    const meta        = Math.round(power * 110);
    const perf        = meta > 0 ? Math.min(100, Math.round((geracaoHoje / meta) * 100)) : 0;

    return {
      id: p.id, iniciais: initials,
      avBg: bgMap[st], avCor: corMap[st],
      nome: p.name, tipo: 'Solar',
      endereco: p.address?.city || '', email: '', whats: '',
      dataInstalacao: '',
      tarifa: 0.82,
      potencia: power,
      paineis: Math.round(power / 0.55),
      inversor: 'Fronius',
      status: st,
      statusLabel: st === 'err' ? 'Crítico' : st === 'warn' ? 'Offline' : 'Normal',
      geracaoHoje,
      geracaoMes: geracaoHoje, // aggdata diário; mês seria outro endpoint
      metaMes: meta,
      hist12: [0,0,0,0,0,0,0,0,0,0,0,0],
      performance: perf,
      relatoriosEnviados: [],
    };
  }

  function plantToInversor(p) {
    const st = p.error ? 'warn' : 'ok';
    return {
      id: p.id,
      sigla: 'FRO',
      bgCol: '#E8F4FD', txtCol: '#1565C0',
      modelo: `Fronius ${parseFloat(p.peakPower_kWp || 0).toFixed(2)} kWp`,
      cliente: p.name,
      serial: p.id.slice(0,8).toUpperCase(),
      api: 'Fronius Solar.web',
      status: st,
      statusLabel: st === 'ok' ? 'Online' : 'Offline',
      geracaoHoje: parseFloat(p.eToday_kWh) || 0,
      temp: null,
      potencia: parseFloat(p.powerNow_W / 1000) || 0,
    };
  }

  function plantToAlerta(p) {
    return {
      id: p.id, tipo: 'warn',
      icon: 'ti-alert-triangle',
      titulo: `${p.name}: Fronius offline ou com erro`,
      detalhe: p.error || 'Sem dados de geração',
      acao: 'Diagnosticar',
    };
  }

  async function load() {
    try {
      const res = await fetch('/api/fronius');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const plants = data.plants || [];

      const clientes  = plants.map(plantToCliente);
      const inversores = plants.map(plantToInversor);
      const alertas   = plants.filter(p => p.error).map(plantToAlerta);

      // Acumula sobre o que Solis/SolPlanet já carregaram
      DB.clientes   = [...(DB.clientes   || []), ...clientes];
      DB.inversores = [...(DB.inversores || []), ...inversores];
      DB.alertas    = [...(DB.alertas    || []), ...alertas];

      // Soma KPIs
      const totalHoje = plants.reduce((s, p) => s + (parseFloat(p.eToday_kWh) || 0), 0);
      DB.dashKpis.clientesAtivos = (DB.dashKpis.clientesAtivos || 0) + plants.length;
      DB.dashKpis.alertasAtivos  = (DB.dashKpis.alertasAtivos  || 0) + alertas.length;
      DB.dashKpis.geracaoHoje    = parseFloat(((DB.dashKpis.geracaoHoje || 0) + totalHoje).toFixed(2));
      DB.dashKpis.economiaMes    = Math.round((DB.dashKpis.geracaoHoje || 0) * 0.82);

      console.log('[Fronius] OK:', {
        total:   plants.length,
        alertas: alertas.length,
        energyDay: totalHoje.toFixed(1) + ' kWh',
      });

    } catch (err) {
      console.warn('[Fronius] Falha ao carregar:', err.message);
      // Não trava o app
    }
  }

  return { load };
})();
