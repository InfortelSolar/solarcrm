// ============================================================
//  SolarCRM — Módulo de histórico de geração por planta
//  Busca dados reais via API conforme o fabricante do inversor
// ============================================================

const Historico = (() => {

  // Gera array de datas para os últimos N dias (formato YYYY-MM-DD)
  function ultimosDias(n) {
    const dias = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dias.push(d.toISOString().slice(0, 10));
    }
    return dias;
  }

  // Gera array dos últimos 12 meses (formato YYYY-MM)
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

  // Label amigável para datas
  function labelDia(iso) {
    const [, m, d] = iso.split('-');
    return `${d}/${m}`;
  }
  function labelMes(iso) {
    const [y, m] = iso.split('-');
    const nomes = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    return `${nomes[parseInt(m) - 1]}/${y.slice(2)}`;
  }

  // ── Busca Solis via /api/gdash ──────────────────────────────
  async function fetchSolis(plantId, periodo) {
    try {
      const res = await fetch(`/api/gdash?source=solis`);
      if (!res.ok) throw new Error('Solis API error');
      const json = await res.json();
      if (!json.ok) throw new Error('Solis ok=false');

      const plant = json.data?.find(p => p.id === plantId);
      if (!plant) throw new Error('Planta não encontrada');

      // Solis retorna energyDay e energyMonth — simulamos histórico proporcional
      // pois a API pública não retorna série histórica por dia
      return gerarHistoricoSimulado(plant, periodo);
    } catch (e) {
      console.warn('[Historico/Solis]', e.message);
      return null;
    }
  }

  // ── Busca Fronius via /api/fronius ──────────────────────────
  async function fetchFronius(plantId, periodo) {
    try {
      if (periodo === '7d' || periodo === '30d') {
        // Buscar dia a dia
        const dias = periodo === '7d' ? ultimosDias(7) : ultimosDias(30);
        const valores = await Promise.all(dias.map(async (iso) => {
          const [y, m, d] = iso.split('-');
          try {
            const res = await fetch(`/api/fronius?pvSystemId=${plantId}&year=${y}&month=${parseInt(m)}&day=${parseInt(d)}`);
            if (!res.ok) return 0;
            const json = await res.json();
            return json.eToday_kWh ?? 0;
          } catch { return 0; }
        }));
        return {
          labels: dias.map(labelDia),
          data: valores,
          datas: dias,
        };
      } else {
        // 12 meses
        const meses = ultimosMeses(12);
        const valores = await Promise.all(meses.map(async (iso) => {
          const [y, m] = iso.split('-');
          try {
            const res = await fetch(`/api/fronius?pvSystemId=${plantId}&year=${y}&month=${parseInt(m)}`);
            if (!res.ok) return 0;
            const json = await res.json();
            return json.eMonth_kWh ?? 0;
          } catch { return 0; }
        }));
        return {
          labels: meses.map(labelMes),
          data: valores,
          datas: meses,
        };
      }
    } catch (e) {
      console.warn('[Historico/Fronius]', e.message);
      return null;
    }
  }

  // ── Histórico simulado (quando API não retorna série) ───────
  function gerarHistoricoSimulado(cliente, periodo) {
    const base = parseFloat(cliente.geracaoHoje || cliente.energyDay || 0);
    const baseMes = parseFloat(cliente.geracaoMes || cliente.energyMonth || 0);

    if (periodo === '7d') {
      const dias = ultimosDias(7);
      const fators = [0.91, 0.95, 1.02, 0.98, 1.05, 0.72, 1.0];
      return {
        labels: dias.map(labelDia),
        data: fators.map(f => parseFloat((base * f).toFixed(1))),
        datas: dias,
        simulado: true,
      };
    } else if (periodo === '30d') {
      const dias = ultimosDias(30);
      const data = dias.map((_, i) => parseFloat((base * (0.85 + Math.random() * 0.3)).toFixed(1)));
      return { labels: dias.map(labelDia), data, datas: dias, simulado: true };
    } else {
      const meses = ultimosMeses(12);
      const baseMesVal = baseMes || base * 25;
      const fators = [0.78, 0.80, 0.85, 0.90, 0.93, 0.88, 0.82, 0.87, 0.92, 0.96, 0.98, 1.0];
      return {
        labels: meses.map(labelMes),
        data: fators.map(f => parseFloat((baseMesVal * f).toFixed(1))),
        datas: meses,
        simulado: true,
      };
    }
  }

  // ── Entry point principal ────────────────────────────────────
  async function buscar(cliente, periodo) {
    const fab = (cliente.inversor || '').toLowerCase();
    let resultado = null;

    if (fab.includes('fronius')) {
      resultado = await fetchFronius(cliente.id, periodo);
    } else if (fab.includes('solis') || fab === 'solis cloud') {
      resultado = await fetchSolis(cliente.id, periodo);
    }

    // Fallback: simulado
    if (!resultado) {
      resultado = gerarHistoricoSimulado(cliente, periodo);
    }

    return resultado;
  }

  // ── Renderiza o bloco completo (gráfico + tabela) ───────────
  async function renderizar(cliente, periodo) {
    const container = document.getElementById('hist-container');
    const loadingEl = document.getElementById('hist-loading');
    const chartEl   = document.getElementById('chart-perfil-hist');
    const tabelaEl  = document.getElementById('hist-tabela');

    if (!container) return;

    // Loading
    if (loadingEl) loadingEl.style.display = 'flex';
    if (chartEl)   chartEl.style.opacity = '0.3';

    const resultado = await buscar(cliente, periodo);

    if (loadingEl) loadingEl.style.display = 'none';
    if (chartEl)   chartEl.style.opacity = '1';

    if (!resultado) {
      if (tabelaEl) tabelaEl.innerHTML = '<p style="padding:12px;color:var(--text-secondary);font-size:12px;">Sem dados disponíveis.</p>';
      return;
    }

    // Gráfico
    Charts.renderPerfil(resultado.labels, resultado.data);

    // Badge "simulado"
    const badge = document.getElementById('hist-simulado-badge');
    if (badge) badge.style.display = resultado.simulado ? 'inline-flex' : 'none';

    // Totais
    const total = resultado.data.reduce((s, v) => s + v, 0);
    const media = total / resultado.data.length;
    const maximo = Math.max(...resultado.data);

    const statsEl = document.getElementById('hist-stats');
    if (statsEl) {
      statsEl.innerHTML = `
        <div class="hist-stat"><span class="hist-stat-lbl">Total</span><span class="hist-stat-val">${total.toFixed(1)} kWh</span></div>
        <div class="hist-stat"><span class="hist-stat-lbl">Média</span><span class="hist-stat-val">${media.toFixed(1)} kWh</span></div>
        <div class="hist-stat"><span class="hist-stat-lbl">Máximo</span><span class="hist-stat-val">${maximo.toFixed(1)} kWh</span></div>
        <div class="hist-stat"><span class="hist-stat-lbl">Economia est.</span><span class="hist-stat-val">R$ ${(total * (cliente.tarifa || 0.82)).toFixed(2)}</span></div>
      `;
    }

    // Tabela
    if (tabelaEl) {
      const rows = resultado.labels.map((lbl, i) => {
        const val = resultado.data[i];
        const eco = (val * (cliente.tarifa || 0.82)).toFixed(2);
        const pct = maximo > 0 ? Math.round((val / maximo) * 100) : 0;
        const color = pct >= 80 ? '#1D9E75' : pct >= 50 ? '#EF9F27' : '#E24B4A';
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
      }).reverse().join(''); // mais recente primeiro

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
