// ============================================================
//  SolarCRM — Módulo de gráficos (Chart.js)
// ============================================================

const Charts = {
  instances: {},

  get isDark() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  },

  get gridColor() {
    return this.isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)';
  },

  get tickColor() {
    return this.isDark ? '#9e9e9a' : '#888';
  },

  defaults() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: this.gridColor }, ticks: { color: this.tickColor, font: { size: 10 } } },
        y: { grid: { color: this.gridColor }, ticks: { color: this.tickColor, font: { size: 10 } } },
      },
    };
  },

  destroy(id) {
    if (this.instances[id]) {
      this.instances[id].destroy();
      delete this.instances[id];
    }
  },

  bar(canvasId, labels, data, color = '#1D9E75') {
    this.destroy(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    this.instances[canvasId] = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{ label: 'kWh', data, backgroundColor: color, borderRadius: 3, borderSkipped: false }],
      },
      options: this.defaults(),
    });
  },

  line(canvasId, labels, data, color = '#1D9E75') {
    this.destroy(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const alpha = this.isDark ? 'rgba(29,158,117,0.15)' : 'rgba(29,158,117,0.1)';
    this.instances[canvasId] = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'R$', data,
          borderColor: color,
          backgroundColor: alpha,
          tension: 0.4, fill: true,
          pointBackgroundColor: color, pointRadius: 4,
        }],
      },
      options: {
        ...this.defaults(),
        scales: {
          ...this.defaults().scales,
          y: {
            ...this.defaults().scales.y,
            ticks: {
              ...this.defaults().scales.y.ticks,
              callback: v => 'R$' + Math.round(v / 1000) + 'k',
            },
          },
        },
      },
    });
  },

  multiLine(canvasId, labels, datasets) {
    this.destroy(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    this.instances[canvasId] = new Chart(canvas, {
      type: 'line',
      data: { labels, datasets },
      options: this.defaults(),
    });
  },

  renderDashboard() {
    const d = DB.dashKpis;
    this.bar('chart-geracao-dias',
      ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'],
      d.geracaoDias
    );
    this.line('chart-economia-meses',
      ['Jan', 'Fev', 'Mar', 'Abr', 'Mai'],
      d.economiaMeses
    );
  },

  renderPerfil(cliente) {
    const meses = ['Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai'];
    this.bar('chart-perfil-hist', meses, cliente.hist12);
  },

  renderInversores() {
    const ativos = DB.inversores.filter(i => i.status !== 'err');
    this.bar('chart-inv-geracao',
      ativos.map(i => i.cliente.split(' ')[0]),
      ativos.map(i => i.geracaoHoje),
    );
  },
};
