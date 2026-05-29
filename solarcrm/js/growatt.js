// js/growatt.js — Integração Growatt para o SolarCRM

const Growatt = (() => {

  function plantToCliente(p) {
    const status = (p.status || '').toUpperCase();
    const st = status === 'OK' ? 'ok' : status === 'ALARMING' ? 'err' : 'warn';
    const initials = p.name.split(' ').slice(0,2).map(w => w[0] || '').join('').toUpperCase();
    const bgMap  = { ok: '#E1F5EE', warn: '#FAEEDA', err: '#FCEBEB' };
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
      inversor: 'Growatt',
      status: st,
      statusLabel: st === 'ok' ? 'Normal' : st === 'err' ? 'Crítico' : 'Offline',
      geracaoHoje,
      geracaoMes,
      metaMes: meta,
      hist12: [0,0,0,0,0,0,0,0,0,0,0,0],
      performance: perf,
      relatoriosEnviados: [],
      updated_at: p.updated_at,
    };
  }

  function plantToInversor(p) {
    const status = (p.status || '').toUpperCase();
    const st = status === 'OK' ? 'ok' : status === 'ALARMING' ? 'err' : 'warn';
    return {
      id: p.id,
      sigla: 'GRO',
      bgCol: '#FFF3E8', txtCol: '#C25200',
      modelo: `Growatt ${parseFloat(p.power).toFixed(2)} kWp`,
      cliente: p.name,
      serial: p.id.slice(0,8).toUpperCase(),
      api: 'Growatt OpenAPI',
      status: st,
      statusLabel: st === 'ok' ? 'Online' : st === 'err' ? 'Alarme' : 'Offline',
      geracaoHoje: parseFloat(p.energyDay) || 0,
      temp: null,
    };
  }

  function plantToAlerta(p) {
    const status = (p.status || '').toUpperCase();
    const isAlarme = status === 'ALARMING';
    return {
      id: p.id,
      tipo: isAlarme ? 'err' : 'warn',
      tipoAlerta: isAlarme ? 'alarme' : 'offline',
      icon: isAlarme ? 'ti-alert-circle' : 'ti-wifi-off',
      titulo: `${p.name}: ${isAlarme ? 'Alarme ativo no inversor' : 'Sistema offline'}`,
      detalhe: `Growatt · ${p.power} kWp · ${new Date(p.updated_at).toLocaleString('pt-BR')}`,
      acao: 'Diagnosticar',
    };
  }

  async function load() {
    try {
      const res  = await fetch('/api/growatt');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Growatt retornou ok=false');

      const plants  = data.data || [];
      const online  = plants.filter(p => p.status === 'OK').length;
      const offline = plants.filter(p => p.status !== 'OK').length;
      const alertas = plants.filter(p => p.alert);

      DB.clientes   = [...(DB.clientes   || []), ...plants.map(plantToCliente)];
      DB.inversores = [...(DB.inversores || []), ...plants.map(plantToInversor)];
      DB.alertas    = [...(DB.alertas    || []), ...alertas.map(plantToAlerta)];

      const totalHoje = plants.reduce((s, p) => s + (parseFloat(p.energyDay) || 0), 0);
      const totalMes  = plants.reduce((s, p) => s + (parseFloat(p.energyMonth) || 0), 0);

      DB.dashKpis.clientesAtivos = (DB.dashKpis.clientesAtivos || 0) + plants.length;
      DB.dashKpis.alertasAtivos  = (DB.dashKpis.alertasAtivos  || 0) + alertas.length;
      DB.dashKpis.geracaoHoje    = parseFloat(((DB.dashKpis.geracaoHoje || 0) + totalHoje).toFixed(2));
      DB.dashKpis.economiaMes    = Math.round(((DB.dashKpis.economiaMes || 0) + totalMes * 0.82));

      console.log('[Growatt] OK:', {
        total:   plants.length,
        online,
        offline,
        alertas: alertas.length,
        energyDay:   totalHoje.toFixed(1) + ' kWh',
        energyMonth: totalMes.toFixed(1)  + ' kWh',
      });

    } catch (err) {
      console.warn('[Growatt] Falha ao carregar:', err.message);
    }
  }

  return { load };
})();
