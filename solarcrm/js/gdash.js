/**
 * gdash.js — Módulo de integração GDASH para SolarCRM
 * Substitui dados fictícios por dados reais da API GDASH
 *
 * Como usar:
 *   1. Importe este arquivo no seu dashboard HTML:
 *      <script src="gdash.js"></script>
 *   2. Chame GDash.init() após o DOM carregar.
 *   3. Veja os comentários de "PONTO DE INTEGRAÇÃO" para conectar
 *      com os elementos existentes do seu dashboard.
 */

const GDash = (() => {
  // ─── Configuração ────────────────────────────────────────────────────────────
  const API_KEY  = '3HnfW02lkFxhrG92G9Ek8';
  const BASE_URL = '';

  // Cache simples para evitar chamadas repetidas (TTL: 5 minutos)
  let _cache = null;
  let _cacheTime = 0;
  const CACHE_TTL = 5 * 60 * 1000;

  // ─── Busca de dados ──────────────────────────────────────────────────────────

  /**
   * Busca todas as plantas da conta.
   * Retorna array com os dados brutos da API.
   */
  async function fetchPlants() {
    const now = Date.now();
    if (_cache && now - _cacheTime < CACHE_TTL) {
      return _cache;
    }

    const res = await fetch('/api/gdash');
    if (!res.ok) throw new Error(`GDASH API error: ${res.status}`);

    const json = await res.json();
    if (!json.ok) throw new Error('GDASH retornou ok=false');

    _cache = json.data;
    _cacheTime = now;
    return _cache;
  }

  // ─── Processamento / métricas ─────────────────────────────────────────────────

  /**
   * Calcula as métricas consolidadas a partir das plantas.
   *
   * Retorna:
   * {
   *   total:       número total de plantas
   *   online:      plantas com status "OK"
   *   offline:     plantas com status "OFFLINE"
   *   alarming:    plantas com status "ALARMING"
   *   noComm:      plantas com status "NO_COMMUNICATION"
   *   totalPower:  soma do campo `power` (kWp instalado)
   *   onlinePower: kWp das plantas online
   *   alerts:      lista de plantas com alert=true ou status≠OK
   *   byManufacturer: { Solis: N, Growatt: N, ... }
   *   plants:      array completo (dados brutos)
   * }
   */
  function calcMetrics(plants) {
    const metrics = {
      total: plants.length,
      online: 0,
      offline: 0,
      alarming: 0,
      noComm: 0,
      totalPower: 0,
      onlinePower: 0,
      alerts: [],
      byManufacturer: {},
      plants,
    };

    for (const p of plants) {
      const status = (p.status || '').toUpperCase();
      const power  = parseFloat(p.power) || 0;

      metrics.totalPower += power;

      if (status === 'OK') {
        metrics.online++;
        metrics.onlinePower += power;
      } else if (status === 'OFFLINE') {
        metrics.offline++;
      } else if (status === 'ALARMING') {
        metrics.alarming++;
      } else if (status === 'NO_COMMUNICATION') {
        metrics.noComm++;
      }

      if (p.alert || status !== 'OK') {
        metrics.alerts.push(p);
      }

      const mfr = p.manufacturer || 'Outros';
      metrics.byManufacturer[mfr] = (metrics.byManufacturer[mfr] || 0) + 1;
    }

    return metrics;
  }

  // ─── Renderização no Dashboard ────────────────────────────────────────────────

  /**
   * Atualiza um elemento HTML pelo seletor com o valor fornecido.
   * Silencioso se o elemento não existir (não quebra o layout).
   */
  function setEl(selector, value) {
    const el = document.querySelector(selector);
    if (el) el.textContent = value;
  }

  /**
   * Renderiza as métricas principais nos cards do dashboard.
   *
   * PONTO DE INTEGRAÇÃO:
   * Ajuste os seletores abaixo para corresponder aos IDs/classes
   * dos seus cards existentes no dashboard.html.
   *
   * Exemplo de HTML esperado:
   *   <div id="gdash-total">...</div>
   *   <div id="gdash-online">...</div>
   *   etc.
   */
  function renderMetricCards(m) {
    // Cards de status
    setEl('#gdash-total',        m.total);
    setEl('#gdash-online',       m.online);
    setEl('#gdash-offline',      m.offline);
    setEl('#gdash-alarming',     m.alarming);
    setEl('#gdash-no-comm',      m.noComm);
    setEl('#gdash-alerts-count', m.alerts.length);

    // Potência
    setEl('#gdash-total-power',  `${m.totalPower.toFixed(2)} kWp`);
    setEl('#gdash-online-power', `${m.onlinePower.toFixed(2)} kWp`);

    // Taxa de disponibilidade
    const uptime = m.total > 0
      ? ((m.online / m.total) * 100).toFixed(1)
      : '0.0';
    setEl('#gdash-uptime', `${uptime}%`);
  }

  /**
   * Renderiza a lista de alertas/plantas com problema.
   *
   * PONTO DE INTEGRAÇÃO:
   * Cria/atualiza um elemento com id="gdash-alerts-list".
   * Adapte o HTML interno ao estilo do seu CRM.
   */
  function renderAlertsList(alerts) {
    const container = document.querySelector('#gdash-alerts-list');
    if (!container) return;

    if (alerts.length === 0) {
      container.innerHTML = '<p class="text-success">✅ Nenhum alerta ativo</p>';
      return;
    }

    const statusLabel = {
      OFFLINE:          '🔴 Offline',
      ALARMING:         '⚠️ Alarme',
      NO_COMMUNICATION: '📡 Sem Comunicação',
    };

    const statusClass = {
      OFFLINE:          'danger',
      ALARMING:         'warning',
      NO_COMMUNICATION: 'secondary',
    };

    container.innerHTML = alerts.map(p => {
      const st  = (p.status || '').toUpperCase();
      const lbl = statusLabel[st] || `❓ ${p.status}`;
      const cls = statusClass[st] || 'info';
      return `
        <div class="alert-item d-flex justify-content-between align-items-center mb-2 p-2 border-start border-${cls} border-3 bg-light rounded">
          <div>
            <strong>${p.name}</strong>
            <small class="d-block text-muted">${p.manufacturer} · ${p.power} kWp</small>
          </div>
          <span class="badge bg-${cls}">${lbl}</span>
        </div>
      `;
    }).join('');
  }

  /**
   * Renderiza a tabela de plantas (substituição da tabela fictícia).
   *
   * PONTO DE INTEGRAÇÃO:
   * Coloque um elemento com id="gdash-plants-tbody" no seu
   * <table> existente de plantas/inversores.
   */
  function renderPlantsTable(plants) {
    const tbody = document.querySelector('#gdash-plants-tbody');
    if (!tbody) return;

    const statusIcon = {
      OK:               '🟢',
      OFFLINE:          '🔴',
      ALARMING:         '⚠️',
      NO_COMMUNICATION: '📡',
    };

    tbody.innerHTML = plants.map(p => {
      const st   = (p.status || '').toUpperCase();
      const icon = statusIcon[st] || '⚪';
      const updated = p.updated_at
        ? new Date(p.updated_at).toLocaleString('pt-BR')
        : '—';

      return `
        <tr>
          <td>${p.name}</td>
          <td>${p.manufacturer || '—'}</td>
          <td>${p.power ?? '—'} kWp</td>
          <td>${icon} ${p.status}</td>
          <td>${updated}</td>
        </tr>
      `;
    }).join('');
  }

  /**
   * Exibe indicador de carregamento e trata erros globalmente.
   */
  function setLoading(isLoading, error = null) {
    const loader = document.querySelector('#gdash-loader');
    const errEl  = document.querySelector('#gdash-error');

    if (loader) loader.style.display = isLoading ? 'block' : 'none';
    if (errEl) {
      if (error) {
        errEl.textContent = `Erro ao carregar GDASH: ${error.message}`;
        errEl.style.display = 'block';
      } else {
        errEl.style.display = 'none';
      }
    }
  }

  // ─── Ponto de entrada principal ───────────────────────────────────────────────

  /**
   * Inicializa o módulo: busca dados, calcula métricas e renderiza tudo.
   *
   * Exemplo de uso:
   *   document.addEventListener('DOMContentLoaded', () => GDash.init());
   *
   * Ou com atualização automática a cada 5 minutos:
   *   GDash.init({ autoRefresh: true, intervalMs: 5 * 60 * 1000 });
   */
  async function init({ autoRefresh = false, intervalMs = 5 * 60 * 1000 } = {}) {
    try {
      setLoading(true);
      const plants  = await fetchPlants();
      const metrics = calcMetrics(plants);

      renderMetricCards(metrics);
      renderAlertsList(metrics.alerts);
      renderPlantsTable(plants);

      // Dispara evento customizado para outros módulos escutarem
      document.dispatchEvent(new CustomEvent('gdash:loaded', { detail: metrics }));

      console.log('[GDash] Dados carregados:', {
        total:    metrics.total,
        online:   metrics.online,
        offline:  metrics.offline,
        alarming: metrics.alarming,
        alerts:   metrics.alerts.length,
      });
    } catch (err) {
      console.error('[GDash] Erro:', err);
      setLoading(false, err);
      return;
    }

    setLoading(false);

    if (autoRefresh) {
      setTimeout(() => init({ autoRefresh, intervalMs }), intervalMs);
    }
  }

  // ─── API Pública ──────────────────────────────────────────────────────────────
  return {
    init,
    fetchPlants,
    calcMetrics,
  };
})();

(function autoInit() {
  document.addEventListener('DOMContentLoaded', () => {
    GDash.fetchPlants().then(plants => {
      const m = GDash.calcMetrics(plants);

// Só atualiza se o Supabase ainda não carregou clientes
if (DB.clientes.length === 0) {
  DB.dashKpis.clientesAtivos = m.online;
}
// Alertas: soma Supabase + GDASH
DB.dashKpis.alertasAtivos = DB.alertas.length + m.offline + m.alarming;

      const badge = document.getElementById('badge-alertas');
      if (badge) badge.textContent = m.alerts.length;

const content = document.querySelector('.content');
if (content) {
  content.innerHTML = Pages.dashboard();
  if (typeof Charts !== 'undefined' && typeof Charts.init === 'function') Charts.init();
else if (typeof Charts !== 'undefined' && typeof Charts.renderDashboard === 'function') Charts.renderDashboard();
}

      console.log('[GDash] Dados reais injetados:', {
        online:   m.online,
        offline:  m.offline,
        alarming: m.alarming,
        alerts:   m.alerts.length,
      });

    }).catch(err => console.error('[GDash] Erro:', err));
  });
})();
