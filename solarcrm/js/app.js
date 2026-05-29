// ============================================================
//  SolarCRM — Controlador principal da aplicação
// ============================================================

const App = {
  currentPage: 'dashboard',
  toastTimer: null,
  config: {
    envioAutomatico: true,
    email: true,
    whatsapp: true,
    pdf: true,
    alertaOffline: true,
    alertaGeracao: true,
    alertaEficiencia: true,
    emailRemetente: 'relatorios@suaempresa.com.br',
    nomeRemetente: 'Infortel Solar — SolarCRM',
  },

  _refreshTimer: null,
  _lastUpdate: null,

  async init() {
    DB.init()
    this.bindNav()
    this.bindModal()
    this.bindTopbar()
    this.bindMenu()
    await Promise.all([
      Solis.load(),
      SolPlanet.load(),
      Fronius.load(),
      Growatt.load(),
      this.loadConfig(),
    ])
    this.render('dashboard')
    const badge = document.getElementById('badge-alertas')
    if (badge) badge.textContent = DB.alertas.length
    this._lastUpdate = new Date()
    this._startAutoRefresh()
  },

  _startAutoRefresh() {
    if (this._refreshTimer) clearInterval(this._refreshTimer)
    this._refreshTimer = setInterval(async () => {
      await this._silentRefresh()
    }, 5 * 60 * 1000) // 5 minutos
  },

  async _silentRefresh() {
    try {
      await Solis.load()
      await SolPlanet.load()
      await Fronius.load()
      this._lastUpdate = new Date()
      // Atualiza badge
      const badge = document.getElementById('badge-alertas')
      if (badge) badge.textContent = DB.alertas.length
      // Atualiza indicador de horário no dashboard
      this._updateLastUpdateIndicator()
      // Re-renderiza página atual silenciosamente
      if (this.currentPage === 'dashboard') this.render('dashboard')
      if (this.currentPage === 'alertas')   this.render('alertas')
      if (this.currentPage === 'inversores') this.render('inversores')
    } catch(e) {
      console.warn('[AutoRefresh] Falha:', e.message)
    }
  },

  _updateLastUpdateIndicator() {
    const el = document.getElementById('last-update-time')
    if (el && this._lastUpdate) {
      el.textContent = this._lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    }
  },

  // ── Configurações persistentes ──────────────────────────────
  async loadConfig() {
    try {
      const { data } = await DB._supabase
        .from('configuracoes')
        .select('*')
        .eq('id', 'app_config')
        .single()
      if (data?.valor) {
        this.config = { ...this.config, ...data.valor }
      }
    } catch(e) { /* usa config padrão */ }
  },

  async salvarConfig() {
    const toggles = {
      envioAutomatico: !document.querySelector('[aria-label="Toggle envio automático"]')?.classList.contains('off'),
      email:           !document.querySelector('[aria-label="Toggle email"]')?.classList.contains('off'),
      whatsapp:        !document.querySelector('[aria-label="Toggle WhatsApp"]')?.classList.contains('off'),
      pdf:             !document.querySelector('[aria-label="Toggle PDF"]')?.classList.contains('off'),
      alertaOffline:   !document.querySelector('[aria-label="Toggle alerta inversor"]')?.classList.contains('off'),
      alertaGeracao:   !document.querySelector('[aria-label="Toggle alerta geração"]')?.classList.contains('off'),
      alertaEficiencia:!document.querySelector('[aria-label="Toggle alerta eficiência"]')?.classList.contains('off'),
      emailRemetente:  document.querySelector('input[type="email"]')?.value || this.config.emailRemetente,
      nomeRemetente:   document.querySelector('input[placeholder="Infortel Solar — SolarCRM"], .config-row input[type="text"]')?.value || this.config.nomeRemetente,
    }
    this.config = { ...this.config, ...toggles }
    try {
      await DB._supabase.from('configuracoes').upsert({
        id: 'app_config',
        valor: this.config,
        updated_at: new Date().toISOString(),
      })
      this.toast('Configurações salvas!')
    } catch(e) {
      this.toast('Erro ao salvar configurações.', 'warn')
    }
  },

  bindNav() {
    document.querySelectorAll('.nav-item[data-page]').forEach(el => {
      el.addEventListener('click', () => this.navTo(el.dataset.page));
    });
  },

  navTo(pageId) {
    this.currentPage = pageId;
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const navEl = document.querySelector(`.nav-item[data-page="${pageId}"]`);
    if (navEl) navEl.classList.add('active');
    this.render(pageId);
    document.getElementById('sidebar').classList.remove('open');
  },

  render(pageId) {
    const titles = {
      dashboard: 'Dashboard', clientes: 'Clientes', inversores: 'Inversores',
      relatorios: 'Relatórios', alertas: 'Alertas', config: 'Configurações',
    };
    document.getElementById('ptitle').textContent = titles[pageId] || pageId;
    document.getElementById('pbread').textContent = '';
    const content = document.querySelector('.content');
    const builders = {
      dashboard:  () => Pages.dashboard(),
      clientes:   () => Pages.clientes(),
      inversores: () => Pages.inversores(),
      relatorios: () => Pages.relatorios(),
      alertas:    () => Pages.alertas(),
      config:     () => Pages.config(this.config),
    };
    content.innerHTML = builders[pageId] ? builders[pageId]() : '<p>Página não encontrada.</p>';
    requestAnimationFrame(() => {
      if (pageId === 'dashboard') Charts.renderDashboard();
      if (pageId === 'inversores') Charts.renderInversores();
    });
  },

  bindMenu() {
    const toggle  = document.getElementById('menu-toggle');
    const sidebar = document.getElementById('sidebar');

    // Suporte a touch e click para melhor resposta no mobile
    const toggleMenu = (e) => {
      e.preventDefault();
      e.stopPropagation();
      sidebar.classList.toggle('open');
    };

    toggle.addEventListener('click', toggleMenu);
    toggle.addEventListener('touchend', toggleMenu, { passive: false });

    // Fecha ao clicar/tocar fora
    const closeMenu = (e) => {
      if (sidebar.classList.contains('open') && !sidebar.contains(e.target) && e.target !== toggle && !toggle.contains(e.target)) {
        sidebar.classList.remove('open');
      }
    };

    document.addEventListener('click', closeMenu);
    document.addEventListener('touchend', closeMenu, { passive: true });
  },

  bindModal() {
    const overlay = document.getElementById('modal-cliente');
    document.getElementById('btn-novo-cliente').addEventListener('click', () => {
      document.getElementById('modal-title').textContent = 'Novo cliente';
      document.getElementById('form-cliente').reset();
      document.getElementById('form-cliente').onsubmit = (e) => { e.preventDefault(); this.salvarCliente(); };
      overlay.classList.add('open');
    });
    document.getElementById('modal-close').addEventListener('click', () => overlay.classList.remove('open'));
    document.getElementById('btn-cancel-modal').addEventListener('click', () => overlay.classList.remove('open'));
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.remove('open'); });
    const relOverlay = document.getElementById('modal-relatorio');
    document.getElementById('modal-rel-close').addEventListener('click', () => relOverlay.classList.remove('open'));
    document.getElementById('btn-cancel-rel').addEventListener('click', () => relOverlay.classList.remove('open'));
    document.getElementById('btn-enviar-preview').addEventListener('click', () => {
      relOverlay.classList.remove('open');
      this.toast('Relatórios enviados com sucesso!');
    });
  },

  bindTopbar() {
    document.getElementById('btn-enviar-relatorios').addEventListener('click', () => this.enviarTodosRelatorios());
  },

  salvarCliente() {
    const dados = {
      nome:     document.getElementById('f-nome').value.trim(),
      tipo:     document.getElementById('f-tipo').value,
      potencia: parseFloat(document.getElementById('f-potencia').value),
      paineis:  parseInt(document.getElementById('f-paineis').value),
      email:    document.getElementById('f-email').value.trim(),
      whats:    document.getElementById('f-whats').value.trim(),
      endereco: document.getElementById('f-endereco').value.trim(),
      inversor: document.getElementById('f-inversor').value,
    };
    if (!dados.nome || !dados.email || isNaN(dados.potencia)) {
      this.toast('Preencha os campos obrigatórios.', 'warn');
      return;
    }
    DB.addCliente(dados);
    document.getElementById('modal-cliente').classList.remove('open');
    document.getElementById('form-cliente').reset();
    this.toast(`Cliente ${dados.nome} adicionado!`);
    if (this.currentPage === 'clientes') this.render('clientes');
    if (this.currentPage === 'dashboard') this.render('dashboard');
    this.updateAlertBadge();
  },

  async editarClienteGdash(id) {
    const c = DB.getCliente(id)
    if (!c) return
    const extra = await DB.getClienteExtra(id)
    document.getElementById('f-nome').value     = c.nome
    document.getElementById('f-tipo').value     = c.tipo
    document.getElementById('f-potencia').value = c.potencia
    document.getElementById('f-paineis').value  = c.paineis
    document.getElementById('f-email').value    = extra?.email    || c.email    || ''
    document.getElementById('f-whats').value    = extra?.whatsapp || c.whats    || ''
    document.getElementById('f-endereco').value = extra?.endereco || c.endereco || ''
    document.getElementById('f-inversor').value = c.inversor
    document.getElementById('modal-title').textContent = `Editar — ${c.nome}`
    document.getElementById('modal-cliente').classList.add('open')
    document.getElementById('form-cliente').onsubmit = async (e) => {
      e.preventDefault()
      try {
        await DB.saveClienteExtra(id, {
          whatsapp: document.getElementById('f-whats').value.trim(),
          email:    document.getElementById('f-email').value.trim(),
          tarifa:   0.82,
          endereco: document.getElementById('f-endereco').value.trim(),
        })
        document.getElementById('modal-cliente').classList.remove('open')
        Pages.openPerfil(id)
        this.toast(`Cliente ${c.nome} atualizado!`)
      } catch(err) {
        this.toast('Erro ao salvar. Tente novamente.', 'warn')
      }
    }
  },

  editarCliente(id) {
    const c = DB.getCliente(id)
    if (!c) return
    document.getElementById('f-nome').value     = c.nome
    document.getElementById('f-tipo').value     = c.tipo
    document.getElementById('f-potencia').value = c.potencia
    document.getElementById('f-paineis').value  = c.paineis
    document.getElementById('f-email').value    = c.email
    document.getElementById('f-whats').value    = c.whats
    document.getElementById('f-endereco').value = c.endereco
    document.getElementById('f-inversor').value = c.inversor
    document.getElementById('modal-title').textContent = `Editar — ${c.nome}`
    document.getElementById('modal-cliente').classList.add('open')
    document.getElementById('form-cliente').onsubmit = async (e) => {
      e.preventDefault()
      const dados = {
        nome:     document.getElementById('f-nome').value.trim(),
        tipo:     document.getElementById('f-tipo').value,
        potencia: parseFloat(document.getElementById('f-potencia').value),
        paineis:  parseInt(document.getElementById('f-paineis').value),
        email:    document.getElementById('f-email').value.trim(),
        whats:    document.getElementById('f-whats').value.trim(),
        endereco: document.getElementById('f-endereco').value.trim(),
        inversor: document.getElementById('f-inversor').value,
      }
      DB._supabase.from('clientes').update({
        nome: dados.nome, tipo: dados.tipo, email: dados.email,
        whatsapp: dados.whats, endereco: dados.endereco,
        potencia: dados.potencia, paineis: dados.paineis, inversor: dados.inversor,
      }).eq('id', id).then(() => {
        document.getElementById('modal-cliente').classList.remove('open')
        DB.load().then(() => { this.render('clientes'); this.toast(`Cliente ${dados.nome} atualizado!`) })
      })
    }
  },

  excluirCliente(id, nome) {
    if (!confirm(`Tem certeza que deseja excluir o cliente ${nome}?`)) return
    DB._supabase.from('clientes').delete().eq('id', id).then(() => {
      DB.load().then(() => {
        Pages.closePerfil()
        this.render('clientes')
        this.toast(`Cliente ${nome} excluído!`)
      })
    })
  },

  sendRelatorio(clienteId) {
    const c = DB.getCliente(clienteId)
    if (!c) return
    const economia = DB.computeEconomia(c)
    const percMeta = Math.round((c.geracaoMes / c.metaMes) * 100) || 0
    document.getElementById('preview-relatorio').innerHTML = `
      <div style="background:var(--bg-secondary);border-radius:8px;padding:14px;font-size:12px;line-height:1.8;">
        <div style="font-size:14px;font-weight:600;margin-bottom:8px;">Relatório Solar — Maio 2026</div>
        <div style="margin-bottom:8px;color:#666;">Para: ${c.nome} &lt;${c.email}&gt; ${c.whats ? '· WhatsApp: ' + c.whats : ''}</div>
        <strong>Geração:</strong> ${c.geracaoMes} kWh (${percMeta}% da meta)<br>
        <strong>Economia:</strong> ${economia}<br>
        <strong>Status:</strong> ${c.statusLabel}<br>
        <strong>Inversor:</strong> ${c.inversor}
      </div>`
    document.getElementById('btn-enviar-preview').onclick = () => {
      document.getElementById('modal-relatorio').classList.remove('open')
      this.toast('Enviando relatório...')
      fetch('https://ovqwavrbxdplehvgplcv.supabase.co/functions/v1/send-relatorio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im92cXdhdnJieGRwbGVodmdwbGN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNDUzMTMsImV4cCI6MjA5MzgyMTMxM30.XWr7CRvjxAFzghgPbYHPyH4HzQRX-LkoRtF_qCvj6zM',
        },
        body: JSON.stringify({
          mes: 'Maio 2026',
          cliente: {
            nome: c.nome, email: c.email, whats: c.whats,
            geracaoMes: c.geracaoMes, metaMes: c.metaMes,
            tarifa: c.tarifa, statusLabel: c.statusLabel, inversor: c.inversor,
          }
        })
      })
      .then(r => r.json())
      .then(data => {
        if (data.ok) this.toast('Relatório enviado com sucesso!')
        else this.toast('Erro ao enviar. Tente novamente.', 'warn')
      })
      .catch(() => this.toast('Erro ao enviar. Tente novamente.', 'warn'))
    }
    document.getElementById('modal-relatorio').classList.add('open')
  },

  previewRelatorio(relId) {
    const r = relId === 'preview'
      ? { nome: 'Relatório de exemplo — Maio 2026' }
      : DB.relatorios.find(r => r.id === relId);
    if (!r) return;
    const exemplo = DB.clientes[0];
    const economia = DB.computeEconomia(exemplo);
    document.getElementById('preview-relatorio').innerHTML = `
      <div style="font-size:13px;font-weight:600;margin-bottom:10px;">${r.nome}</div>
      <div style="background:var(--color-background-secondary);border-radius:var(--border-radius-md);padding:14px;font-size:12px;line-height:1.8;">
        Olá, <strong>${exemplo.nome}</strong>!<br>
        Geração: <strong>${exemplo.geracaoMes.toLocaleString('pt-BR')} kWh</strong><br>
        Economia: <strong>${economia}</strong><br>
        Status: ${exemplo.statusLabel}
      </div>`;
    document.getElementById('modal-relatorio').classList.add('open');
  },

  enviarTodosRelatorios() {
    document.getElementById('preview-relatorio').innerHTML = `
      <div style="padding:16px 0;">
        <div style="font-size:14px;font-weight:600;margin-bottom:12px;">Confirmar envio em massa</div>
        <div style="background:var(--color-background-secondary);border-radius:var(--border-radius-md);padding:14px;font-size:12px;line-height:1.9;">
          <strong>Total:</strong> ${DB.clientes.length} clientes<br>
          <strong>Canais:</strong> E-mail · WhatsApp · PDF<br>
          <strong>Período:</strong> Maio 2026
        </div>
      </div>`;
    document.getElementById('btn-enviar-preview').onclick = () => {
      document.getElementById('modal-relatorio').classList.remove('open');
      this.toast(`${DB.clientes.length} relatórios enviados!`);
    };
    document.getElementById('modal-relatorio').classList.add('open');
  },

  customizarTemplate() { EditorRelatorio.abrir(); },

  diagnosticarAlerta(id) {
    Pages.abrirDiagnostico(id);
  },

  resolverAlerta(id) {
    const idx = DB.alertas.findIndex(a => a.id === id);
    if (idx === -1) return;
    DB.alertas.splice(idx, 1);
    DB.dashKpis.alertasAtivos = DB.alertas.length;
    const el = document.getElementById('alerta-' + id);
    if (el) el.style.display = 'none';
    this.updateAlertBadge();
    this.toast('Alerta resolvido!');
  },

  updateAlertBadge() {
    const badge = document.getElementById('badge-alertas');
    if (badge) {
      badge.textContent = DB.alertas.length;
      badge.style.display = DB.alertas.length > 0 ? '' : 'none';
    }
  },

  addInversor() {
    const fab      = document.getElementById('inv-fab')?.value;
    const serial   = document.getElementById('inv-serial')?.value?.trim();
    const clienteId = document.getElementById('inv-cliente')?.value;
    if (!serial) { this.toast('Informe o número de série.', 'warn'); return; }
    const cliente = DB.getCliente(clienteId);
    DB.inversores.push({
      id: 'inv' + Date.now(), sigla: fab.slice(0,3).toUpperCase(),
      bgCol: '#E1F5EE', txtCol: '#0F6E56',
      modelo: fab + ' (novo)', status: 'ok', statusLabel: 'Online',
      cliente: cliente?.nome || 'Desconhecido', serial,
      api: fab + ' API', geracaoHoje: 0, temp: null, potencia: 0,
    });
    this.toast(`Inversor ${fab} adicionado!`);
    this.render('inversores');
  },

  async recarregarDados() {
    this.toast('Atualizando dados...');
    await Promise.all([Solis.load(), SolPlanet.load(), Fronius.load(), Growatt.load()]);
    this.render(this.currentPage);
    const badge = document.getElementById('badge-alertas');
    if (badge) badge.textContent = DB.alertas.length;
    this.toast('Dados atualizados!');
  },

  logout() {
    DB._supabase.auth.signOut().then(() => { window.location.href = 'login.html'; });
  },

  toast(msg, type = 'ok') {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.style.background = type === 'warn' ? '#854F0B' : 'var(--text-primary)';
    el.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
  },
};

document.addEventListener('DOMContentLoaded', () => App.init());
