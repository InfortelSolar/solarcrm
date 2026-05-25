// ============================================================
//  SolarCRM — Diagnóstico inteligente de alertas
//  Infere causa provável com base nos dados disponíveis
// ============================================================

const Diagnostico = (() => {

  function analisar(cliente) {
    const agora = Date.now();
    const ultimaComm = cliente.updated_at
      ? (typeof cliente.updated_at === 'number' ? cliente.updated_at : new Date(cliente.updated_at).getTime())
      : null;

    const horasSemComm = ultimaComm ? Math.round((agora - ultimaComm) / 1000 / 60 / 60) : null;
    const diasSemComm  = horasSemComm ? Math.floor(horasSemComm / 24) : null;

    const eDay   = parseFloat(cliente.geracaoHoje) || 0;
    const eMes   = parseFloat(cliente.geracaoMes)  || 0;
    const eTotal = parseFloat(cliente.energyTotal) || 0;
    const power  = parseFloat(cliente.current_power || cliente.potencia) || 0;

    // ── Inferência de causa ──────────────────────────────────
    let causa       = 'Desconhecida';
    let descricao   = 'Não foi possível determinar a causa automaticamente.';
    let severidade  = 'warn'; // ok | warn | err
    let acoes       = [];

    if (eDay === 0 && eMes === 0 && eTotal > 0 && diasSemComm && diasSemComm > 30) {
      causa      = 'Sem geração há mais de 30 dias';
      descricao  = 'O sistema não registra geração ou comunicação há mais de um mês. Possível falha grave no inversor, desligamento da instalação ou problema na rede elétrica.';
      severidade = 'err';
      acoes      = ['Visita técnica urgente', 'Verificar se instalação ainda está ativa', 'Checar disjuntores e fusíveis'];

    } else if (eDay === 0 && power === 0 && diasSemComm && diasSemComm > 7) {
      causa      = 'Inversor desligado ou sem energia';
      descricao  = `Nenhuma geração registrada nos últimos ${diasSemComm} dias. O inversor pode estar desligado, com falha de hardware ou sem energia na entrada.`;
      severidade = 'err';
      acoes      = ['Verificar se inversor está energizado', 'Checar display do inversor', 'Testar disjuntor de entrada CA'];

    } else if (eDay > 0 && horasSemComm && horasSemComm > 2) {
      causa      = 'Perda de comunicação (inversor gerando)';
      descricao  = `O inversor está gerando energia (${eDay} kWh hoje) mas perdeu comunicação com a nuvem há ${horasSemComm > 48 ? diasSemComm + ' dias' : horasSemComm + ' horas'}. Provável problema de rede Wi-Fi, cabo de dados ou datalogger.`;
      severidade = 'warn';
      acoes      = ['Verificar conexão Wi-Fi do datalogger', 'Reiniciar datalogger/stick logger', 'Verificar cabo de comunicação RS485'];

    } else if (eDay === 0 && horasSemComm && horasSemComm <= 24) {
      causa      = 'Sem geração hoje';
      descricao  = 'O inversor não registrou geração hoje. Pode ser dia nublado, manutenção ou falha temporária.';
      severidade = 'warn';
      acoes      = ['Verificar condições climáticas', 'Aguardar até o fim do dia', 'Verificar se há sombreamento'];

    } else if (horasSemComm && horasSemComm > 48) {
      causa      = 'Sem comunicação prolongada';
      descricao  = `Último contato há ${diasSemComm} dias. O sistema pode ter perdido acesso à internet ou o datalogger pode estar com defeito.`;
      severidade = 'warn';
      acoes      = ['Reiniciar roteador e datalogger', 'Verificar sinal Wi-Fi no local', 'Contatar cliente para verificação'];

    } else {
      causa      = 'Status offline — causa indeterminada';
      descricao  = 'O sistema está reportando status offline mas sem dados suficientes para determinar a causa exata.';
      severidade = 'warn';
      acoes      = ['Verificar portal do fabricante', 'Contatar cliente', 'Agendar visita técnica'];
    }

    // ── Tempo sem comunicação formatado ─────────────────────
    let tempoStr = '—';
    if (horasSemComm !== null) {
      if (horasSemComm < 1)       tempoStr = 'Menos de 1 hora';
      else if (horasSemComm < 24) tempoStr = `${horasSemComm}h atrás`;
      else if (diasSemComm === 1) tempoStr = '1 dia atrás';
      else if (diasSemComm < 30)  tempoStr = `${diasSemComm} dias atrás`;
      else                        tempoStr = `+${Math.floor(diasSemComm/30)} mês(es) atrás`;
    }

    return {
      causa, descricao, severidade, acoes,
      tempoStr, horasSemComm, diasSemComm,
      eDay, eMes, eTotal, power,
      ultimaComm,
    };
  }

  function renderModal(alerta, cliente) {
    const diag = cliente ? analisar(cliente) : null;

    const old = document.getElementById('modal-diagnostico');
    if (old) old.remove();

    const stColor = alerta.tipo === 'err' ? '#E24B4A' : '#EF9F27';
    const stIcon  = alerta.tipo === 'err' ? '🔴' : '⚠️';

    const sevColor = !diag ? '#EF9F27'
      : diag.severidade === 'err' ? '#E24B4A'
      : diag.severidade === 'ok'  ? '#1D9E75'
      : '#EF9F27';

    const sevIcon = !diag ? '⚠️'
      : diag.severidade === 'err' ? '🔴'
      : '⚠️';

    const modal = document.createElement('div');
    modal.id = 'modal-diagnostico';
    modal.className = 'modal-overlay open';
    modal.innerHTML = `
      <div class="modal" style="max-width:560px;">
        <div class="modal-header" style="border-bottom:3px solid ${stColor};">
          <h2 style="display:flex;align-items:center;gap:8px;font-size:16px;">
            ${stIcon} Diagnóstico do Alerta
          </h2>
          <button class="btn-icon" onclick="document.getElementById('modal-diagnostico').remove()">
            <i class="ti ti-x"></i>
          </button>
        </div>

        <!-- Identificação da planta -->
        <div style="padding:14px 20px;background:var(--bg-secondary);border-bottom:1px solid var(--border);">
          <div style="font-size:15px;font-weight:600;margin-bottom:2px;">${alerta.titulo.split(':')[0]}</div>
          <div style="font-size:12px;color:var(--text-secondary);">${cliente ? `${cliente.inversor} · ${cliente.potencia} kWp · ${cliente.endereco || 'Endereço não cadastrado'}` : alerta.detalhe}</div>
        </div>

        <div style="padding:16px 20px;display:flex;flex-direction:column;gap:14px;">

          ${diag ? `
          <!-- Causa provável -->
          <div style="background:${sevColor}18;border:1px solid ${sevColor}44;border-radius:10px;padding:14px;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
              <span style="font-size:18px;">${sevIcon}</span>
              <div>
                <div style="font-size:13px;font-weight:700;color:${sevColor};">${diag.causa}</div>
                <div style="font-size:11px;color:var(--text-secondary);margin-top:2px;">Diagnóstico automático</div>
              </div>
            </div>
            <div style="font-size:12px;color:var(--text-secondary);line-height:1.6;">${diag.descricao}</div>
          </div>

          <!-- Métricas rápidas -->
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;">
            <div style="background:var(--bg-secondary);padding:10px;border-radius:8px;text-align:center;">
              <div style="font-size:10px;color:var(--text-secondary);margin-bottom:3px;">ÚLTIMO CONTATO</div>
              <div style="font-size:12px;font-weight:700;color:${diag.horasSemComm > 24 ? '#E24B4A' : '#EF9F27'};">${diag.tempoStr}</div>
            </div>
            <div style="background:var(--bg-secondary);padding:10px;border-radius:8px;text-align:center;">
              <div style="font-size:10px;color:var(--text-secondary);margin-bottom:3px;">GERAÇÃO HOJE</div>
              <div style="font-size:12px;font-weight:700;color:${diag.eDay > 0 ? '#1D9E75' : '#E24B4A'};">${diag.eDay} kWh</div>
            </div>
            <div style="background:var(--bg-secondary);padding:10px;border-radius:8px;text-align:center;">
              <div style="font-size:10px;color:var(--text-secondary);margin-bottom:3px;">GERAÇÃO MÊS</div>
              <div style="font-size:12px;font-weight:700;">${diag.eMes > 0 ? diag.eMes + ' kWh' : '—'}</div>
            </div>
            <div style="background:var(--bg-secondary);padding:10px;border-radius:8px;text-align:center;">
              <div style="font-size:10px;color:var(--text-secondary);margin-bottom:3px;">POTÊNCIA INST.</div>
              <div style="font-size:12px;font-weight:700;">${cliente?.potencia || '—'} kWp</div>
            </div>
          </div>

          <!-- Ações recomendadas -->
          <div>
            <div style="font-size:11px;color:var(--text-secondary);font-weight:600;text-transform:uppercase;margin-bottom:8px;">Ações recomendadas</div>
            <div style="display:flex;flex-direction:column;gap:6px;">
              ${diag.acoes.map((acao, i) => `
                <label style="display:flex;align-items:center;gap:10px;font-size:13px;cursor:pointer;padding:8px 10px;background:var(--bg-secondary);border-radius:7px;">
                  <input type="checkbox" id="acao-${i}" style="width:15px;height:15px;flex-shrink:0;">
                  <span>${acao}</span>
                </label>`).join('')}
            </div>
          </div>` : ''}

          ${cliente ? `
          <!-- Dados do cliente -->
          <div style="padding:12px;border:1px solid var(--border);border-radius:8px;">
            <div style="font-size:11px;color:var(--text-secondary);margin-bottom:8px;font-weight:600;text-transform:uppercase;">Contato do cliente</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:13px;">
              <div><span style="color:var(--text-secondary);">E-mail:</span> ${cliente.email || '—'}</div>
              <div><span style="color:var(--text-secondary);">WhatsApp:</span> ${cliente.whats || '—'}</div>
              <div><span style="color:var(--text-secondary);">Fabricante:</span> ${cliente.inversor}</div>
              <div><span style="color:var(--text-secondary);">Instalação:</span> ${cliente.dataInstalacao || '—'}</div>
            </div>
          </div>` : ''}

          <!-- Botões de ação -->
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            ${cliente?.whats ? `
            <a href="https://wa.me/55${cliente.whats.replace(/\D/g,'')}" target="_blank"
               class="btn btn-sm" style="background:#25D366;color:white;border-color:#25D366;">
              <i class="ti ti-brand-whatsapp"></i> WhatsApp
            </a>` : ''}
            ${cliente?.email ? `
            <a href="mailto:${cliente.email}?subject=Alerta: ${encodeURIComponent(alerta.titulo.split(':')[0])}&body=Identificamos um problema na sua usina solar. Por favor, verifique."
               class="btn btn-sm">
              <i class="ti ti-mail"></i> E-mail
            </a>` : ''}
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
  }

  return { analisar, renderModal };
})();
