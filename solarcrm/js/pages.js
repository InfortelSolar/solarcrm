// ============================================================
//  SolarCRM — Construtores de páginas (HTML strings)
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
    const criticos = DB.alertas.filter(a => a.tipo === 'err').length;
    const alertasSub = criticos > 0 ? `${criticos} críticos` : 'Monitorando';
    const alertasClass = criticos > 0 ? 'err' : 'ok';

    const alertasRecentes = DB.alertas.slice(0, 3);

    return `
    <div class="grid-metrics">
      <div class="mcard">
        <div class="mcard-label"><i class="ti ti-bolt" style="color:#1D9E75;"></i>Geração hoje</div>
        <div class="mcard-val">${d.geracaoHoje.toLocaleString('pt-BR')} kWh</div>
        <div class="mcard-sub ok">Potência total instalada</div>
      </div>
      <div class="mcard">
        <div class="mcard-label"><i class="ti ti-users"></i>Clientes ativos</div>
        <div class="mcard-val">${d.clientesAtivos}</div>
        <div class="mcard-sub ok">Plantas monitoradas</div>
      </div>
      <div class="mcard">
        <div class="mcard-label"><i class="ti ti-coin"></i>Economia / mês</div>
        <div class="mcard-val">R$ ${d.economiaMes.toLocaleString('pt-BR')}</div>
        <div class="mcard-sub ok">Estimativa mensal</div>
      </div>
      <div class="mcard">
        <div class="mcard-label"><i class="ti ti-alert-triangle" style="color:#EF9F27;"></i>Alertas ativos</div>
        <div class="mcard-val">${d.alertasAtivos}</div>
        <div class="mcard-sub ${alertasClass}">${alertasSub}</div>
      </div>
    </div>

    <div class="grid-2">
      <div class="card mb-0">
        <div class="card-hdr">
          <div class="card-title">Geração — últimos 7 dias</div>
          <div class="card-meta">kWh/dia</div>
        </div>
        <div class="chart-wrap">
          <canvas id="chart-geracao-dias" role="img" aria-label="Geração de energia diária nos últimos 7 dias"></canvas>
        </div>
      </div>
      <div class="card mb-0">
        <div class="card-hdr">
          <div class="card-title">Performance por cliente</div>
          <div class="card-meta">% da meta de geração</div>
        </div>
        ${DB.clientes.slice(0, 15).map(c => `
          <div class="prow">
            <div class="plabel">
              <span>${c.nome}</span>
              <span class="${c.performance >= 80 ? 'ok' : c.performance >= 50 ? 'warn' : 'err'}">${c.performance}%</span>
            </div>
            ${this.perfBar(c.performance)}
          </div>
        `).join('')}
      </div>
    </div>

    <div class="grid-2" style="margin-bottom:0;">
      <div class="card mb-0">
        <div class="card-hdr">
          <div class="card-title">Economia acumulada 2026</div>
          <div class="card-meta">R$ / mês</div>
        </div>
        <div class="chart-wrap">
          <canvas id="chart-economia-meses" role="img" aria-label="Economia acumulada mensal em 2026"></canvas>
        </div>
      </div>
      <div class="card mb-0">
        <div class="card-hdr">
          <div class="card-title">Alertas recentes</div>
          <button class="btn btn-sm" onclick="App.navTo('alertas')">Ver todos</button>
        </div>
        ${alertasRecentes.length > 0 ? alertasRecentes.map(a => `
          <div class="alert-item a-${a.tipo}">
            <i class="ti ${a.icon}"></i>
            <div class="atxt" style="flex:1;">
              <div>${a.titulo.replace(/^[^:]+: /, '')}</div>
              <div class="atime">${a.detalhe.split(' · ')[0]}</div>
            </div>
            <button class="btn btn-sm" onclick="App.navTo('alertas')">Ver</button>
          </div>
        `).join('') : '<div class="text-muted" style="padding:16px 0;font-size:12px;">Nenhum alerta ativo.</div>'}
      </div>
    </div>`;
  },

  // ---- Lista de clientes ----
  clientes() {
    const tipos = [...new Set(DB.clientes.map(c => c.tipo))];
    const residencial = DB.clientes.filter(c => c.tipo === 'Residencial').length;
    const comercial = DB.clientes.filter(c => c.tipo === 'Comercial').length;
    const solar = DB.clientes.filter(c => c.tipo === 'Solar').length;
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
      </div>
    `).join('');

    return `
    <div id="lista-clientes">
      <div class="tab-bar">
        <div class="tab active" onclick="Pages.filterClientes('todos', this)">Todos (${DB.clientes.length})</div>
        ${solar > 0 ? `<div class="tab" onclick="Pages.filterClientes('Solar', this)">Solar (${solar})</div>` : ''}
        ${residencial > 0 ? `<div class="tab" onclick="Pages.filterClientes('Residencial', this)">Residencial (${residencial})</div>` : ''}
        ${comercial > 0 ? `<div class="tab" onclick="Pages.filterClientes('Comercial', this)">Comercial (${comercial})</div>` : ''}
        <div class="tab" onclick="Pages.filterClientes('alertas', this)">Alertas (${comAlertas})</div>
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
        <div class="mcard">
          <div class="mcard-label">Geração hoje</div>
          <div class="mcard-val">${c.geracaoHoje} kWh</div>
          <div class="mcard-sub ${c.status === 'ok' ? 'ok' : c.status === 'warn' ? 'warn' : 'err'}">
            ${c.status === 'err' ? 'Sistema offline' : c.status === 'warn' ? 'Abaixo da meta' : '↑ Normal'}
          </div>
        </div>
        <div class="mcard">
          <div class="mcard-label">Geração este mês</div>
          <div class="mcard-val">${c.geracaoMes.toLocaleString('pt-BR')} kWh</div>
          <div class="mcard-sub text-muted">${percMeta}% da meta (${c.metaMes.toLocaleString('pt-BR')} kWh)</div>
        </div>
        <div class="mcard">
          <div class="mcard-label">Economia acumulada</div>
          <div class="mcard-val">${economia}</div>
          <div class="mcard-sub ok">Este mês</div>
        </div>
      </div>

      <div class="card">
        <div class="card-hdr">
          <div class="card-title">Histórico de geração — 12 meses</div>
          <div class="card-meta">kWh / mês</div>
        </div>
        <div class="chart-wrap">
          <canvas id="chart-perfil-hist" role="img" aria-label="Histórico de geração mensal do cliente ${c.nome}"></canvas>
        </div>
      </div>

      <div class="card">
        <div class="card-hdr">
          <div class="card-title">Histórico de relatórios enviados</div>
          <button class="btn btn-sm btn-teal" onclick="App.sendRelatorio('${c.id}')">
            <i class="ti ti-send"></i> Enviar novo
          </button>
        </div>
        ${histLog || '<div class="text-muted" style="font-size:12px;">Nenhum relatório enviado ainda.</div>'}
      </div>`;

    setTimeout(() => Charts.renderPerfil(c), 50);
  },

  closePerfil() {
    document.getElementById('lista-clientes').style.display = 'block';
    document.getElementById('perfil-cliente').style.display = 'none';
    document.getElementById('pbread').textContent = '';
    Charts.destroy('chart-perfil-hist');
  },

  // ---- Inversores ----
  inversores() {
    const online  = DB.inversores.filter(i => i.status === 'ok').length;
    const offline = DB.inversores.filter(i => i.status !== 'ok').length;
    const fabricantes = [...new Set(DB.inversores.map(i => i.modelo.split(' ')[0]))];
    const fabLabel = fabricantes.slice(0, 4).join(' · ');

    const cards = DB.inversores.map(i => `
      <div class="inv-card">
        <div class="inv-logo" style="background:${i.bgCol};color:${i.txtCol};">${i.sigla}</div>
        <div class="inv-info">
          <div class="inv-name">
            ${i.modelo}
            ${this.badgeStatus(i.status, i.statusLabel)}
          </div>
          <div class="inv-meta">${i.cliente} · S/N: ${i.serial} · ${i.api}</div>
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
      <div class="mcard"><div class="mcard-label">Online</div><div class="mcard-val ok">${online}</div><div class="mcard-sub ok">De ${DB.inversores.length} monitorados</div></div>
      <div class="mcard"><div class="mcard-label">Offline / Alarme</div><div class="mcard-val ${offline > 0 ? 'err' : ''}">${offline}</div><div class="mcard-sub ${offline > 0 ? 'err' : ''}">Requerem atenção</div></div>
      <div class="mcard"><div class="mcard-label">Fabricantes</div><div class="mcard-val">${fabricantes.length}</div><div class="mcard-sub text-muted">${fabLabel}</div></div>
    </div>

    <div class="card">
      <div class="card-hdr"><div class="card-title">Inversores monitorados</div><div class="card-meta">Atualizado agora</div></div>
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
      <button class="btn btn-teal" onclick="App.addInversor()">
        <i class="ti ti-plug"></i> Conectar inversor
      </button>
    </div>

    <div class="card">
      <div class="card-hdr"><div class="card-title">Geração hoje por inversor online</div></div>
      <div class="chart-wrap chart-wrap-tall">
        <canvas id="chart-inv-geracao" role="img" aria-label="Geração de energia por inversor online hoje"></canvas>
      </div>
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
        <div>
          <button class="btn btn-sm" onclick="App.previewRelatorio('${r.id}')">
            <i class="ti ti-eye"></i> Ver
          </button>
        </div>
      </div>`).join('');

    return `
    <div class="grid-3">
      <div class="mcard"><div class="mcard-label"><i class="ti ti-mail"></i>Clientes com e-mail</div><div class="mcard-val">${totalClientes}</div><div class="mcard-sub ok">Prontos para envio</div></div>
      <div class="mcard"><div class="mcard-label"><i class="ti ti-brand-whatsapp"></i>Com WhatsApp</div><div class="mcard-val">${comWhats}</div><div class="mcard-sub ${semWhats > 0 ? 'warn' : 'ok'}">${semWhats > 0 ? semWhats + ' sem número' : 'Todos cadastrados'}</div></div>
      <div class="mcard"><div class="mcard-label"><i class="ti ti-file-type-pdf"></i>Total de plantas</div><div class="mcard-val">${totalClientes}</div><div class="mcard-sub ok">100% monitoradas</div></div>
    </div>

    <div class="card">
      <div class="card-hdr"><div class="card-title">Template do relatório</div><div class="card-meta">Personalização</div></div>
      <div class="report-tpl">
        <div class="report-tpl-hdr">
          <div class="report-tpl-icon"><i class="ti ti-file-description"></i></div>
          <div style="flex:1;">
            <div style="font-size:13px;font-weight:600;">Relatório mensal padrão</div>
            <div style="font-size:11px;color:var(--text-secondary);">PDF + E-mail HTML + Mensagem WhatsApp</div>
          </div>
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
          Em maio, sua usina solar gerou <strong>{kwh_mes} kWh</strong>, representando uma economia de
          <strong>R$ {economia}</strong> na sua conta de energia.<br><br>
          <strong>Desempenho:</strong> {percentual_meta}% da meta mensal &nbsp;·&nbsp;
          <strong>Irradiação:</strong> {irradiacao} kWh/m²<br>
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
      <div class="thdr" style="grid-template-columns:2fr 1fr 1fr 1fr;">
        <div>Relatório</div><div>Clientes</div><div>Status</div><div>Ação</div>
      </div>
      ${logs || '<div class="text-muted" style="padding:12px 0;font-size:12px;">Nenhum relatório enviado ainda.</div>'}
      <div style="padding:12px 0 0;">
        <button class="btn btn-teal" style="width:100%;justify-content:center;"
          onclick="App.enviarTodosRelatorios()">
          <i class="ti ti-send"></i> Gerar e enviar relatório de Maio 2026
        </button>
      </div>
    </div>`;
  },

  // ---- Alertas ----
  alertas() {
    const criticos = DB.alertas.filter(a => a.tipo === 'err').length;
    const atencao  = DB.alertas.filter(a => a.tipo === 'warn').length;

    const items = DB.alertas.map(a => `
      <div class="alert-item a-${a.tipo}" id="alerta-${a.id}">
        <i class="ti ${a.icon}"></i>
        <div style="flex:1;">
          <div class="atxt"><strong>${a.titulo}</strong></div>
          <div class="atime">${a.detalhe}</div>
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0;">
          <button class="btn btn-sm" onclick="App.diagnosticarAlerta('${a.id}')">
            ${a.acao} <i class="ti ti-arrow-right"></i>
          </button>
          <button class="btn btn-sm" onclick="App.resolverAlerta('${a.id}')" title="Marcar como resolvido">
            <i class="ti ti-check"></i>
          </button>
        </div>
      </div>`).join('');

    return `
    <div class="grid-3">
      <div class="mcard"><div class="mcard-label">Críticos</div><div class="mcard-val err">${criticos}</div><div class="mcard-sub err">Ação imediata</div></div>
      <div class="mcard"><div class="mcard-label">Atenção</div><div class="mcard-val warn">${atencao}</div><div class="mcard-sub warn">Monitorar</div></div>
      <div class="mcard"><div class="mcard-label">Resolvidos (30d)</div><div class="mcard-val">14</div><div class="mcard-sub ok">100% resolvidos</div></div>
    </div>
    <div class="card">
      <div class="card-hdr"><div class="card-title">Alertas ativos</div></div>
      <div id="alertas-list">${items}</div>
      ${DB.alertas.length === 0 ? '<div class="text-center text-muted" style="padding:20px 0;">Nenhum alerta ativo.</div>' : ''}
    </div>`;
  },

  // ---- Configurações ----
  config() {
    return `
    <div class="grid-2">
      <div class="card">
        <div class="card-hdr"><div class="card-title">Envio de relatórios</div></div>
        <div class="config-row">
          <div><div class="config-label">Envio automático mensal</div><div class="config-sub">1º dia de cada mês</div></div>
          <button class="toggle" onclick="this.classList.toggle('off')" aria-label="Toggle envio automático"></button>
        </div>
        <div class="config-row">
          <div><div class="config-label">E-mail (SMTP)</div><div class="config-sub">SMTP configurado</div></div>
          <button class="toggle" onclick="this.classList.toggle('off')" aria-label="Toggle email"></button>
        </div>
        <div class="config-row">
          <div><div class="config-label">WhatsApp Business API</div><div class="config-sub">Meta WABA conectado</div></div>
          <button class="toggle" onclick="this.classList.toggle('off')" aria-label="Toggle WhatsApp"></button>
        </div>
        <div class="config-row">
          <div><div class="config-label">PDF automático</div><div class="config-sub">Gerado para todos os clientes</div></div>
          <button class="toggle" onclick="this.classList.toggle('off')" aria-label="Toggle PDF"></button>
        </div>
        <div class="form-group mt-8">
          <label>E-mail remetente</label>
          <input type="email" value="relatorios@suaempresa.com.br" />
        </div>
        <div class="form-group">
          <label>Nome do remetente</label>
          <input type="text" value="SolarCRM — Sua Empresa" />
        </div>
      </div>

      <div class="card">
        <div class="card-hdr"><div class="card-title">Integrações de inversores</div></div>
        <div class="config-row">
          <div><div class="config-label">GDASH API</div><div class="config-sub">public-api.gdash.io · Ativo</div></div>
          <button class="toggle" aria-label="Toggle GDASH"></button>
        </div>
        <div class="config-row">
          <div><div class="config-label">Growatt API</div><div class="config-sub">server.growatt.com · Ativo</div></div>
          <button class="toggle" onclick="this.classList.toggle('off')" aria-label="Toggle Growatt"></button>
        </div>
        <div class="config-row">
          <div><div class="config-label">Fronius Solar API</div><div class="config-sub">api.solarweb.com · Ativo</div></div>
          <button class="toggle" onclick="this.classList.toggle('off')" aria-label="Toggle Fronius"></button>
        </div>
        <div class="config-row">
          <div><div class="config-label">Huawei FusionSolar</div><div class="config-sub">Não configurado</div></div>
          <button class="toggle off" onclick="this.classList.toggle('off')" aria-label="Toggle Huawei"></button>
        </div>
        <button class="btn btn-teal mt-8" onclick="App.toast('Abrindo guia de integração Huawei...')">
          <i class="ti ti-plug"></i> Configurar Huawei
        </button>
      </div>
    </div>

    <div class="card">
      <div class="card-hdr"><div class="card-title">Alertas automáticos</div></div>
      <div class="config-row">
        <div><div class="config-label">Inversor offline por mais de 2h</div><div class="config-sub">Notifica gestor e cliente por e-mail</div></div>
        <button class="toggle" onclick="this.classList.toggle('off')" aria-label="Toggle alerta inversor"></button>
      </div>
      <div class="config-row">
        <div><div class="config-label">Geração abaixo de 70% da meta</div><div class="config-sub">Notifica gestor</div></div>
        <button class="toggle" onclick="this.classList.toggle('off')" aria-label="Toggle alerta geração"></button>
      </div>
      <div class="config-row">
        <div><div class="config-label">Queda de eficiência &gt;5% em 30 dias</div><div class="config-sub">Sugere manutenção preventiva</div></div>
        <button class="toggle" onclick="this.classList.toggle('off')" aria-label="Toggle alerta eficiência"></button>
      </div>
      <div style="text-align:right;margin-top:12px;">
        <button class="btn btn-teal" onclick="App.salvarConfig()">
          <i class="ti ti-device-floppy"></i> Salvar configurações
        </button>
      </div>
    </div>`;
  },
};
