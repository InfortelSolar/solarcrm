// ============================================================
//  SolarCRM — Construtores de páginas (HTML strings)
//  v5.0 — Histórico de geração real por planta
// ============================================================

const Pages = {

  // ---- helpers ----
  badgeStatus(status, label) {
    const map = { ok: 'b-ok', warn: 'b-warn', err: 'b-err' };
    return `<span class="badge ${map[status] || 'b-gray'}">${label}</span>`;
  },

  perfBar(pct) {
    const color = pct >= 80 ? '#1D9E75' : pct >= 50 ? '#EF9F27' : '#E24B4A';
    return `
      <div class="ptrack" style="margin-top:3px;">
        <div class="pfill" style="width:${pct}%; background:${color};"></div>
      </div>`;
  },

  // ---- Dashboard ----
  dashboard() {
    const d = DB.dashKpis;
    const online  = DB.inversores.filter(i => i.status === 'ok').length;
    const offline = DB.inversores.filter(i => i.status !== 'ok').length;
    const criticos = DB.alertas.filter(a => a.tipo === 'err').length;
    const alertasSub = criticos > 0 ? `${criticos} críticos` : 'Tudo monitorado';
    const alertasClass = criticos > 0 ? 'err' : 'ok';
    const piores = [...DB.clientes].filter(c => c.performance < 100).sort((a, b) => a.performance - b.performance).slice(0, 5);
    const alertasRecentes = DB.alertas.slice(0, 3);
    const now = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    return `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px;">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
        <span style="display:inline-flex;align-items:center;gap:5px;background:#E1F5EE;color:#0F6E56;padding:5px 12px;border-radius:20px;font-size:12px;font-weight:600;">
          <span style="width:7px;height:7px;background:#1D9E75;border-radius:50%;display:inline-block;"></span>
          ${online} plantas online
        </span>
        <span style="display:inline-flex;align-items:center;gap:5px;background:#FCEBEB;color:#A32D2D;padding:5px 12px;border-radius:20px;font-size:12px;font-weight:600;">
          <span style="width:7px;height:7px;background:#E24B4A;border-radius:50%;display:inline-block;"></span>
          ${offline} offline / alarme
        </span>
        <span style="font-size:12px;color:var(--text-secondary);">
          Atualizado às <span id="last-update-time">${now}</span>
          <span style="display:inline-block;width:7px;height:7px;background:#1D9E75;border-radius:50%;margin-left:4px;animation:pulse 2s infinite;" title="Auto-refresh ativo (5 min)"></span>
        </span>
      </div>
      <button class="btn btn-sm" onclick="App.recarregarDados()" style="display:flex;align-items:center;gap:5px;">
        <i class="ti ti-refresh"></i> Atualizar agora
      </button>
    </div>

    <div class="grid-metrics">
      <div class="mcard" style="border-left:3px solid #1D9E75;">
        <div class="mcard-label"><i class="ti ti-bolt" style="color:#1D9E75;"></i>Geração hoje</div>
        <div class="mcard-val">${d.geracaoHoje.toLocaleString('pt-BR')} kWh</div>
        <div class="mcard-sub ok">Potência total instalada</div>
      </div>
      <div class="mcard" style="border-left:3px solid #3B82F6;">
        <div class="mcard-label"><i class="ti ti-solar-panel" style="color:#3B82F6;"></i>Plantas ativas</div>
        <div class="mcard-val">${d.clientesAtivos}</div>
        <div class="mcard-sub ok">${online} online agora</div>
      </div>
      <div class="mcard" style="border-left:3px solid #EF9F27;">
        <div class="mcard-label"><i class="ti ti-coin" style="color:#EF9F27;"></i>Economia / mês</div>
        <div class="mcard-val">R$ ${d.economiaMes.toLocaleString('pt-BR')}</div>
        <div class="mcard-sub ok">Estimativa mensal</div>
      </div>
      <div class="mcard" style="border-left:3px solid ${criticos > 0 ? '#E24B4A' : '#1D9E75'};">
        <div class="mcard-label"><i class="ti ti-alert-triangle" style="color:${criticos > 0 ? '#E24B4A' : '#EF9F27'};"></i>Alertas ativos</div>
        <div class="mcard-val" style="color:${criticos > 0 ? '#E24B4A' : 'inherit'}">${d.alertasAtivos}</div>
        <div class="mcard-sub ${alertasClass}">${alertasSub}</div>
      </div>
    </div>

    <div class="grid-2">
      <div class="card mb-0">
        <div class="card-hdr">
          <div class="card-title">Geração — últimos 7 dias</div>
          <div class="card-meta">Total: ${d.geracaoDias.reduce((a,b)=>a+b,0).toLocaleString('pt-BR')} kWh</div>
        </div>
        <div class="chart-wrap"><canvas id="chart-geracao-dias"></canvas></div>
      </div>
      <div class="card mb-0">
        <div class="card-hdr">
          <div class="card-title">Economia acumulada 2026</div>
          <div class="card-meta">R$ / mês</div>
        </div>
        <div class="chart-wrap"><canvas id="chart-economia-meses"></canvas></div>
      </div>
    </div>

    <div class="grid-2" style="margin-bottom:0;">
      <div class="card mb-0">
        <div class="card-hdr">
          <div class="card-title">⚠️ Plantas com baixa performance</div>
          <div class="card-meta"><button class="btn btn-sm" onclick="App.navTo('clientes')" style="font-size:11px;">Ver todas</button></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0;border-bottom:1px solid var(--border);">
          <div style="padding:12px 16px;text-align:center;border-right:1px solid var(--border);">
            <div style="font-size:20px;font-weight:700;color:#1D9E75;">${DB.clientes.filter(c=>c.performance>=80).length}</div>
            <div style="font-size:11px;color:var(--text-secondary);">Acima de 80%</div>
          </div>
          <div style="padding:12px 16px;text-align:center;border-right:1px solid var(--border);">
            <div style="font-size:20px;font-weight:700;color:#EF9F27;">${DB.clientes.filter(c=>c.performance>=50&&c.performance<80).length}</div>
            <div style="font-size:11px;color:var(--text-secondary);">Entre 50-80%</div>
          </div>
          <div style="padding:12px 16px;text-align:center;">
            <div style="font-size:20px;font-weight:700;color:#E24B4A;">${DB.clientes.filter(c=>c.performance<50).length}</div>
            <div style="font-size:11px;color:var(--text-secondary);">Abaixo de 50%</div>
          </div>
        </div>
        ${piores.length > 0 ? piores.map(c => `
          <div class="prow" style="padding:10px 16px;">
            <div class="plabel">
              <div style="display:flex;align-items:center;gap:6px;">
                <div class="avatar" style="background:${c.avBg};color:${c.avCor};width:24px;height:24px;font-size:9px;border-radius:6px;">${c.iniciais}</div>
                <span style="font-size:12px;">${c.nome}</span>
              </div>
              <span class="${c.performance >= 80 ? 'ok' : c.performance >= 50 ? 'warn' : 'err'}" style="font-size:12px;font-weight:600;">${c.performance}%</span>
            </div>
            ${this.perfBar(c.performance)}
          </div>`).join('') : `<div style="padding:20px;text-align:center;font-size:12px;color:var(--text-secondary);">✅ Todas as plantas com boa performance</div>`}
        <div style="max-height:200px;overflow-y:auto;border-top:1px solid var(--border);">
          ${DB.clientes.filter(c=>c.performance>=80).slice(0,10).map(c => `
            <div class="prow" style="padding:8px 16px;">
              <div class="plabel">
                <span style="font-size:12px;">${c.nome}</span>
                <span class="ok" style="font-size:12px;">${c.performance}%</span>
              </div>
              ${this.perfBar(c.performance)}
            </div>`).join('')}
        </div>
      </div>

      <div class="card mb-0">
        <div class="card-hdr">
          <div class="card-title">🚨 Alertas recentes</div>
          <button class="btn btn-sm" onclick="App.navTo('alertas')">Ver todos (${DB.alertas.length})</button>
        </div>
        ${alertasRecentes.length > 0 ? alertasRecentes.map(a => `
          <div class="alert-item a-${a.tipo}" style="padding:12px 16px;cursor:pointer;" onclick="Pages.abrirDiagnostico('${a.id}')">
            <i class="ti ${a.icon}"></i>
            <div class="atxt" style="flex:1;">
              <div style="font-weight:600;font-size:13px;">${a.titulo}</div>
              <div class="atime" style="font-size:11px;margin-top:2px;">${a.detalhe}</div>
            </div>
            <button class="btn btn-sm" onclick="event.stopPropagation();App.navTo('alertas')">Ver</button>
          </div>`).join('') : `
          <div style="padding:24px;text-align:center;">
            <i class="ti ti-circle-check" style="font-size:32px;color:#1D9E75;display:block;margin-bottom:8px;"></i>
            <div style="font-size:13px;color:var(--text-secondary);">Nenhum alerta ativo</div>
          </div>`}
        <div style="padding:12px 16px;border-top:1px solid var(--border);margin-top:auto;">
          <div style="font-size:11px;color:var(--text-secondary);margin-bottom:8px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Fabricantes monitorados</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;">
            ${Object.entries(DB.inversores.reduce((acc,i)=>{ const m=i.modelo.split(' ')[0]; acc[m]=(acc[m]||0)+1; return acc; },{})).slice(0,6).map(([fab,count]) => `
              <span style="background:var(--bg-secondary);padding:3px 8px;border-radius:10px;font-size:11px;color:var(--text-secondary);">${fab} (${count})</span>`).join('')}
          </div>
        </div>
      </div>
    </div>`;
  },

  // ---- Lista de clientes ----
  clientes() {
    const solar = DB.clientes.filter(c => c.tipo === 'Solar').length;
    const residencial = DB.clientes.filter(c => c.tipo === 'Residencial').length;
    const comercial = DB.clientes.filter(c => c.tipo === 'Comercial').length;
    const comAlertas = DB.clientes.filter(c => c.status !== 'ok').length;

    const rows = DB.clientes.map(c => `
      <div class="trow" style="grid-template-columns:2fr 1fr 1fr 1fr 1fr;" onclick="Pages.openPerfil('${c.id}')">
        <div style="display:flex;align-items:center;gap:8px;">
          <div class="avatar" style="background:${c.avBg};color:${c.avCor};">${c.iniciais}</div>
          <div>
            <div class="font-bold">${c.nome}</div>
            <div class="text-muted" style="font-size:10px;">${c.inversor} · ${c.potencia} kWp</div>
          </div>
        </div>
        <div class="col-hide">${c.potencia} kWp · ${c.paineis} painéis</div>
        <div class="${c.status === 'ok' ? 'ok' : c.status === 'warn' ? 'warn' : 'err'}">${c.geracaoHoje} kWh</div>
        <div>${this.badgeStatus(c.status, c.statusLabel)}</div>
        <div>
          <button class="btn btn-sm" onclick="event.stopPropagation(); App.sendRelatorio('${c.id}')">
            <i class="ti ti-send"></i> Relatório
          </button>
        </div>
      </div>`).join('');

    return `
    <div id="lista-clientes">
      <div class="tab-bar">
        <div class="tab active" onclick="Pages.filterClientes('todos', this)">Todos (${DB.clientes.length})</div>
        ${solar > 0 ? `<div class="tab" onclick="Pages.filterClientes('Solar', this)">Solar (${solar})</div>` : ''}
        ${residencial > 0 ? `<div class="tab" onclick="Pages.filterClientes('Residencial', this)">Residencial (${residencial})</div>` : ''}
        ${comercial > 0 ? `<div class="tab" onclick="Pages.filterClientes('Comercial', this)">Comercial (${comercial})</div>` : ''}
        <div class="tab" onclick="Pages.filterClientes('alertas', this)">
          Alertas (${comAlertas}) ${comAlertas > 0 ? '<span style="display:inline-block;width:7px;height:7px;background:#E24B4A;border-radius:50%;margin-left:4px;"></span>' : ''}
        </div>
      </div>
      <div class="card">
        <div class="thdr" style="grid-template-columns:2fr 1fr 1fr 1fr 1fr;">
          <div>Cliente</div><div class="col-hide">Sistema</div><div>Hoje</div><div>Status</div><div>Ação</div>
        </div>
        <div id="clientes-rows">${rows}</div>
        <div class="text-center mt-8" style="font-size:11px;color:var(--text-secondary);">
          Exibindo ${DB.clientes.length} clientes cadastrados
        </div>
      </div>
    </div>
    <div id="perfil-cliente" style="display:none;"></div>`;
  },

  filterClientes(filtro, el) {
    document.querySelectorAll('.tab-bar .tab').forEach(t => t.classList.remove('active'));
    el.classList.add('active');
    const rows = document.getElementById('clientes-rows');
    if (!rows) return;
    const lista = filtro === 'todos' ? DB.clientes
      : filtro === 'alertas' ? DB.clientes.filter(c => c.status !== 'ok')
      : DB.clientes.filter(c => c.tipo === filtro);
    rows.innerHTML = lista.map(c => `
      <div class="trow" style="grid-template-columns:2fr 1fr 1fr 1fr 1fr;" onclick="Pages.openPerfil('${c.id}')">
        <div style="display:flex;align-items:center;gap:8px;">
          <div class="avatar" style="background:${c.avBg};color:${c.avCor};">${c.iniciais}</div>
          <div>
            <div class="font-bold">${c.nome}</div>
            <div class="text-muted" style="font-size:10px;">${c.inversor} · ${c.potencia} kWp</div>
          </div>
        </div>
        <div class="col-hide">${c.potencia} kWp · ${c.paineis} painéis</div>
        <div class="${c.status === 'ok' ? 'ok' : c.status === 'warn' ? 'warn' : 'err'}">${c.geracaoHoje} kWh</div>
        <div>${this.badgeStatus(c.status, c.statusLabel)}</div>
        <div>
          <button class="btn btn-sm" onclick="event.stopPropagation(); App.sendRelatorio('${c.id}')">
            <i class="ti ti-send"></i> Relatório
          </button>
        </div>
      </div>`).join('');
  },

  openPerfil(id) {
    const c = DB.getCliente(id);
    if (!c) return;
    const economia = DB.computeEconomia(c);
    const percMeta = Math.round((c.geracaoMes / c.metaMes) * 100);
    const histLog = c.relatoriosEnviados.map(r => `
      <div class="send-log">
        <span class="badge b-ok">Entregue</span>
        <span class="send-log-name">${r.mes}</span>
        <span class="send-log-ch">${r.canais}</span>
        <span class="send-log-date">${r.data}</span>
      </div>`).join('');

    document.getElementById('lista-clientes').style.display = 'none';
    document.getElementById('perfil-cliente').style.display = 'block';
    document.getElementById('pbread').textContent = '› ' + c.nome;

    document.getElementById('perfil-cliente').innerHTML = `
      <button class="back-btn" onclick="Pages.closePerfil()">
        <i class="ti ti-arrow-left"></i> Voltar para clientes
      </button>
      <div class="profile-hero">
        <div class="profile-avatar" style="background:${c.avBg};color:${c.avCor};">${c.iniciais}</div>
        <div style="flex:1;">
          <div class="profile-name">${c.nome}</div>
          <div class="profile-meta">${c.inversor} · ${c.potencia} kWp</div>
          <div class="profile-badges">
            ${this.badgeStatus(c.status, c.statusLabel)}
            <span class="badge b-blue">${c.potencia} kWp · ${c.paineis} painéis</span>
            <span class="badge b-gray">${c.inversor}</span>
          </div>
        </div>
        <div style="display:flex;gap:8px;">
          <button class="btn" onclick="App.editarClienteGdash('${c.id}')">
            <i class="ti ti-pencil"></i> Editar
          </button>
          <button class="btn btn-teal" onclick="App.sendRelatorio('${c.id}')">
            <i class="ti ti-send"></i> Enviar relatório
          </button>
        </div>
      </div>

      <div class="info-grid">
        <div class="info-item"><div class="info-lbl">E-mail</div><div class="info-val">${c.email || '—'}</div></div>
        <div class="info-item"><div class="info-lbl">WhatsApp</div><div class="info-val">${c.whats || '—'}</div></div>
        <div class="info-item"><div class="info-lbl">Data de instalação</div><div class="info-val">${c.dataInstalacao}</div></div>
        <div class="info-item"><div class="info-lbl">Tarifa de energia</div><div class="info-val">R$ ${c.tarifa.toFixed(2)} / kWh</div></div>
      </div>

      <div class="grid-3">
        <div class="mcard" style="border-left:3px solid #1D9E75;">
          <div class="mcard-label">Geração hoje</div>
          <div class="mcard-val">${c.geracaoHoje} kWh</div>
          <div class="mcard-sub ${c.status === 'ok' ? 'ok' : c.status === 'warn' ? 'warn' : 'err'}">
            ${c.status === 'err' ? 'Sistema offline' : c.status === 'warn' ? 'Abaixo da meta' : '↑ Normal'}
          </div>
        </div>
        <div class="mcard" style="border-left:3px solid #3B82F6;">
          <div class="mcard-label">Geração este mês</div>
          <div class="mcard-val">${c.geracaoMes.toLocaleString('pt-BR')} kWh</div>
          <div class="mcard-sub text-muted">${percMeta}% da meta (${c.metaMes.toLocaleString('pt-BR')} kWh)</div>
        </div>
        <div class="mcard" style="border-left:3px solid #EF9F27;">
          <div class="mcard-label">Economia acumulada</div>
          <div class="mcard-val">${economia}</div>
          <div class="mcard-sub ok">Este mês</div>
        </div>
      </div>

      <!-- ══ HISTÓRICO DE GERAÇÃO ══ -->
      <div class="card" id="hist-container">
        <div class="card-hdr" style="flex-wrap:wrap;gap:8px;">
          <div style="display:flex;align-items:center;gap:8px;">
            <div class="card-title">Histórico de geração</div>
            <span id="hist-simulado-badge" style="display:none;background:#FFF3CD;color:#856404;font-size:10px;padding:2px 8px;border-radius:10px;font-weight:600;">Estimado</span>
          </div>
          <div style="display:flex;gap:6px;">
            <button class="btn btn-sm hist-periodo active" data-periodo="7d" onclick="Pages._setPeriodo('${c.id}', '7d', this)">7 dias</button>
            <button class="btn btn-sm hist-periodo" data-periodo="30d" onclick="Pages._setPeriodo('${c.id}', '30d', this)">30 dias</button>
            <button class="btn btn-sm hist-periodo" data-periodo="12m" onclick="Pages._setPeriodo('${c.id}', '12m', this)">12 meses</button>
          </div>
        </div>

        <!-- Stats resumo -->
        <div id="hist-stats" style="display:grid;grid-template-columns:repeat(4,1fr);gap:0;border-bottom:1px solid var(--border);border-top:1px solid var(--border);">
          <div class="hist-stat" style="padding:10px 16px;border-right:1px solid var(--border);">
            <span class="hist-stat-lbl" style="font-size:11px;color:var(--text-secondary);display:block;">Carregando...</span>
          </div>
        </div>

        <!-- Loading overlay -->
        <div id="hist-loading" style="display:none;justify-content:center;align-items:center;padding:20px;gap:8px;font-size:13px;color:var(--text-secondary);">
          <i class="ti ti-loader-2" style="animation:spin 1s linear infinite;"></i> Buscando dados...
        </div>

        <!-- Gráfico -->
        <div class="chart-wrap" style="padding:16px;">
          <canvas id="chart-perfil-hist"></canvas>
        </div>

        <!-- Tabela -->
        <div id="hist-tabela" style="border-top:1px solid var(--border);max-height:280px;overflow-y:auto;"></div>
      </div>

      <div class="card">
        <div class="card-hdr">
          <div class="card-title">Histórico de relatórios enviados</div>
          <button class="btn btn-sm btn-teal" onclick="App.sendRelatorio('${c.id}')">
            <i class="ti ti-send"></i> Enviar novo
          </button>
        </div>
        ${histLog || '<div class="text-muted" style="font-size:12px;padding:12px;">Nenhum relatório enviado ainda.</div>'}
      </div>`;

    // Carrega histórico inicial (7 dias)
    setTimeout(() => Historico.renderizar(c, '7d'), 50);
  },

  _setPeriodo(clienteId, periodo, btn) {
    // Atualiza botões ativos
    document.querySelectorAll('.hist-periodo').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const c = DB.getCliente(clienteId);
    if (c) Historico.renderizar(c, periodo);
  },

  closePerfil() {
    document.getElementById('lista-clientes').style.display = 'block';
    document.getElementById('perfil-cliente').style.display = 'none';
    document.getElementById('pbread').textContent = '';
    Charts.destroy('chart-perfil-hist');
  },

  // ---- Modal Diagnóstico de Alerta ----
  abrirDiagnostico(alertaId) {
    const a = DB.alertas.find(x => x.id === alertaId);
    if (!a) return;
    const cliente = DB.clientes.find(c => a.titulo.startsWith(c.nome));
    Diagnostico.renderModal(a, cliente);
  },

  _abrirDiagnostico_old(alertaId) {
    const a = DB.alertas.find(x => x.id === alertaId);
    if (!a) return;
    const cliente = DB.clientes.find(c => a.titulo.startsWith(c.nome));

    const old = document.getElementById('modal-diagnostico');
    if (old) old.remove();

    const stIcon = a.tipo === 'err' ? '🔴' : '⚠️';
    const stLabel = a.tipo === 'err' ? 'Alarme crítico' : 'Sistema offline';
    const stColor = a.tipo === 'err' ? '#E24B4A' : '#EF9F27';

    const modal = document.createElement('div');
    modal.id = 'modal-diagnostico';
    modal.className = 'modal-overlay open';
    modal.innerHTML = `
      <div class="modal" style="max-width:520px;">
        <div class="modal-header" style="border-bottom:3px solid ${stColor};">
          <h2 style="display:flex;align-items:center;gap:8px;font-size:16px;">
            ${stIcon} Diagnóstico do Alerta
          </h2>
          <button class="btn-icon" onclick="document.getElementById('modal-diagnostico').remove()">
            <i class="ti ti-x"></i>
          </button>
        </div>
        <div style="padding:16px 20px;background:var(--bg-secondary);border-bottom:1px solid var(--border);">
          <div style="font-size:15px;font-weight:600;margin-bottom:4px;">${a.titulo.split(':')[0]}</div>
          <div style="font-size:12px;color:var(--text-secondary);">${a.detalhe}</div>
        </div>
        <div style="padding:16px 20px;">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
            <div style="background:var(--bg-secondary);padding:12px;border-radius:8px;">
              <div style="font-size:11px;color:var(--text-secondary);margin-bottom:4px;">STATUS</div>
              <div style="font-size:14px;font-weight:600;color:${stColor};">${stIcon} ${stLabel}</div>
            </div>
            <div style="background:var(--bg-secondary);padding:12px;border-radius:8px;">
              <div style="font-size:11px;color:var(--text-secondary);margin-bottom:4px;">ÚLTIMA COMUNICAÇÃO</div>
              <div style="font-size:13px;font-weight:600;">${a.detalhe.split('· ').pop()}</div>
            </div>
          </div>
          ${cliente ? `
          <div style="margin-bottom:16px;padding:12px;border:1px solid var(--border);border-radius:8px;">
            <div style="font-size:11px;color:var(--text-secondary);margin-bottom:8px;font-weight:600;text-transform:uppercase;">Dados do cliente</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:13px;">
              <div><span style="color:var(--text-secondary);">E-mail:</span> ${cliente.email || '—'}</div>
              <div><span style="color:var(--text-secondary);">WhatsApp:</span> ${cliente.whats || '—'}</div>
              <div><span style="color:var(--text-secondary);">Potência:</span> ${cliente.potencia} kWp</div>
              <div><span style="color:var(--text-secondary);">Fabricante:</span> ${cliente.inversor}</div>
            </div>
          </div>` : ''}
          <div style="margin-bottom:16px;">
            <div style="font-size:11px;color:var(--text-secondary);margin-bottom:8px;font-weight:600;text-transform:uppercase;">Checklist de diagnóstico</div>
            <div style="display:flex;flex-direction:column;gap:6px;">
              <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;"><input type="checkbox" style="width:14px;height:14px;"> Verificar conexão de rede do inversor</label>
              <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;"><input type="checkbox" style="width:14px;height:14px;"> Checar disjuntores e fusíveis</label>
              <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;"><input type="checkbox" style="width:14px;height:14px;"> Verificar display do inversor (erros/códigos)</label>
              <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;"><input type="checkbox" style="width:14px;height:14px;"> Contatar cliente para confirmação no local</label>
            </div>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            ${cliente?.whats ? `<a href="https://wa.me/55${cliente.whats.replace(/\D/g,'')}" target="_blank" class="btn btn-sm" style="background:#25D366;color:white;border-color:#25D366;"><i class="ti ti-brand-whatsapp"></i> WhatsApp</a>` : ''}
            ${cliente?.email ? `<a href="mailto:${cliente.email}?subject=Alerta: ${encodeURIComponent(a.titulo.split(':')[0])}&body=Identificamos um problema na sua usina solar. Por favor, verifique." class="btn btn-sm"><i class="ti ti-mail"></i> Enviar e-mail</a>` : ''}
            ${cliente ? `<button class="btn btn-sm" onclick="document.getElementById('modal-diagnostico').remove(); Pages.openPerfil('${cliente.id}'); App.navTo('clientes');"><i class="ti ti-user"></i> Ver perfil</button>` : ''}
            <button class="btn btn-sm" style="color:#E24B4A;border-color:#E24B4A;" onclick="App.resolverAlerta('${a.id}'); document.getElementById('modal-diagnostico').remove();"><i class="ti ti-check"></i> Marcar resolvido</button>
          </div>
        </div>
      </div>`;

    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
  },

  // ---- Modal Perfil do Inversor ----
  abrirPerfilInversor(invId) {
    const inv = DB.inversores.find(i => i.id === invId);
    if (!inv) return;
    const cliente = DB.clientes.find(c => c.nome === inv.cliente);

    const old = document.getElementById('modal-inversor');
    if (old) old.remove();

    const stColor = inv.status === 'ok' ? '#1D9E75' : inv.status === 'err' ? '#E24B4A' : '#EF9F27';
    const stIcon  = inv.status === 'ok' ? '🟢' : inv.status === 'err' ? '🔴' : '⚠️';

    const modal = document.createElement('div');
    modal.id = 'modal-inversor';
    modal.className = 'modal-overlay open';
    modal.innerHTML = `
      <div class="modal" style="max-width:520px;">
        <div class="modal-header" style="border-bottom:3px solid ${stColor};">
          <h2 style="display:flex;align-items:center;gap:8px;font-size:16px;">
            <div style="background:${inv.bgCol};color:${inv.txtCol};width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;">${inv.sigla}</div>
            ${inv.modelo}
          </h2>
          <button class="btn-icon" onclick="document.getElementById('modal-inversor').remove()"><i class="ti ti-x"></i></button>
        </div>
        <div style="padding:16px 20px;">
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:16px;">
            <div style="background:var(--bg-secondary);padding:12px;border-radius:8px;text-align:center;">
              <div style="font-size:11px;color:var(--text-secondary);margin-bottom:4px;">STATUS</div>
              <div style="font-size:14px;font-weight:700;color:${stColor};">${stIcon} ${inv.statusLabel}</div>
            </div>
            <div style="background:var(--bg-secondary);padding:12px;border-radius:8px;text-align:center;">
              <div style="font-size:11px;color:var(--text-secondary);margin-bottom:4px;">GERAÇÃO HOJE</div>
              <div style="font-size:16px;font-weight:700;color:${inv.status === 'ok' ? '#1D9E75' : '#E24B4A'};">${inv.geracaoHoje} kWh</div>
            </div>
            <div style="background:var(--bg-secondary);padding:12px;border-radius:8px;text-align:center;">
              <div style="font-size:11px;color:var(--text-secondary);margin-bottom:4px;">TEMPERATURA</div>
              <div style="font-size:16px;font-weight:700;">${inv.temp ? inv.temp + '°C' : '—'}</div>
            </div>
          </div>
          <div style="margin-bottom:16px;padding:12px;border:1px solid var(--border);border-radius:8px;">
            <div style="font-size:11px;color:var(--text-secondary);margin-bottom:8px;font-weight:600;text-transform:uppercase;">Detalhes técnicos</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:13px;">
              <div><span style="color:var(--text-secondary);">Fabricante:</span> <strong>${inv.modelo.split(' ')[0]}</strong></div>
              <div><span style="color:var(--text-secondary);">Número de série:</span> <strong>${inv.serial}</strong></div>
              <div><span style="color:var(--text-secondary);">API:</span> <strong>${inv.api}</strong></div>
              <div><span style="color:var(--text-secondary);">Cliente:</span> <strong>${inv.cliente}</strong></div>
            </div>
          </div>
          ${cliente ? `
          <div style="margin-bottom:16px;padding:12px;border:1px solid var(--border);border-radius:8px;">
            <div style="font-size:11px;color:var(--text-secondary);margin-bottom:8px;font-weight:600;text-transform:uppercase;">Cliente vinculado</div>
            <div style="display:flex;align-items:center;gap:10px;">
              <div class="avatar" style="background:${cliente.avBg};color:${cliente.avCor};">${cliente.iniciais}</div>
              <div style="flex:1;">
                <div style="font-size:14px;font-weight:600;">${cliente.nome}</div>
                <div style="font-size:12px;color:var(--text-secondary);">${cliente.email || '—'} · ${cliente.whats || 'Sem WhatsApp'}</div>
              </div>
            </div>
          </div>` : ''}
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            ${cliente?.whats ? `<a href="https://wa.me/55${cliente.whats.replace(/\D/g,'')}" target="_blank" class="btn btn-sm" style="background:#25D366;color:white;border-color:#25D366;"><i class="ti ti-brand-whatsapp"></i> WhatsApp</a>` : ''}
            ${cliente ? `<button class="btn btn-sm btn-teal" onclick="document.getElementById('modal-inversor').remove(); App.navTo('clientes'); setTimeout(()=>Pages.openPerfil('${cliente.id}'),100);"><i class="ti ti-user"></i> Ver perfil do cliente</button>` : ''}
            <button class="btn btn-sm" onclick="document.getElementById('modal-inversor').remove();"><i class="ti ti-x"></i> Fechar</button>
          </div>
        </div>
      </div>`;

    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
  },

  // ---- Inversores ----
  inversores() {
    const online  = DB.inversores.filter(i => i.status === 'ok').length;
    const offline = DB.inversores.filter(i => i.status !== 'ok').length;
    const fabricantes = [...new Set(DB.inversores.map(i => i.modelo.split(' ')[0]))];
    const fabLabel = fabricantes.slice(0, 4).join(' · ');

    const cards = DB.inversores.map(i => `
      <div class="inv-card" style="cursor:pointer;" onclick="Pages.abrirPerfilInversor('${i.id}')">
        <div class="inv-logo" style="background:${i.bgCol};color:${i.txtCol};">${i.sigla}</div>
        <div class="inv-info">
          <div class="inv-name">${i.modelo} ${this.badgeStatus(i.status, i.statusLabel)}</div>
          <div class="inv-meta">${i.cliente} · S/N: ${i.serial}</div>
        </div>
        <div class="inv-stats">
          <div class="inv-stat">
            <div class="inv-stat-val ${i.status === 'ok' ? 'ok' : i.status === 'warn' ? 'warn' : 'err'}">${i.geracaoHoje} kWh</div>
            <div class="inv-stat-lbl">Hoje</div>
          </div>
          <div class="inv-stat">
            <div class="inv-stat-val ${i.temp ? '' : 'err'}">${i.temp ? i.temp + '°C' : '—'}</div>
            <div class="inv-stat-lbl">Temp.</div>
          </div>
        </div>
      </div>`).join('');

    return `
    <div class="grid-3">
      <div class="mcard" style="border-left:3px solid #1D9E75;">
        <div class="mcard-label">Online</div>
        <div class="mcard-val ok">${online}</div>
        <div class="mcard-sub ok">De ${DB.inversores.length} monitorados</div>
      </div>
      <div class="mcard" style="border-left:3px solid ${offline > 0 ? '#E24B4A' : '#1D9E75'};">
        <div class="mcard-label">Offline / Alarme</div>
        <div class="mcard-val ${offline > 0 ? 'err' : ''}">${offline}</div>
        <div class="mcard-sub ${offline > 0 ? 'err' : ''}">Requerem atenção</div>
      </div>
      <div class="mcard" style="border-left:3px solid #3B82F6;">
        <div class="mcard-label">Fabricantes</div>
        <div class="mcard-val">${fabricantes.length}</div>
        <div class="mcard-sub text-muted">${fabLabel}</div>
      </div>
    </div>
    <div class="card">
      <div class="card-hdr">
        <div class="card-title">Inversores monitorados</div>
        <div class="card-meta">Clique para ver detalhes · Atualizado agora</div>
      </div>
      ${cards}
    </div>
    <div class="card">
      <div class="card-hdr"><div class="card-title">Adicionar novo inversor</div></div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin-bottom:12px;">
        <div class="form-group" style="margin:0;">
          <label>Fabricante</label>
          <select id="inv-fab">
            <option>Solis</option><option>Growatt</option><option>GoodWe</option>
            <option>Fronius</option><option>Solplanet</option><option>Kehua</option>
            <option>Renac</option><option>Huawei</option><option>ABB</option>
          </select>
        </div>
        <div class="form-group" style="margin:0;">
          <label>Número de série</label>
          <input type="text" id="inv-serial" placeholder="Ex: GW20230512" />
        </div>
        <div class="form-group" style="margin:0;">
          <label>Cliente vinculado</label>
          <select id="inv-cliente">
            ${DB.clientes.map(c => `<option value="${c.id}">${c.nome}</option>`).join('')}
          </select>
        </div>
      </div>
      <button class="btn btn-teal" onclick="App.addInversor()"><i class="ti ti-plug"></i> Conectar inversor</button>
    </div>
    <div class="card">
      <div class="card-hdr"><div class="card-title">Geração hoje por inversor online</div></div>
      <div class="chart-wrap chart-wrap-tall"><canvas id="chart-inv-geracao"></canvas></div>
    </div>`;
  },

  // ---- Alertas ----
  alertas() {
    const criticos = DB.alertas.filter(a => a.tipo === 'err').length;
    const atencao  = DB.alertas.filter(a => a.tipo === 'warn').length;
    const items = DB.alertas.map(a => `
      <div class="alert-item a-${a.tipo}" id="alerta-${a.id}" style="cursor:pointer;" onclick="Pages.abrirDiagnostico('${a.id}')">
        <i class="ti ${a.icon}"></i>
        <div style="flex:1;">
          <div class="atxt" style="display:flex;align-items:center;gap:6px;">
            <strong>${a.titulo.split(':')[0]}</strong>
            <span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:10px;${
              a.tipoAlerta === 'alarme'
                ? 'background:#FCEBEB;color:#A32D2D;'
                : 'background:#F3F4F6;color:#374151;'
            }">
              ${a.tipoAlerta === 'alarme' ? '🔴 ALARME' : '⚫ OFFLINE'}
            </span>
          </div>
          <div class="atime">${a.detalhe}</div>
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0;">
          <button class="btn btn-sm" onclick="event.stopPropagation(); Pages.abrirDiagnostico('${a.id}')">Diagnosticar <i class="ti ti-arrow-right"></i></button>
          <button class="btn btn-sm" onclick="event.stopPropagation(); App.resolverAlerta('${a.id}')" title="Marcar como resolvido"><i class="ti ti-check"></i></button>
        </div>
      </div>`).join('');

    return `
    <div class="grid-3">
      <div class="mcard" style="border-left:3px solid #E24B4A;"><div class="mcard-label">Críticos</div><div class="mcard-val err">${criticos}</div><div class="mcard-sub err">Ação imediata</div></div>
      <div class="mcard" style="border-left:3px solid #EF9F27;"><div class="mcard-label">Atenção</div><div class="mcard-val warn">${atencao}</div><div class="mcard-sub warn">Monitorar</div></div>
      <div class="mcard" style="border-left:3px solid #1D9E75;"><div class="mcard-label">Resolvidos (30d)</div><div class="mcard-val">14</div><div class="mcard-sub ok">100% resolvidos</div></div>
    </div>
    <div class="card">
      <div class="card-hdr"><div class="card-title">Alertas ativos</div><div class="card-meta">Clique para diagnosticar</div></div>
      <div style="padding:10px 16px;border-bottom:1px solid var(--border);">
        <div style="position:relative;">
          <i class="ti ti-search" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--text-secondary);font-size:14px;"></i>
          <input type="text" id="busca-alertas" placeholder="Buscar por nome do cliente..."
            oninput="Pages.filtrarAlertas(this.value)"
            style="width:100%;padding:8px 12px 8px 32px;border:1px solid var(--border);border-radius:8px;font-size:13px;background:var(--bg-secondary);outline:none;" />
        </div>
      </div>
      <div id="alertas-list">${items}</div>
      ${DB.alertas.length === 0 ? '<div class="text-center text-muted" style="padding:20px 0;">Nenhum alerta ativo.</div>' : ''}
    </div>`;
  },

  // ---- Relatórios ----
  relatorios() {
    const totalClientes = DB.clientes.length;
    const comWhats = DB.clientes.filter(c => c.whats).length;
    const semWhats = totalClientes - comWhats;
    const logs = DB.relatorios.map(r => `
      <div class="trow" style="grid-template-columns:2fr 1fr 1fr 1fr;">
        <div class="font-bold">${r.nome}</div>
        <div>${r.clientes} clientes</div>
        <div>${this.badgeStatus(r.status, 'Enviado')}</div>
        <div><button class="btn btn-sm" onclick="App.previewRelatorio('${r.id}')"><i class="ti ti-eye"></i> Ver</button></div>
      </div>`).join('');

    return `
    <div class="grid-3">
      <div class="mcard" style="border-left:3px solid #1D9E75;"><div class="mcard-label"><i class="ti ti-mail"></i>Clientes com e-mail</div><div class="mcard-val">${totalClientes}</div><div class="mcard-sub ok">Prontos para envio</div></div>
      <div class="mcard" style="border-left:3px solid ${semWhats > 0 ? '#EF9F27' : '#1D9E75'};"><div class="mcard-label"><i class="ti ti-brand-whatsapp"></i>Com WhatsApp</div><div class="mcard-val">${comWhats}</div><div class="mcard-sub ${semWhats > 0 ? 'warn' : 'ok'}">${semWhats > 0 ? semWhats + ' sem número' : 'Todos cadastrados'}</div></div>
      <div class="mcard" style="border-left:3px solid #3B82F6;"><div class="mcard-label"><i class="ti ti-file-type-pdf"></i>Total de plantas</div><div class="mcard-val">${totalClientes}</div><div class="mcard-sub ok">100% monitoradas</div></div>
    </div>
    <div class="card">
      <div class="card-hdr"><div class="card-title">Template do relatório</div><div class="card-meta">Personalização</div></div>
      <div class="report-tpl">
        <div class="report-tpl-hdr">
          <div class="report-tpl-icon"><i class="ti ti-file-description"></i></div>
          <div style="flex:1;"><div style="font-size:13px;font-weight:600;">Relatório mensal padrão</div><div style="font-size:11px;color:var(--text-secondary);">PDF + E-mail HTML + Mensagem WhatsApp</div></div>
          <span class="badge b-ok">Ativo</span>
        </div>
        <div class="channels">
          <div class="ch-pill on" onclick="this.classList.toggle('on')"><i class="ti ti-mail"></i>E-mail</div>
          <div class="ch-pill on" onclick="this.classList.toggle('on')"><i class="ti ti-brand-whatsapp"></i>WhatsApp</div>
          <div class="ch-pill on" onclick="this.classList.toggle('on')"><i class="ti ti-file-type-pdf"></i>PDF</div>
          <div class="ch-pill" onclick="this.classList.toggle('on')"><i class="ti ti-device-mobile"></i>Push app</div>
        </div>
        <div class="preview-box">
          <strong>Assunto:</strong> Seu relatório solar de maio 2026 — {nome_cliente}<br><br>
          Olá, <strong>{nome_cliente}</strong>!<br>
          Em maio, sua usina solar gerou <strong>{kwh_mes} kWh</strong>, representando uma economia de <strong>R$ {economia}</strong> na sua conta de energia.<br><br>
          <strong>Desempenho:</strong> {percentual_meta}% da meta mensal &nbsp;·&nbsp; <strong>Irradiação:</strong> {irradiacao} kWh/m²<br>
          <strong>Status do sistema:</strong> {status_sistema}<br><br>
          <span class="preview-highlight">Ver relatório completo em PDF ↓</span>
        </div>
        <div style="display:flex;gap:8px;margin-top:10px;">
          <button class="btn" onclick="App.customizarTemplate()"><i class="ti ti-brush"></i> Personalizar</button>
          <button class="btn btn-teal" onclick="App.previewRelatorio('preview')"><i class="ti ti-eye"></i> Pré-visualizar</button>
        </div>
      </div>
    </div>
    <div class="card">
      <div class="card-hdr"><div class="card-title">Histórico de envios</div></div>
      <div class="thdr" style="grid-template-columns:2fr 1fr 1fr 1fr;"><div>Relatório</div><div>Clientes</div><div>Status</div><div>Ação</div></div>
      ${logs || '<div class="text-muted" style="padding:12px;font-size:12px;">Nenhum relatório enviado ainda.</div>'}
      <div style="padding:12px 0 0;">
        <button class="btn btn-teal" style="width:100%;justify-content:center;" onclick="App.enviarTodosRelatorios()">
          <i class="ti ti-send"></i> Gerar e enviar relatório de Maio 2026
        </button>
      </div>
    </div>`;
  },

  filtrarAlertas(termo) {
    const lista = document.getElementById('alertas-list');
    if (!lista) return;
    const t = termo.toLowerCase().trim();
    lista.querySelectorAll('.alert-item').forEach(el => {
      const txt = el.querySelector('.atxt')?.textContent?.toLowerCase() || '';
      el.style.display = (!t || txt.includes(t)) ? '' : 'none';
    });
    const visiveis = [...lista.querySelectorAll('.alert-item')].filter(el => el.style.display !== 'none').length;
    const meta = document.querySelector('.card-hdr .card-meta');
    if (meta) meta.textContent = t ? `${visiveis} resultado(s)` : 'Clique para diagnosticar';
  },

  config(cfg = {}) {
    const on = (val) => val === false ? 'off' : '';

    // Conta plantas por fabricante a partir do DB
    const solisPlants    = DB.clientes.filter(c => (c.inversor||'').toLowerCase().includes('solis') || (c.inversor||'') === '—' || (c.inversor||'').toLowerCase() === 'solis').length;
    const solplanetCount = DB.clientes.filter(c => (c.inversor||'').toLowerCase().includes('solplanet')).length;
    const froniusCount   = DB.clientes.filter(c => (c.inversor||'').toLowerCase().includes('fronius')).length;
    const solisOnline    = DB.inversores.filter(i => i.api === 'Solis Cloud' && i.status === 'ok').length;
    const spOnline       = DB.inversores.filter(i => i.api === 'SolPlanet Cloud' && i.status === 'ok').length;
    const frOnline       = DB.inversores.filter(i => i.api === 'Fronius Solar.web' && i.status === 'ok').length;
    const now            = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    // Card de integração ativa
    const cardAtivo = (nome, sigla, cor, plantas, online, url, descricao) => `
      <div style="padding:12px 0;border-bottom:1px solid var(--border);">
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:36px;height:36px;border-radius:8px;background:${cor}22;color:${cor};display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0;">${sigla}</div>
          <div style="flex:1;min-width:0;">
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
              <span style="font-size:13px;font-weight:600;">${nome}</span>
              <span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:600;color:#1D9E75;">
                <span style="width:6px;height:6px;background:#1D9E75;border-radius:50%;display:inline-block;"></span>Ativo
              </span>
            </div>
            <div style="font-size:11px;color:var(--text-secondary);margin-top:2px;">${url} · ${descricao}</div>
            <div style="font-size:11px;color:var(--text-secondary);margin-top:2px;">${plantas} plantas · ${online} online · sync ${now}</div>
          </div>
        </div>
      </div>`;

    // Card de integração pendente
    const cardPendente = (nome, sigla, cor, plantas, motivo) => `
      <div style="padding:12px 0;border-bottom:1px solid var(--border);">
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:36px;height:36px;border-radius:8px;background:#F3F4F6;color:#9CA3AF;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0;">${sigla}</div>
          <div style="flex:1;min-width:0;">
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
              <span style="font-size:13px;font-weight:600;color:#6B7280;">${nome}</span>
              <span style="background:#FFF3CD;color:#856404;font-size:10px;font-weight:600;padding:2px 8px;border-radius:20px;">⏳ Pendente</span>
            </div>
            <div style="font-size:11px;color:var(--text-secondary);margin-top:2px;">${motivo} · ${plantas} plantas</div>
          </div>
        </div>
      </div>`;

    return `
    <div class="grid-2">
      <div class="card">
        <div class="card-hdr"><div class="card-title">Envio de relatórios</div></div>
        <div class="config-row"><div><div class="config-label">Envio automático mensal</div><div class="config-sub">1º dia de cada mês</div></div><button class="toggle ${on(cfg.envioAutomatico)}" onclick="this.classList.toggle('off')" aria-label="Toggle envio automático"></button></div>
        <div class="config-row"><div><div class="config-label">E-mail (Resend)</div><div class="config-sub">Configurado e ativo</div></div><button class="toggle ${on(cfg.email)}" onclick="this.classList.toggle('off')" aria-label="Toggle email"></button></div>
        <div class="config-row"><div><div class="config-label">WhatsApp Business API</div><div class="config-sub">Evolution API no Railway</div></div><button class="toggle ${on(cfg.whatsapp)}" onclick="this.classList.toggle('off')" aria-label="Toggle WhatsApp"></button></div>
        <div class="config-row"><div><div class="config-label">PDF automático</div><div class="config-sub">Gerado para todos os clientes</div></div><button class="toggle ${on(cfg.pdf)}" onclick="this.classList.toggle('off')" aria-label="Toggle PDF"></button></div>
        <div class="form-group mt-8"><label>E-mail remetente</label><input type="email" value="${cfg.emailRemetente || 'relatorios@suaempresa.com.br'}" /></div>
        <div class="form-group"><label>Nome do remetente</label><input type="text" placeholder="Infortel Solar — SolarCRM" value="${cfg.nomeRemetente || 'Infortel Solar — SolarCRM'}" /></div>
      </div>

      <div class="card">
        <div class="card-hdr">
          <div class="card-title">Integrações de inversores</div>
          <div class="card-meta">${DB.clientes.length} plantas · Sync às ${now}</div>
        </div>
        <div style="padding:0 16px;">
          ${cardAtivo('Solis Cloud', 'SOL', '#1D9E75', DB.inversores.filter(i=>i.api==='Solis Cloud').length, solisOnline, 'soliscloud.com', 'API direta')}
          ${cardAtivo('SolPlanet', 'SP', '#3730A3', DB.inversores.filter(i=>i.api==='SolPlanet Cloud').length, spOnline, 'solplanet.net', 'Alibaba Cloud')}
          ${cardAtivo('Fronius Solar.web', 'FRO', '#1565C0', DB.inversores.filter(i=>i.api==='Fronius Solar.web').length, frOnline, 'swqapi.solarweb.com', 'JWT Auth')}
          ${cardPendente('Growatt', 'GRO', '#EF9F27', 39, 'Aguardando token de integrador')}
          ${cardPendente('Sofar / SOLARMAN', 'SFR', '#8B5CF6', 258, 'Aguardando credenciais API')}
          ${cardPendente('GoodWe', 'GW', '#0EA5E9', 46, 'Aguardando documentação')}
          ${cardPendente('Kehua', 'KH', '#6B7280', 1, 'Aguardando credenciais')}
          ${cardPendente('Renac', 'RNC', '#6B7280', 2, 'Aguardando credenciais')}
        </div>
      </div>
    </div>

    <!-- Resumo do sistema -->
    <div class="card">
      <div class="card-hdr"><div class="card-title">Resumo do sistema</div></div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:0;border-top:1px solid var(--border);">
        <div style="padding:16px;text-align:center;border-right:1px solid var(--border);">
          <div style="font-size:24px;font-weight:700;color:#1D9E75;">${DB.clientes.length}</div>
          <div style="font-size:11px;color:var(--text-secondary);">Plantas monitoradas</div>
        </div>
        <div style="padding:16px;text-align:center;border-right:1px solid var(--border);">
          <div style="font-size:24px;font-weight:700;color:#3B82F6;">${DB.inversores.filter(i=>i.status==='ok').length}</div>
          <div style="font-size:11px;color:var(--text-secondary);">Online agora</div>
        </div>
        <div style="padding:16px;text-align:center;border-right:1px solid var(--border);">
          <div style="font-size:24px;font-weight:700;color:#EF9F27;">${DB.alertas.length}</div>
          <div style="font-size:11px;color:var(--text-secondary);">Alertas ativos</div>
        </div>
        <div style="padding:16px;text-align:center;border-right:1px solid var(--border);">
          <div style="font-size:24px;font-weight:700;">3</div>
          <div style="font-size:11px;color:var(--text-secondary);">APIs integradas</div>
        </div>
        <div style="padding:16px;text-align:center;">
          <div style="font-size:24px;font-weight:700;color:#8B5CF6;">5</div>
          <div style="font-size:11px;color:var(--text-secondary);">APIs pendentes</div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-hdr"><div class="card-title">Alertas automáticos</div></div>
      <div class="config-row"><div><div class="config-label">Inversor offline por mais de 2h</div><div class="config-sub">Notifica gestor e cliente por e-mail</div></div><button class="toggle ${on(cfg.alertaOffline)}" onclick="this.classList.toggle('off')" aria-label="Toggle alerta inversor"></button></div>
      <div class="config-row"><div><div class="config-label">Geração abaixo de 70% da meta</div><div class="config-sub">Notifica gestor</div></div><button class="toggle ${on(cfg.alertaGeracao)}" onclick="this.classList.toggle('off')" aria-label="Toggle alerta geração"></button></div>
      <div class="config-row"><div><div class="config-label">Queda de eficiência >5% em 30 dias</div><div class="config-sub">Sugere manutenção preventiva</div></div><button class="toggle ${on(cfg.alertaEficiencia)}" onclick="this.classList.toggle('off')" aria-label="Toggle alerta eficiência"></button></div>
      <div style="text-align:right;margin-top:12px;">
        <button class="btn btn-teal" onclick="App.salvarConfig()"><i class="ti ti-device-floppy"></i> Salvar configurações</button>
      </div>
    </div>`;
  },
};
