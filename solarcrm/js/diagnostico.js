// ============================================================
//  SolarCRM — Diagnóstico inteligente de alertas v3
//  OFFLINE = perda de comunicação/internet (inversor gerando)
//  ALARME  = falha real no inversor (não está gerando)
// ============================================================

const Diagnostico = (() => {

  function analisar(cliente) {
    const agora = Date.now();
    const ultimaComm = cliente.updated_at
      ? (typeof cliente.updated_at === 'number' ? cliente.updated_at : new Date(cliente.updated_at).getTime())
      : null;

    const horasSemComm = ultimaComm ? Math.round((agora - ultimaComm) / 1000 / 60 / 60) : null;
    const diasSemComm  = horasSemComm ? Math.floor(horasSemComm / 24) : null;
    const eDay         = parseFloat(cliente.geracaoHoje) || 0;
    const eMes         = parseFloat(cliente.geracaoMes)  || 0;
    const tipoReal     = cliente.tipoAlerta || 'offline';

    let causa, descricao, severidade, acoes;

    if (tipoReal === 'alarme') {
      // ── ALARME: falha real no inversor ──────────────────────
      causa      = 'Falha no inversor';
      descricao  = 'O inversor está reportando uma falha interna e não está gerando energia. Verifique o display do inversor para identificar o código de erro específico.';
      severidade = 'err';
      acoes = [
        'Verificar display do inversor — anotar código de erro',
        'Checar tensão e frequência da rede elétrica',
        'Verificar temperatura do inversor (superaquecimento)',
        'Inspecionar strings de painéis (sombreamento, falha)',
        'Consultar manual do fabricante para o código de erro',
      ];

    } else {
      // ── OFFLINE: perda de comunicação/internet ──────────────
      // O inversor provavelmente está gerando, mas sem sinal

      let tempoStr = '—';
      if (horasSemComm !== null) {
        if (horasSemComm < 1)       tempoStr = 'menos de 1 hora';
        else if (horasSemComm < 24) tempoStr = `${horasSemComm} horas`;
        else if (diasSemComm === 1) tempoStr = '1 dia';
        else if (diasSemComm < 30)  tempoStr = `${diasSemComm} dias`;
        else                        tempoStr = `mais de ${Math.floor(diasSemComm/30)} mês(es)`;
      }

      causa      = 'Perda de comunicação com a internet';
      descricao  = `O inversor está offline há ${tempoStr}. Isso geralmente indica falta de conexão com a internet no local — o inversor pode estar gerando normalmente, mas sem conseguir enviar os dados para a plataforma de monitoramento.`;
      severidade = 'warn';
      acoes = [
        'Verificar se o roteador/internet do cliente está funcionando',
        'Reiniciar o datalogger/stick logger do inversor',
        'Verificar cabo de comunicação entre inversor e datalogger',
        'Verificar sinal Wi-Fi no local da instalação',
        'Contatar o cliente para confirmar se o inversor está ligado',
      ];
    }

    // Tempo formatado para exibição
    let tempoExibicao = '—';
    if (horasSemComm !== null) {
      if (horasSemComm < 1)       tempoExibicao = 'Menos de 1h';
      else if (horasSemComm < 24) tempoExibicao = `${horasSemComm}h atrás`;
      else if (diasSemComm === 1) tempoExibicao = '1 dia atrás';
      else if (diasSemComm < 30)  tempoExibicao = `${diasSemComm} dias atrás`;
      else                        tempoExibicao = `+${Math.floor(diasSemComm/30)} mês(es) atrás`;
    }

    return { causa, descricao, severidade, acoes, tempoExibicao, horasSemComm, diasSemComm, eDay, eMes, tipoReal };
  }

  // Busca alarmes reais da API conforme o fabricante
  async function buscarAlarmes(cliente) {
    if (!cliente) return [];
    const fab = (cliente.inversor || '').toLowerCase();
    try {
      if (fab.includes('solis') || fab === '—') {
        const res = await fetch(`/api/solis?alarms=1&stationId=${cliente.id}`);
        const json = await res.json();
        return json.alarms || [];
      }
      if (fab.includes('fronius')) {
        const res = await fetch(`/api/fronius?alarms=1&pvSystemId=${cliente.id}`);
        const json = await res.json();
        return json.alarms || [];
      }
      if (fab.includes('solplanet')) {
        const res = await fetch(`/api/solplanet?action=alarms&plantId=${cliente.id}`);
        const json = await res.json();
        return json.alarms || [];
      }
    } catch(_) {}
    return [];
  }

  function renderModal(alerta, cliente) {
    const diag = cliente ? analisar(cliente) : null;

    const old = document.getElementById('modal-diagnostico');
    if (old) old.remove();

    const tipoReal  = alerta.tipoAlerta || alerta.tipo;
    const isAlarme  = tipoReal === 'alarme';
    const headerColor = isAlarme ? '#E24B4A' : '#6B7280';
    const headerBg    = isAlarme ? '#FCEBEB' : '#F3F4F6';
    const headerTxt   = isAlarme ? '#A32D2D' : '#374151';
    const headerIcon  = isAlarme ? '🔴' : '⚫';
    const headerLabel = isAlarme ? 'ALARME ATIVO' : 'OFFLINE';
    const sevColor    = diag?.severidade === 'err' ? '#E24B4A' : '#EF9F27';

    const modal = document.createElement('div');
    modal.id = 'modal-diagnostico';
    modal.className = 'modal-overlay open';
    modal.innerHTML = `
      <div class="modal" style="max-width:560px;">
        <div class="modal-header" style="border-bottom:3px solid ${headerColor};">
          <h2 style="display:flex;align-items:center;gap:10px;font-size:16px;">
            <span style="background:${headerBg};color:${headerTxt};padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;letter-spacing:0.5px;">
              ${headerIcon} ${headerLabel}
            </span>
            Diagnóstico do Alerta
          </h2>
          <button class="btn-icon" onclick="document.getElementById('modal-diagnostico').remove()">
            <i class="ti ti-x"></i>
          </button>
        </div>

        <!-- Identificação -->
        <div style="padding:14px 20px;background:var(--bg-secondary);border-bottom:1px solid var(--border);">
          <div style="font-size:15px;font-weight:600;margin-bottom:2px;">${alerta.titulo.split(':')[0]}</div>
          <div style="font-size:12px;color:var(--text-secondary);">${cliente ? `${cliente.inversor} · ${cliente.potencia} kWp` : alerta.detalhe}</div>
        </div>

        <div style="padding:16px 20px;display:flex;flex-direction:column;gap:14px;">

          ${diag ? `
          <!-- Causa -->
          <div style="background:${sevColor}18;border:1px solid ${sevColor}44;border-radius:10px;padding:14px;">
            <div style="font-size:13px;font-weight:700;color:${sevColor};margin-bottom:6px;">
              ${isAlarme ? '⚠️' : '📡'} ${diag.causa}
            </div>
            <div style="font-size:12px;color:var(--text-secondary);line-height:1.6;">${diag.descricao}</div>
          </div>

          <!-- Métricas -->
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;">
            <div style="background:var(--bg-secondary);padding:10px;border-radius:8px;text-align:center;">
              <div style="font-size:10px;color:var(--text-secondary);margin-bottom:3px;">SEM SINAL</div>
              <div style="font-size:12px;font-weight:700;color:${diag.horasSemComm > 24 ? '#E24B4A' : '#EF9F27'};">${diag.tempoExibicao}</div>
            </div>
            <div style="background:var(--bg-secondary);padding:10px;border-radius:8px;text-align:center;">
              <div style="font-size:10px;color:var(--text-secondary);margin-bottom:3px;">GERAÇÃO HOJE</div>
              <div style="font-size:12px;font-weight:700;color:#6B7280;">${diag.eDay > 0 ? diag.eDay + ' kWh' : '—'}</div>
            </div>
            <div style="background:var(--bg-secondary);padding:10px;border-radius:8px;text-align:center;">
              <div style="font-size:10px;color:var(--text-secondary);margin-bottom:3px;">GERAÇÃO MÊS</div>
              <div style="font-size:12px;font-weight:700;">${diag.eMes > 0 ? diag.eMes + ' kWh' : '—'}</div>
            </div>
            <div style="background:var(--bg-secondary);padding:10px;border-radius:8px;text-align:center;">
              <div style="font-size:10px;color:var(--text-secondary);margin-bottom:3px;">POTÊNCIA</div>
              <div style="font-size:12px;font-weight:700;">${cliente?.potencia || '—'} kWp</div>
            </div>
          </div>

          <!-- Ações -->
          <div>
            <div style="font-size:11px;color:var(--text-secondary);font-weight:600;text-transform:uppercase;margin-bottom:8px;">Ações recomendadas</div>
            <div style="display:flex;flex-direction:column;gap:6px;">
              ${diag.acoes.map((acao) => `
                <label style="display:flex;align-items:center;gap:10px;font-size:13px;cursor:pointer;padding:8px 10px;background:var(--bg-secondary);border-radius:7px;">
                  <input type="checkbox" style="width:15px;height:15px;flex-shrink:0;">
                  <span>${acao}</span>
                </label>`).join('')}
            </div>
          </div>` : ''}

          ${cliente ? `
          <!-- Alarmes reais (preenchido via API) -->
          ${isAlarme ? `<div id="diag-alarmes-reais" style="min-height:20px;"></div>` : ''}

          <!-- Contato -->
          <div style="padding:12px;border:1px solid var(--border);border-radius:8px;">
            <div style="font-size:11px;color:var(--text-secondary);margin-bottom:8px;font-weight:600;text-transform:uppercase;">Contato do cliente</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:13px;">
              <div><span style="color:var(--text-secondary);">E-mail:</span> ${cliente.email || '—'}</div>
              <div><span style="color:var(--text-secondary);">WhatsApp:</span> ${cliente.whats || '—'}</div>
              <div><span style="color:var(--text-secondary);">Fabricante:</span> ${cliente.inversor}</div>
              <div><span style="color:var(--text-secondary);">Instalação:</span> ${cliente.dataInstalacao || '—'}</div>
            </div>
          </div>` : ''}

          <!-- Botões -->
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            ${cliente?.whats ? `
            <a href="https://wa.me/55${cliente.whats.replace(/\D/g,'')}" target="_blank"
               class="btn btn-sm" style="background:#25D366;color:white;border-color:#25D366;">
              <i class="ti ti-brand-whatsapp"></i> WhatsApp
            </a>` : ''}
            ${cliente?.email ? `
            <a href="mailto:${cliente.email}?subject=Alerta: ${encodeURIComponent(alerta.titulo.split(':')[0])}&body=Identificamos um problema na sua usina solar. Por favor, verifique."
               class="btn btn-sm"><i class="ti ti-mail"></i> E-mail</a>` : ''}
            ${cliente ? `
            <button class="btn btn-sm" onclick="document.getElementById('modal-diagnostico').remove(); App.navTo('clientes'); setTimeout(()=>Pages.openPerfil('${cliente.id}'),100);">
              <i class="ti ti-user"></i> Ver perfil
            </button>` : ''}
            <button class="btn btn-sm" style="color:#E24B4A;border-color:#E24B4A;"
              onclick="App.resolverAlerta('${alerta.id}'); document.getElementById('modal-diagnostico').remove();">
              <i class="ti ti-check"></i> Marcar resolvido
            </button>
          </div>

        </div>
      </div>`;

    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);

    // Se for alarme, busca os códigos reais da API
    if (isAlarme && cliente) {
      buscarAlarmes(cliente).then(alarmes => {
        if (!alarmes.length) return;
        const el = document.getElementById('diag-alarmes-reais');
        if (!el) return;

        const levelMap = {
          '1': { label: 'Aviso',    cor: '#EF9F27' },
          '2': { label: 'Normal',   cor: '#EF9F27' },
          '3': { label: 'Urgente',  cor: '#E24B4A' },
          'Error':   { label: 'Erro',   cor: '#E24B4A' },
          'Warning': { label: 'Aviso',  cor: '#EF9F27' },
        };

        el.innerHTML = `
          <div style="font-size:11px;color:var(--text-secondary);font-weight:600;text-transform:uppercase;margin-bottom:8px;">
            ⚠️ Códigos de alarme do inversor
          </div>
          ${alarmes.map(a => {
            const lv = levelMap[a.level] || { label: a.level, cor: '#EF9F27' };
            return `
              <div style="background:${lv.cor}18;border:1px solid ${lv.cor}44;border-radius:8px;padding:12px;margin-bottom:8px;">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
                  <span style="background:${lv.cor};color:white;font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;">${lv.label}</span>
                  <span style="font-size:12px;font-weight:600;color:var(--text-primary);">${a.code !== '—' ? `Código ${a.code}` : 'Alarme'}</span>
                </div>
                <div style="font-size:13px;font-weight:500;margin-bottom:4px;">${a.message}</div>
                ${a.advice && a.advice !== 'Consulte o manual do fabricante' ? `
                  <div style="font-size:11px;color:var(--text-secondary);margin-top:4px;">
                    💡 ${a.advice}
                  </div>` : ''}
              </div>`;
          }).join('')}`;
      });
    }
  }

  return { analisar, renderModal };
})();
