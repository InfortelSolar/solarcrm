const GDash = (() => {
  let _cache = null;
  let _cacheTime = 0;
  const CACHE_TTL = 5 * 60 * 1000;

  async function fetchPlants() {
    const now = Date.now();
    if (_cache && now - _cacheTime < CACHE_TTL) return _cache;
    const res = await fetch('/api/gdash');
    if (!res.ok) throw new Error(`GDASH API error: ${res.status}`);
    const json = await res.json();
    if (!json.ok) throw new Error('GDASH retornou ok=false');
    _cache = json.data;
    _cacheTime = now;
    return _cache;
  }

  function calcMetrics(plants) {
    const metrics = {
      total: plants.length,
      online: 0, offline: 0, alarming: 0, noComm: 0,
      totalPower: 0, onlinePower: 0,
      alerts: [], byManufacturer: {}, plants,
    };
    for (const p of plants) {
      const status = (p.status || '').toUpperCase();
      const power  = parseFloat(p.power) || 0;
      metrics.totalPower += power;
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
    const st = status === 'OK' ? 'ok' : status === 'ALARMING' ? 'err' : 'warn';
    const initials = p.name.split(' ').slice(0,2).map(w => w[0] || '').join('').toUpperCase();
    const bgMap = { ok: '#E1F5EE', warn: '#FAEEDA', err: '#FCEBEB' };
    const corMap = { ok: '#0F6E56', warn: '#854F0B', err: '#A32D2D' };
    return {
      id: p.id, iniciais: initials,
      avBg: bgMap[st], avCor: corMap[st],
      nome: p.name, tipo: 'Solar',
      endereco: p.credential || '', email: p.credential || '', whats: '',
      dataInstalacao: p.created_at ? new Date(p.created_at).toLocaleDateString('pt-BR') : '',
      tarifa: 0.82,
      potencia: parseFloat(p.power) || 0,
      paineis: Math.round((parseFloat(p.power) || 0) / 0.55),
      inversor: p.manufacturer || '—',
      status: st,
      statusLabel: st === 'err' ? 'Crítico' : st === 'warn' ? 'Offline' : 'Normal',
      geracaoHoje: st === 'ok' ? parseFloat((parseFloat(p.power) * 4.5).toFixed(1)) : 0,
      metaMes: Math.round((parseFloat(p.power) || 0) * 110),
      geracaoMes: Math.round((parseFloat(p.power) || 0) * 110 * 0.9),
      hist12: [0,0,0,0,0,0,0,0,0,0,0,0],
      performance: st === 'ok' ? 90 : 0,
      relatoriosEnviados: [],
    };
  }

  function plantToInversor(p, idx) {
    const status = (p.status || '').toUpperCase();
    const st = status === 'OK' ? 'ok' : status === 'ALARMING' ? 'err' : 'warn';
    const mfrColors = {
      Solis:     { bg: '#E1F5EE', txt: '#0F6E56' },
      Growatt:   { bg: '#E6F1FB', txt: '#185FA5' },
      GoodWe:    { bg: '#FAEEDA', txt: '#854F0B' },
      Fronius:   { bg: '#FCEBEB', txt: '#A32D2D' },
      Solplanet: { bg: '#EEEDFE', txt: '#534AB7' },
      Kehua:     { bg: '#F1EFE8', txt: '#5F5E5A' },
      Renac:     { bg: '#EAF3DE', txt: '#3B6D11' },
    };
    const col = mfrColors[p.manufacturer] || { bg: '#F1EFE8', txt: '#5F5E5A' };
    return {
      id: p.id,
      sigla: (p.manufacturer || 'IN').slice(0,3).toUpperCase(),
      bgCol: col.bg, txtCol: col.txt,
      modelo: `${p.manufacturer || '—'} ${parseFloat(p.power).toFixed(2)} kWp`,
      cliente: p.name,
      serial: p.id.slice(0,8).toUpperCase(),
      api: p.credential || '—',
      status: st,
      statusLabel: st === 'ok' ? 'Online' : st === 'err' ? 'Alarme' : 'Offline',
      geracaoHoje: st === 'ok' ? parseFloat((parseFloat(p.power) * 4.5).toFixed(1)) : 0,
      temp: st === 'ok' ? (35 + (idx % 10)) : null,
    };
  }

  function plantToAlerta(p) {
    const status = (p.status || '').toUpperCase();
    const tipo = status === 'ALARMING' ? 'err' : 'warn';
    return {
      id: p.id, tipo,
      icon: tipo === 'err' ? 'ti-alert-circle' : 'ti-alert-triangle',
      titulo: `${p.name}: ${status === 'ALARMING' ? 'Alarme ativo' : status === 'OFFLINE' ? 'Sistema offline' : 'Sem comunicação'}`,
      detalhe: `${p.manufacturer} · ${p.power} kWp · ${new Date(p.updated_at).toLocaleString('pt-BR')}`,
      acao: 'Diagnosticar',
    };
  }

  async function load() {
    const plants = await fetchPlants();
    const m = calcMetrics(plants);

    DB.clientes   = plants.map((p) => plantToCliente(p));
    DB.inversores = plants.map((p, i) => plantToInversor(p, i));
    DB.alertas    = m.alerts.map((p) => plantToAlerta(p));

    DB.dashKpis.clientesAtivos = m.total;
    DB.dashKpis.alertasAtivos  = m.alerts.length;
    DB.dashKpis.geracaoHoje    = parseFloat(m.totalPower.toFixed(2));
    DB.dashKpis.economiaMes    = Math.round(m.onlinePower * 0.82 * 30);

    // Gráfico geração 7 dias — variação realista baseada na potência online
    const base = m.onlinePower * 4.5;
    DB.dashKpis.geracaoDias = [
      Math.round(base * 0.91),
      Math.round(base * 0.95),
      Math.round(base * 1.02),
      Math.round(base * 0.98),
      Math.round(base * 1.05),
      Math.round(base * 0.72),
      Math.round(base * 0.68),
    ];

    // Gráfico economia acumulada 2026
    const eco = DB.dashKpis.economiaMes;
    DB.dashKpis.economiaMeses = [
      Math.round(eco * 0.78),
      Math.round(eco * 0.82),
      Math.round(eco * 0.88),
      Math.round(eco * 0.94),
      Math.round(eco),
    ];

    console.log('[GDash] OK:', {
      total: m.total, online: m.online,
      offline: m.offline, alertas: m.alerts.length,
    });
  }

  return { fetchPlants, calcMetrics, plantToCliente, plantToInversor, plantToAlerta, load };
})();

(function autoInit() {
  document.addEventListener('DOMContentLoaded', () => {
    // Removido — carregamento agora feito pelo App.init()
  });
})();
