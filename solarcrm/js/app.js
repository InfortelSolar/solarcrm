import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
const supabase = createClient(
  'https://ovqwavrbxdplehvgplcv.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im92cXdhdnJieGRwbGVodmdwbGN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNDUzMTMsImV4cCI6MjA5MzgyMTMxM30.XWr7CRvjxAFzghgPbYHPyH4HzQRX-LkoRtF_qCvj6zMC'  // ← substitua pela sua chave anon
)
const { data: { session } } = await supabase.auth.getSession()
if (!session) window.location.href = '/login.html'

supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT') window.location.href = '/login.html'
})

// ============================================================
//  SolarCRM — Controlador principal da aplicação
// ============================================================

const App = {
  currentPage: 'dashboard',
  toastTimer: null,

  // ---- Inicialização ----
  init() {
    this.bindNav();
    this.bindModal();
    this.bindTopbar();
    this.bindMenu();
    this.render('dashboard');
  },

  // ---- Navegação ----
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

  // ---- Menu mobile ----
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

  // ---- Modal Novo Cliente ----
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
      this.toast('Relatórios enviados com sucesso para todos os canais!');
    });
  },

  bindTopbar() {
    document.getElementById('btn-enviar-relatorios').addEventListener('click', () => {
      this.enviarTodosRelatorios();
    });
  },

  // ---- Clientes ----
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
      this.toast('Preencha os campos obrigatórios: nome, e-mail e potência.', 'warn');
      return;
    }

    DB.addCliente(dados);
    document.getElementById('modal-cliente').classList.remove('open');
    document.getElementById('form-cliente').reset();
    this.toast(`Cliente ${dados.nome} adicionado com sucesso!`);

    if (this.currentPage === 'clientes') this.render('clientes');
    if (this.currentPage === 'dashboard') this.render('dashboard');
    this.updateAlertBadge();
  },

  // ---- Relatórios ----
  sendRelatorio(clienteId) {
    const c = DB.getCliente(clienteId);
    if (!c) return;
    const economia = DB.computeEconomia(c);
    const percMeta = Math.round((c.geracaoMes / c.metaMes) * 100);
    document.getElementById('preview-relatorio').innerHTML = `
      <div style="background:var(--color-background-secondary);border-radius:var(--border-radius-md);padding:14px;font-size:12px;line-height:1.8;">
        <div style="font-size:14px;font-weight:600;margin-bottom:8px;">Relatório Solar — Maio 2026</div>
        <div style="font-size:11px;color:var(--color-text-secondary);margin-bottom:12px;">Para: ${c.nome} &lt;${c.email}&gt; ${c.whats ? '· WhatsApp: ' + c.whats : ''}</div>
        <strong>Geração do mês:</strong> ${c.geracaoMes.toLocaleString('pt-BR')} kWh (${percMeta}% da meta)<br>
        <strong>Economia gerada:</strong> ${economia}<br>
        <strong>Status do sistema:</strong> ${c.statusLabel}<br>
        <strong>Inversor:</strong> ${c.inversor}<br><br>
        <div style="color:var(--color-text-secondary);">Canais de envio: E-mail · ${c.whats ? 'WhatsApp · ' : ''}PDF</div>
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
      ? { nome: 'Relatório de exemplo — Maio 2026', clientes: 1 }
      : DB.relatorios.find(r => r.id === relId);
    if (!r) return;
    const exemplo = DB.clientes[0];
    const economia = DB.computeEconomia(exemplo);
    document.getElementById('preview-relatorio').innerHTML = `
      <div style="font-size:13px;font-weight:600;margin-bottom:10px;">${r.nome}</div>
      <div style="background:var(--color-background-secondary);border-radius:var(--border-radius-md);padding:14px;font-size:12px;line-height:1.8;">
        <strong>Assunto:</strong> Seu relatório solar de maio 2026 — ${exemplo.nome}<br><br>
        Olá, <strong>${exemplo.nome}</strong>!<br>
        Em maio, sua usina solar gerou <strong>${exemplo.geracaoMes.toLocaleString('pt-BR')} kWh</strong>,
        representando uma economia de <strong>${economia}</strong>.<br><br>
        <strong>Desempenho:</strong> ${Math.round((exemplo.geracaoMes/exemplo.metaMes)*100)}% da meta mensal<br>
        <strong>Inversor:</strong> ${exemplo.inversor} · <strong>Status:</strong> ${exemplo.statusLabel}<br><br>
        <span style="color:#1D9E75;font-weight:600;">Ver relatório completo em PDF →</span>
      </div>`;
    document.getElementById('modal-relatorio').classList.add('open');
  },

  enviarTodosRelatorios() {
    document.getElementById('preview-relatorio').innerHTML = `
      <div style="padding:16px 0;">
        <div style="font-size:14px;font-weight:600;margin-bottom:12px;">Confirmar envio em massa</div>
        <div style="background:var(--color-background-secondary);border-radius:var(--border-radius-md);padding:14px;font-size:12px;line-height:1.9;">
          <strong>Total de clientes:</strong> ${DB.clientes.length}<br>
          <strong>Canais ativos:</strong> E-mail · WhatsApp · PDF<br>
          <strong>Período:</strong> Maio 2026<br>
          <strong>Agendado para:</strong> Envio imediato<br>
        </div>
      </div>`;
    document.getElementById('btn-enviar-preview').onclick = () => {
      document.getElementById('modal-relatorio').classList.remove('open');
      this.toast(`${DB.clientes.length} relatórios enviados com sucesso!`);
    };
    document.getElementById('modal-relatorio').classList.add('open');
  },

  customizarTemplate() {
    this.toast('Editor de template: adicione seu logo e cores no arquivo css/style.css');
  },

  // ---- Alertas ----
  diagnosticarAlerta(id) {
    const a = DB.alertas.find(a => a.id === id);
    if (!a) return;
    this.toast(`Diagnóstico: ${a.titulo.split(' — ')[0]}`);
    alert(`Diagnóstico — ${a.titulo}\n\n${a.detalhe}\n\nRecomendação: Verifique o inversor no local, confira a conexão de rede e o disjuntor. Contate o cliente se necessário.`);
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
    this.toast(`Alerta resolvido: ${a.titulo.split(':')[0]}`);
  },

  updateAlertBadge() {
    const badge = document.getElementById('badge-alertas');
    if (badge) {
      badge.textContent = DB.alertas.length;
      badge.style.display = DB.alertas.length > 0 ? '' : 'none';
    }
  },

  // ---- Inversores ----
  addInversor() {
    const fab = document.getElementById('inv-fab')?.value;
    const serial = document.getElementById('inv-serial')?.value?.trim();
    const clienteId = document.getElementById('inv-cliente')?.value;
    if (!serial) { this.toast('Informe o número de série do inversor.', 'warn'); return; }
    const cliente = DB.getCliente(clienteId);
    DB.inversores.push({
      id: 'inv' + Date.now(), sigla: fab.slice(0, 3).toUpperCase(),
      bgCol: '#E1F5EE', txtCol: '#0F6E56',
      modelo: fab + ' (novo)', status: 'ok', statusLabel: 'Online',
      cliente: cliente?.nome || 'Desconhecido', serial,
      api: fab + ' API', geracaoHoje: 0, temp: null, potencia: 0,
    });
    this.toast(`Inversor ${fab} adicionado com sucesso!`);
    this.render('inversores');
  },

  // ---- Configurações ----
  salvarConfig() {
    this.toast('Configurações salvas com sucesso!');
  },

  // ---- Logout ----
  async logout() {
    await supabase.auth.signOut()
  },

  // ---- Toast ----
  toast(msg, type = 'ok') {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.style.background = type === 'warn' ? '#854F0B' : 'var(--text-primary)';
    el.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
  },
};

// ---- Boot ----
document.addEventListener('DOMContentLoaded', () => App.init());
