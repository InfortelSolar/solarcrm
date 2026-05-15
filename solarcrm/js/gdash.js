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
      if (status === 'OK')               { metrics.online++;   metrics.onlinePower += power; }
      else if (status === 'OFFLINE')       metrics.offline++;
      else if (status === 'ALARMING')      metrics.alarming++;
      else if (status === 'NO_COMMUNICATION') metrics.noComm++;
      if (p.alert || status !== 'OK') metrics.alerts.push(p);
      const mfr = p.manufacturer || 'Outros';
      metrics.byManufacturer[mfr] = (metrics.byManufacturer[mfr] || 0) + 1;
    }
    return metrics;
  }

  return { fetchPlants, calcMetrics };
})();

(function autoInit() {
  document.addEventListener('DOMContentLoaded', () => {
    GDash.fetchPlants().then(plants => {
      const m = GDash.calcMetrics(plants);

      DB.dashKpis.clientesAtivos = m.total;
      DB.dashKpis.alertasAtivos  = m.offline + m.alarming;
      DB.dashKpis.geracaoHoje    = parseFloat(m.totalPower.toFixed(2));
      DB.dashKpis.economiaMes    = Math.round(m.onlinePower * 0.82 * 30);

      const badge = document.getElementById('badge-alertas');
      if (badge) badge.textContent = m.offline + m.alarming;

      const content = document.querySelector('.content');
      if (content && content.innerHTML.includes('grid-metrics')) {
        content.innerHTML = Pages.dashboard();
        if (typeof Charts !== 'undefined') {
          setTimeout(() => Charts.renderDashboard && Charts.renderDashboard(), 50);
        }
      }

      console.log('[GDash] OK:', {
        total: m.total, online: m.online,
        offline: m.offline, alarming: m.alarming,
      });

    }).catch(err => console.error('[GDash] Erro:', err));
  });
})();
