// ============================================================
//  SolarCRM — Módulo de histórico de geração por planta v2
//  Dados reais via API para todos os fabricantes
// ============================================================

const Historico = (() => {

  function ultimosDias(n) {
    const dias = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dias.push(d.toISOString().slice(0, 10));
    }
    return dias;
  }

  function ultimosMeses(n) {
    const meses = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      meses.push(d.toISOString().slice(0, 7));
    }
    return meses;
  }

  function labelDia(iso) { const [,m,d] = iso.split('-'); return `${d}/${m}`; }
  function labelMes(iso) {
    const [y,m] = iso.split('-');
    const nomes = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    return `${nomes[parseInt(m)-1]}/${y.slice(2)}`;
  }

  // ── Solis ────────────────────────────────────────────────────
  async function fetchSolis(plantId, periodo) {
    try {
      if (periodo === '7d' || periodo === '30d') {
        const dias = periodo === '7d' ? ultimosDias(7) : ultimosDias(30);
        const valores = await Promise.all(dias.map(async (iso) => {
          try {
            const res = await fetch(`/api/solis?history=1&stationId=${plantId}&date=${iso}`);
            const json = await res.json();
            return parseFloat(json.energy ?? 0);
          } catch { return 0; }
        }));
        return { labels: dias.map(labelDia), data: valores, datas: dias };
      } else {
        const meses = ultimosMeses(12);
        const valores = await Promise.all(meses.map(async (iso) => {
          try {
            const res = await fetch(`/api/solis?history=1&stationId=${plantId}&month=${iso}`);
            const json = await res.json();
            return parseFloat(json.energy ?? 0);
          } catch { return 0; }
        }));
        return { labels: meses.map(labelMes), data: valores, datas: meses };
      }
    } catch(e) { console.warn('[Historico/Solis]', e.message); return null; }
  }

  // ── Fronius ──────────────────────────────────────────────────
  async function fetchFronius(plantId, periodo) {
    try {
      if (periodo === '7d' || periodo === '30d') {
        const dias = periodo === '7d' ? ultimosDias(7) : ultimosDias(30);
        const valores = await Promise.all(dias.map(async (iso) => {
          const [y,m,d] = iso.split('-');
          try {
            const res = await fetch(`/api/fronius?pvSystemId=${plantId}&year=${y}&month=${parseInt(m)}&day=${parseInt(d)}`);
            const json = await res.json();
            return parseFloat(json.eToday_kWh ?? 0);
          } catch { return 0; }
        }));
        return { labels: dias.map(labelDia), data: valores, datas: dias };
      } else {
        const meses = ultimosMeses(12);
        const valores = await Promise.all(meses.map(async (iso) => {
          const [y,m] = iso.split('-');
          try {
            const res = await fetch(`/api/fronius?pvSystemId=${plantId}&year=${y}&month=${parseInt(m)}`);
            const json = await res.json();
            return parseFloat(json.eMonth_kWh ?? 0);
          } catch { return 0; }
        }));
        return { labels: meses.map(labelMes), data: valores, datas: meses };
      }
    } catch(e) { console.warn('[Historico/Fronius]', e.message); return null; }
  }

  // ── Growatt ──────────────────────────────────────────────────
  async function fetchGrowatt(plantId, periodo) {
    try {
      if (periodo === '7d' || periodo === '30d') {
        const dias = periodo === '7d' ? ultimosDias(7) : ultimosDias(30);
        const startDate = dias[0];
        const endDate   = dias[dias.length - 1];
        const res  = await fetch(`/api/growatt?historyPlantId=${plantId}&startDate=${startDate}&endDate=${endDate}&timeUnit=day`);
        const json = await res.json();
        const map  = {};
        (json.data || []).forEach(d => { map[d.date] = parseFloat(d.energy ?? 0); });
        return { labels: dias.map(labelDia), data: dias.map(d => map[d] ?? 0), datas: dias };
      } else {
        const meses = ultimosMeses(12);
        const valores = await Promise.all(meses.map(async (iso) => {
          try {
            const res  = await fetch(`/api/growatt?historyPlantId=${plantId}&month=${iso}`);
            const json = await res.json();
            return parseFloat(json.energy ?? 0);
          } catch { return 0; }
        }));
        return { labels: meses.map(labelMes), data: valores, datas: meses };
      }
    } catch(e) { console.warn('[Historico/Growatt]', e.message); return null; }
  }

  // ── SolPlanet ────────────────────────────────────────────────
  async function fetchSolPlanet(cliente, periodo) {
    const plantId = cliente.plantIdPortal || (typeof SolPlanet !== 'undefined' ? SolPlanet.getPlantId(cliente.id) : null);
    if (!plantId) return null;

    try {
      if (periodo === '7d') {
        const today = new Date().toISOString().slice(0, 10);
        const res   = await fetch(`/api/solplanet?action=week&plantId=${plantId}&date=${today}`);
        const json  = await res.json();
        if (json.ok && json.dates?.length > 0) {
          const dates  = json.dates.slice(-7);
          const values = json.values.slice(-7);
          return { labels: dates.map(labelDia), data: values.map(v => parseFloat(v || 0)), datas: dates };
        }
      } else if (periodo === '30d') {
        const dias = ultimosDias(30);
        const valores = await Promise.all(dias.map(async (iso) => {
          try {
            const res  = await fetch(`/api/solplanet?action=dayEnergy&plantId=${plantId}&date=${iso}`);
            const json = await res.json();
            return parseFloat(json.energy ?? 0);
          } catch { return 0; }
        }));
        return { labels: dias.map(labelDia), data: valores, datas: dias };
      } else {
        const meses = ultimosMeses(12);
        const valores = await Promise.all(meses.map(async (iso) => {
          try {
            const res  = await fetch(`/api/solplanet?action=monthEnergy&plantId=${plantId}&month=${iso}`);
            const json = await res.json();
            return parseFloat(json.energy ?? 0);
          } catch { return 0; }
        }));
        return { labels: meses.map(labelMes), data: valores, datas: meses };
      }
    } catch(e) { console.warn('[Historico/SolPlanet]', e.message); }
    return null;
  }

  // ── Fallback simulado ─────────────────────────────────────────
  function gerarHistoricoSimulado(cliente, periodo) {
    const base    = parseFloat(cliente.geracaoHoje || 0);
    const baseMes = parseFloat(cliente.geracaoMes  || 0);
    if (periodo === '7d') {
      const dias = ultimosDias(7);
      return { labels: dias.map(labelDia), data: [0.91,0.95,1.02,0.98,1.05,0.72,1.0].map(f => parseFloat((base*f).toFixed(1))), datas: dias, simulado: true };
    } else if (periodo === '30d') {
      const dias = ultimosDias(30);
      return { labels: dias.map(labelDia), data: dias.map(()=>parseFloat((base*(0.85+Math.random()*0.3)).toFixed(1))), datas: dias, simulado: true };
    } else {
      const meses = ultimosMeses(12);
      return { labels: meses.map(labelMes), data: [0.78,0.80,0.85,0.90,0.93,0.88,0.82,0.87,0.92,0.96,0.98,1.0].map(f=>parseFloat(((baseMes||base*25)*f).toFixed(1))), datas: meses, simulado: true };
    }
  }

  // ── Entry point ───────────────────────────────────────────────
  async function buscar(cliente, periodo) {
    const fab = (cliente.inversor || '').toLowerCase();
    let resultado = null;
    if (fab.includes('fronius'))   resultado = await fetchFronius(cliente.id, periodo);
    else if (fab.includes('solis'))     resultado = await fetchSolis(cliente.id, periodo);
    else if (fab.includes('growatt'))   resultado = await fetchGrowatt(cliente.id, periodo);
    else if (fab.includes('solplanet')) resultado = await fetchSolPlanet(cliente, periodo);
    if (!resultado) resultado = gerarHistoricoSimulado(cliente, periodo);
    return resultado;
  }

  // ── Renderiza gráfico + tabela ────────────────────────────────
  async function renderizar(cliente, periodo) {
    const loadingEl = document.getElementById('hist-loading');
    const chartEl   = document.getElementById('chart-perfil-hist');
    const tabelaEl  = document.getElementById('hist-tabela');

    if (loadingEl) loadingEl.style.display = 'flex';
    if (chartEl)   chartEl.style.opacity = '0.3';

    const resultado = await buscar(cliente, periodo);

    if (loadingEl) loadingEl.style.display = 'none';
    if (chartEl)   chartEl.style.opacity = '1';

    if (!resultado) {
      if (tabelaEl) tabelaEl.innerHTML = '<p style="padding:12px;color:var(--text-secondary);font-size:12px;">Sem dados disponíveis.</p>';
      return;
    }

    Charts.renderPerfil(resultado.labels, resultado.data);

    const badge = document.getElementById('hist-simulado-badge');
    if (badge) badge.style.display = resultado.simulado ? 'inline-flex' : 'none';

    const total  = resultado.data.reduce((s,v)=>s+v, 0);
    const media  = total / resultado.data.length;
    const maximo = Math.max(...resultado.data);

    const statsEl = document.getElementById('hist-stats');
    if (statsEl) {
      statsEl.innerHTML = `
        <div class="hist-stat" style="padding:10px 16px;border-right:1px solid var(--border);">
          <span class="hist-stat-lbl" style="font-size:11px;color:var(--text-secondary);display:block;">Total</span>
          <span style="font-size:14px;font-weight:700;">${total.toFixed(1)} kWh</span>
        </div>
        <div class="hist-stat" style="padding:10px 16px;border-right:1px solid var(--border);">
          <span class="hist-stat-lbl" style="font-size:11px;color:var(--text-secondary);display:block;">Média</span>
          <span style="font-size:14px;font-weight:700;">${media.toFixed(1)} kWh</span>
        </div>
        <div class="hist-stat" style="padding:10px 16px;border-right:1px solid var(--border);">
          <span class="hist-stat-lbl" style="font-size:11px;color:var(--text-secondary);display:block;">Máximo</span>
          <span style="font-size:14px;font-weight:700;">${maximo.toFixed(1)} kWh</span>
        </div>
        <div class="hist-stat" style="padding:10px 16px;">
          <span class="hist-stat-lbl" style="font-size:11px;color:var(--text-secondary);display:block;">Economia est.</span>
          <span style="font-size:14px;font-weight:700;">R$ ${(total*(cliente.tarifa||0.82)).toFixed(2)}</span>
        </div>`;
    }

    if (tabelaEl) {
      const rows = [...resultado.labels].reverse().map((lbl, i) => {
        const idx = resultado.labels.length - 1 - i;
        const val = resultado.data[idx];
        const eco = (val*(cliente.tarifa||0.82)).toFixed(2);
        const pct = maximo > 0 ? Math.round((val/maximo)*100) : 0;
        const color = pct >= 80 ? 'var(--brand-blue-mid)' : pct >= 50 ? '#EF9F27' : '#E24B4A';
        return `
          <tr>
            <td style="padding:7px 12px;font-size:12px;color:var(--text-secondary);">${lbl}</td>
            <td style="padding:7px 12px;font-size:12px;font-weight:600;">${val.toFixed(1)} kWh</td>
            <td style="padding:7px 12px;font-size:12px;">R$ ${eco}</td>
            <td style="padding:7px 12px;">
              <div style="display:flex;align-items:center;gap:6px;">
                <div style="flex:1;height:6px;background:var(--bg-secondary);border-radius:3px;">
                  <div style="width:${pct}%;height:6px;background:${color};border-radius:3px;"></div>
                </div>
                <span style="font-size:11px;color:var(--text-secondary);min-width:28px;">${pct}%</span>
              </div>
            </td>
          </tr>`;
      }).join('');
      tabelaEl.innerHTML = `
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="border-bottom:1px solid var(--border);">
              <th style="padding:8px 12px;text-align:left;font-size:11px;color:var(--text-secondary);font-weight:600;">Período</th>
              <th style="padding:8px 12px;text-align:left;font-size:11px;color:var(--text-secondary);font-weight:600;">Geração</th>
              <th style="padding:8px 12px;text-align:left;font-size:11px;color:var(--text-secondary);font-weight:600;">Economia</th>
              <th style="padding:8px 12px;text-align:left;font-size:11px;color:var(--text-secondary);font-weight:600;">Performance</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>`;
    }
  }

  return { buscar, renderizar };
})();
