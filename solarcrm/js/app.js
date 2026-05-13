import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
const supabase = createClient('https://ovqwavrbxdplehvgplcv.supabase.co','SUA_CHAVE_ANON_PUBLIC')
supabase.auth.getSession().then(({data:{session}})=>{ if(!session) window.location.href='/login.html' })
// ============================================================
//  SolarCRM — Controlador principal da aplicação
// ============================================================

const App = {
  currentPage: 'dashboard',
  toastTimer: null,

  init() {
    this.bindNav();
    this.bindModal();
    this.bindTopbar();
    this.bindMenu();
    this.render('dashboard');
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
      dashboard: () => Pages.dashboard(),
      clientes: () => Pages.clientes(),
      inversores: () => Pages.inversores(),
      relatorios: () => Pages.relatorios(),
      alertas: () => Pages.alertas(),
      config: () => Pages.config(),
    };
    content.innerHTML = builders[pageId] ? builders[pageId]() : '<p>Página não encontrada.</p>';
    requestAnimationFrame(() => {
      if (pageId === 'dashboard') Charts.renderDashboard();
      if (pageId === 'inversores') Charts.renderInversores();
    });
  },

  bindMenu() {
    document.getElementById('menu-toggle').addEventListener('click', () => {
      document.getElementById('sidebar').classList.toggle('open');
    });
    document.addEventListener('click', e => {
      const sidebar = document.getElementById('sidebar');
      const toggle = document.getElementById('menu-toggle');
      if (sidebar.classList.contains('open') && !sidebar.contains(e.target) && e.target !== toggle) {
        sidebar.classList.remove('open');
      }
    });
  },

  bindModal() {
    const overlay = document.getElementById('modal-cliente');
    document.getElementById('btn-novo-cliente').addEventListener('click', () => {
      overlay.classList.add('open');
    });
    document.getElementById('modal-close').addEventListener('click', () => {
      overlay.classList.remove('open');
    });
    document.getElementById('btn-cancel-modal').addEventListener('click', () => {
      overlay.classList.remove('open');
    });
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.classList.remove('open');
    });
    document.getElementById('form-cliente').addEventListener('submit', e => {
      e.preventDefault();
      this.salvarCliente();
    });
    const relOverlay = document.getElementById('modal-relatorio');
    document.getElementById('modal-rel-close').addEventListener('click', () => relOverlay.classList.remove('open'));
    document.getElementById('btn-cancel-rel').addEventListener('click', () => relOverlay.classList.remove('open'));
    document.getElementById('btn-enviar-preview').addEventListener('click', () => {
      relOverlay.classList.remove('open');
      this.toast('Relatórios enviados com sucesso!');
    });
  },

  bindTopbar() {
    document.getElementById('btn-enviar-relatorios').addEventListener('click', () => {
      this.enviarTodosRelatorios();
    });
  },

  salvarCliente() {
    const dados = {
      nome: document.getElementById('f-nome').value.trim(),
      tipo: document.getElementById('f-tipo').value,
      potencia: parseFloat(document.getElementById('f-potencia').value),
      paineis: parseInt(document.getElementById('f-paineis').value),
      email: document.getElementById('f-email').value.trim(),
      whats: document.getElementById('f-whats').value.trim(),
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

  sendRelatorio(clienteId) {
    const c = DB.getCliente(clienteId);
    if (!c) return;
    const economia = DB.computeEconomia(c);
    const percMeta = Math.round((c.geracaoMes / c.metaMes) * 100);
    document.getElementById('preview-relatorio').innerHTML = `
      <div style="background:var(--color-background-secondary);border-radius:var(--border-radius-md);padding:14px;font-size:12px;line-height:1.8;">
        <div style="font-size:14px;font-weight:600;margin-bottom:8px;">Relatório Solar — Maio 2026</div>
        <div style="font-size:11px;color:var(--color-text-secondary);margin-bottom:12px;">Para: ${c.nome} &lt;${c.email}&gt;</div>
        <strong>Geração:</strong> ${c.geracaoMes.toLocaleString('pt-BR')} kWh (${percMeta}% da meta)<br>
        <strong>Economia:</strong> ${economia}<br>
        <strong>Status:</strong> ${c.statusLabel}<br>
        <strong>Inversor:</strong> ${c.inversor}
      </div>`;
    document.getElementById('btn-enviar-preview').onclick = () => {
      document.getElementById('modal-relatorio').classList.remove('open');
      c.relatoriosEnviados.unshift({ mes: 'Maio 2026', data: new Date().toLocaleDateString('pt-BR'), canais: 'E-mail · WhatsApp · PDF' });
      this.toast(`Relatório enviado para ${c.nome}!`);
    };
    document.getElementById('modal-relatorio').classList.add('open');
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

  customizarTemplate() {
    this.toast('Personalize em css/style.css');
  },

  diagnosticarAlerta(id) {
    const a = DB.alertas.find(a => a.id === id);
    if (!a) return;
    alert(`Diagnóstico — ${a.titulo}\n\n${a.detalhe}`);
  },

  resolverAlerta(id) {
    const idx = DB.alertas.findIndex(a => a.id === id);
    if (idx === -1) return;
    const a = DB.alertas[idx];
    DB.alertas.splice(idx, 1);
    DB.dashKpis.alertasAtivos = DB.alertas.length;
    const el = document.getElementById('alerta-' + id);
    if (el) el.style.display = 'none';
    this.updateAlertBadge();
    this.toast(`Alerta resolvido!`);
  },

  updateAlertBadge() {
    const badge = document.getElementById('badge-alertas');
    if (badge) {
      badge.textContent = DB.alertas.length;
      badge.style.display = DB.alertas.length > 0 ? '' : 'none';
    }
  },

  addInversor() {
    const fab = document.getElementById('inv-fab')?.value;
    const serial = document.getElementById('inv-serial')?.value?.trim();
    const clienteId = document.getElementById('inv-cliente')?.value;
    if (!serial) { this.toast('Informe o número de série.', 'warn'); return; }
    const cliente = DB.getCliente(clienteId);
    DB.inversores.push({
      id: 'inv' + Date.now(), sigla: fab.slice(0, 3).toUpperCase(),
      bgCol: '#E1F5EE', txtCol: '#0F6E56',
      modelo: fab + ' (novo)', status: 'ok', statusLabel: 'Online',
      cliente: cliente?.nome || 'Desconhecido', serial,
      api: fab + ' API', geracaoHoje: 0, temp: null, potencia: 0,
    });
    this.toast(`Inversor ${fab} adicionado!`);
    this.render('inversores');
  },

  salvarConfig() {
    this.toast('Configurações salvas!');
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
