// ============================================================
//  SolarCRM — Editor de Template de Relatório
//  Preview em tempo real | Blocos ativáveis | Salva no Supabase
// ============================================================

const EditorRelatorio = (() => {

  // Template padrão
  const TEMPLATE_DEFAULT = {
    assunto: 'Seu relatório solar de {mes} — {nome_cliente}',
    saudacao: 'Olá, {nome_cliente}!',
    introducao: 'Em {mes}, sua usina solar teve o seguinte desempenho:',
    rodape: 'Qualquer dúvida, entre em contato conosco. Obrigado pela confiança!',
    assinatura: 'Infortel Solar',
    blocos: {
      geracao: true,
      economia: true,
      performance: true,
      historico: true,
      status: true,
      whatsapp: true,
    },
    corPrimaria: '#1D9E75',
    logo: true,
  };

  let _template = { ...TEMPLATE_DEFAULT };

  // Carrega template salvo do Supabase
  async function carregar() {
    try {
      const { data } = await DB._supabase
        .from('configuracoes')
        .select('*')
        .eq('id', 'template_relatorio')
        .single();
      if (data?.valor) _template = { ...TEMPLATE_DEFAULT, ...data.valor };
    } catch(e) { /* usa padrão */ }
    return _template;
  }

  // Salva template no Supabase
  async function salvar(tpl) {
    _template = { ...tpl };
    await DB._supabase.from('configuracoes').upsert({
      id: 'template_relatorio',
      valor: _template,
      updated_at: new Date().toISOString(),
    });
  }

  // Gera preview HTML do e-mail para um cliente exemplo
  function gerarPreviewHTML(tpl, cliente) {
    const c = cliente || DB.clientes[0] || {
      nome: 'João Silva', geracaoHoje: 18.5, geracaoMes: 420,
      metaMes: 500, tarifa: 0.82, status: 'ok', statusLabel: 'Normal',
      potencia: 5.4, inversor: 'Solis', hist12: [380,410,390,430,420,400,350,370,410,440,420,420],
    };

    const mes = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    const economia = (c.geracaoMes * c.tarifa).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const percMeta = Math.round((c.geracaoMes / (c.metaMes || 1)) * 100);
    const cor = tpl.corPrimaria || '#1D9E75';

    const replace = (str) => (str || '')
      .replace(/{nome_cliente}/g, c.nome)
      .replace(/{mes}/g, mes)
      .replace(/{kwh_mes}/g, c.geracaoMes)
      .replace(/{economia}/g, economia)
      .replace(/{percentual_meta}/g, percMeta)
      .replace(/{status_sistema}/g, c.statusLabel)
      .replace(/{potencia}/g, c.potencia)
      .replace(/{inversor}/g, c.inversor);

    const meses = ['Jun','Jul','Ago','Set','Out','Nov','Dez','Jan','Fev','Mar','Abr','Mai'];
    const maxHist = Math.max(...(c.hist12 || [1]));

    return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:20px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

  <!-- Header -->
  <tr><td style="background:${cor};padding:28px 32px;text-align:center;">
    ${tpl.logo ? `<div style="font-size:22px;font-weight:700;color:white;letter-spacing:1px;">☀️ ${replace(tpl.assinatura)}</div>` : ''}
    <div style="color:rgba(255,255,255,0.85);font-size:13px;margin-top:6px;">Relatório de Monitoramento Solar</div>
  </td></tr>

  <!-- Saudação -->
  <tr><td style="padding:28px 32px 0;">
    <div style="font-size:20px;font-weight:600;color:#1a1a1a;margin-bottom:8px;">${replace(tpl.saudacao)}</div>
    <div style="font-size:14px;color:#666;line-height:1.6;">${replace(tpl.introducao)}</div>
  </td></tr>

  ${tpl.blocos.geracao ? `
  <!-- Geração -->
  <tr><td style="padding:20px 32px 0;">
    <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td width="48%" style="background:#E1F5EE;border-radius:10px;padding:18px;text-align:center;">
        <div style="font-size:11px;color:#0F6E56;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">⚡ Geração do Mês</div>
        <div style="font-size:28px;font-weight:700;color:#0F6E56;">${c.geracaoMes} <span style="font-size:14px;">kWh</span></div>
      </td>
      <td width="4%"></td>
      <td width="48%" style="background:#FFF8E1;border-radius:10px;padding:18px;text-align:center;">
        <div style="font-size:11px;color:#854F0B;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">💰 Economia</div>
        <div style="font-size:28px;font-weight:700;color:#854F0B;">${economia}</div>
      </td>
    </tr>
    </table>
  </td></tr>` : ''}

  ${tpl.blocos.performance ? `
  <!-- Performance -->
  <tr><td style="padding:20px 32px 0;">
    <div style="background:#f8f9fa;border-radius:10px;padding:16px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <span style="font-size:13px;font-weight:600;color:#333;">Performance vs Meta</span>
        <span style="font-size:18px;font-weight:700;color:${percMeta >= 80 ? '#1D9E75' : percMeta >= 50 ? '#EF9F27' : '#E24B4A'};">${percMeta}%</span>
      </div>
      <div style="background:#e0e0e0;border-radius:20px;height:10px;overflow:hidden;">
        <div style="background:${percMeta >= 80 ? '#1D9E75' : percMeta >= 50 ? '#EF9F27' : '#E24B4A'};height:10px;width:${Math.min(percMeta,100)}%;border-radius:20px;"></div>
      </div>
      <div style="font-size:11px;color:#888;margin-top:6px;">Meta: ${c.metaMes} kWh · Realizado: ${c.geracaoMes} kWh</div>
    </div>
  </td></tr>` : ''}

  ${tpl.blocos.historico ? `
  <!-- Histórico -->
  <tr><td style="padding:20px 32px 0;">
    <div style="font-size:13px;font-weight:600;color:#333;margin-bottom:12px;">📊 Histórico — últimos 12 meses</div>
    <table width="100%" cellpadding="0" cellspacing="0">
    <tr valign="bottom" style="height:80px;">
      ${(c.hist12 || []).map((v, i) => {
        const h = maxHist > 0 ? Math.round((v / maxHist) * 70) : 4;
        return `<td align="center" style="vertical-align:bottom;padding:0 1px;">
          <div style="background:${cor};width:100%;height:${h}px;border-radius:3px 3px 0 0;min-height:4px;" title="${v} kWh"></div>
        </td>`;
      }).join('')}
    </tr>
    <tr>
      ${meses.map(m => `<td align="center" style="font-size:9px;color:#999;padding-top:4px;">${m}</td>`).join('')}
    </tr>
    </table>
  </td></tr>` : ''}

  ${tpl.blocos.status ? `
  <!-- Status -->
  <tr><td style="padding:20px 32px 0;">
    <div style="background:${c.status === 'ok' ? '#E1F5EE' : '#FAEEDA'};border-radius:10px;padding:14px 18px;display:flex;align-items:center;gap:12px;">
      <span style="font-size:20px;">${c.status === 'ok' ? '✅' : '⚠️'}</span>
      <div>
        <div style="font-size:13px;font-weight:600;color:${c.status === 'ok' ? '#0F6E56' : '#854F0B'};">Sistema ${c.statusLabel}</div>
        <div style="font-size:12px;color:#666;margin-top:2px;">${c.inversor} · ${c.potencia} kWp instalados</div>
      </div>
    </div>
  </td></tr>` : ''}

  <!-- Rodapé -->
  <tr><td style="padding:24px 32px;">
    <div style="font-size:13px;color:#888;line-height:1.6;border-top:1px solid #eee;padding-top:20px;">
      ${replace(tpl.rodape)}<br><br>
      <strong style="color:#333;">${replace(tpl.assinatura)}</strong>
    </div>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
  }

  // Gera mensagem WhatsApp resumida
  function gerarWhatsApp(tpl, cliente) {
    const c = cliente || DB.clientes[0];
    if (!c) return '';
    const mes = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    const economia = (c.geracaoMes * c.tarifa).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const percMeta = Math.round((c.geracaoMes / (c.metaMes || 1)) * 100);
    const status = c.status === 'ok' ? '✅ Online' : '⚠️ Atenção necessária';

    return `☀️ *Relatório Solar — ${mes}*\n\nOlá, *${c.nome}*!\n\n` +
      `⚡ *Geração:* ${c.geracaoMes} kWh\n` +
      `💰 *Economia:* ${economia}\n` +
      `📊 *Performance:* ${percMeta}% da meta\n` +
      `🔌 *Status:* ${status}\n\n` +
      `_${tpl.assinatura || 'Infortel Solar'}_`;
  }

  // Abre o editor modal
  async function abrir() {
    await carregar();
    const tpl = { ..._template };

    const old = document.getElementById('modal-editor-relatorio');
    if (old) old.remove();

    const modal = document.createElement('div');
    modal.id = 'modal-editor-relatorio';
    modal.className = 'modal-overlay open';
    modal.style.cssText = 'z-index:1000;';

    modal.innerHTML = `
      <div class="modal" style="max-width:960px;width:95vw;max-height:90vh;overflow:hidden;display:flex;flex-direction:column;">
        <div class="modal-header" style="border-bottom:3px solid #1D9E75;flex-shrink:0;">
          <h2 style="display:flex;align-items:center;gap:8px;font-size:16px;">
            <i class="ti ti-brush"></i> Editor de Template
          </h2>
          <div style="display:flex;gap:8px;align-items:center;">
            <button class="btn btn-sm" onclick="EditorRelatorio._resetar()">
              <i class="ti ti-refresh"></i> Resetar
            </button>
            <button class="btn btn-teal" onclick="EditorRelatorio._salvarEFechar()">
              <i class="ti ti-device-floppy"></i> Salvar
            </button>
            <button class="btn-icon" onclick="document.getElementById('modal-editor-relatorio').remove()">
              <i class="ti ti-x"></i>
            </button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:340px 1fr;flex:1;overflow:hidden;">

          <!-- Painel esquerdo — configurações -->
          <div style="border-right:1px solid var(--border);overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:14px;">

            <!-- Cor primária -->
            <div>
              <div style="font-size:11px;font-weight:600;text-transform:uppercase;color:var(--text-secondary);margin-bottom:8px;">Cor principal</div>
              <div style="display:flex;align-items:center;gap:8px;">
                <input type="color" id="ed-cor" value="${tpl.corPrimaria}" oninput="EditorRelatorio._atualizar()"
                  style="width:40px;height:36px;border:1px solid var(--border);border-radius:6px;cursor:pointer;padding:2px;">
                <input type="text" id="ed-cor-hex" value="${tpl.corPrimaria}"
                  oninput="document.getElementById('ed-cor').value=this.value;EditorRelatorio._atualizar()"
                  style="flex:1;padding:8px 10px;border:1px solid var(--border);border-radius:6px;font-size:13px;background:var(--bg-secondary);">
              </div>
            </div>

            <!-- Assinatura -->
            <div>
              <div style="font-size:11px;font-weight:600;text-transform:uppercase;color:var(--text-secondary);margin-bottom:6px;">Nome/Assinatura</div>
              <input type="text" id="ed-assinatura" value="${tpl.assinatura}" oninput="EditorRelatorio._atualizar()"
                style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;font-size:13px;background:var(--bg-secondary);box-sizing:border-box;">
            </div>

            <!-- Assunto -->
            <div>
              <div style="font-size:11px;font-weight:600;text-transform:uppercase;color:var(--text-secondary);margin-bottom:6px;">Assunto do e-mail</div>
              <input type="text" id="ed-assunto" value="${tpl.assunto}" oninput="EditorRelatorio._atualizar()"
                style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;font-size:13px;background:var(--bg-secondary);box-sizing:border-box;">
            </div>

            <!-- Saudação -->
            <div>
              <div style="font-size:11px;font-weight:600;text-transform:uppercase;color:var(--text-secondary);margin-bottom:6px;">Saudação</div>
              <input type="text" id="ed-saudacao" value="${tpl.saudacao}" oninput="EditorRelatorio._atualizar()"
                style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;font-size:13px;background:var(--bg-secondary);box-sizing:border-box;">
            </div>

            <!-- Introdução -->
            <div>
              <div style="font-size:11px;font-weight:600;text-transform:uppercase;color:var(--text-secondary);margin-bottom:6px;">Introdução</div>
              <textarea id="ed-introducao" rows="2" oninput="EditorRelatorio._atualizar()"
                style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;font-size:13px;background:var(--bg-secondary);resize:vertical;box-sizing:border-box;">${tpl.introducao}</textarea>
            </div>

            <!-- Rodapé -->
            <div>
              <div style="font-size:11px;font-weight:600;text-transform:uppercase;color:var(--text-secondary);margin-bottom:6px;">Rodapé</div>
              <textarea id="ed-rodape" rows="2" oninput="EditorRelatorio._atualizar()"
                style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;font-size:13px;background:var(--bg-secondary);resize:vertical;box-sizing:border-box;">${tpl.rodape}</textarea>
            </div>

            <!-- Blocos -->
            <div>
              <div style="font-size:11px;font-weight:600;text-transform:uppercase;color:var(--text-secondary);margin-bottom:8px;">Blocos do relatório</div>
              <div style="display:flex;flex-direction:column;gap:8px;">
                ${[
                  ['geracao',     '⚡', 'Geração + Economia'],
                  ['performance', '📊', 'Performance vs Meta'],
                  ['historico',   '📈', 'Histórico 12 meses'],
                  ['status',      '🔌', 'Status do sistema'],
                ].map(([key, icon, label]) => `
                  <label style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:var(--bg-secondary);border-radius:8px;cursor:pointer;">
                    <span style="font-size:13px;">${icon} ${label}</span>
                    <input type="checkbox" id="ed-bloco-${key}" ${tpl.blocos[key] ? 'checked' : ''}
                      onchange="EditorRelatorio._atualizar()"
                      style="width:16px;height:16px;cursor:pointer;">
                  </label>`).join('')}
              </div>
            </div>

            <!-- Variáveis disponíveis -->
            <div style="background:var(--bg-secondary);border-radius:8px;padding:12px;">
              <div style="font-size:11px;font-weight:600;color:var(--text-secondary);margin-bottom:8px;">Variáveis disponíveis</div>
              <div style="display:flex;flex-wrap:wrap;gap:4px;">
                ${['{nome_cliente}','{mes}','{kwh_mes}','{economia}','{percentual_meta}','{status_sistema}','{potencia}','{inversor}'].map(v =>
                  `<span onclick="navigator.clipboard.writeText('${v}');App.toast('Copiado!')"
                    style="background:var(--bg-primary,#fff);border:1px solid var(--border);padding:2px 7px;border-radius:10px;font-size:11px;cursor:pointer;font-family:monospace;">${v}</span>`
                ).join('')}
              </div>
            </div>

            <!-- Preview WhatsApp -->
            <div>
              <div style="font-size:11px;font-weight:600;text-transform:uppercase;color:var(--text-secondary);margin-bottom:8px;">Preview WhatsApp</div>
              <div id="ed-whatsapp-preview" style="background:#E8F5E9;border-radius:10px;padding:12px;font-size:12px;line-height:1.7;white-space:pre-wrap;font-family:inherit;border:1px solid #C8E6C9;"></div>
            </div>

          </div>

          <!-- Painel direito — preview e-mail -->
          <div style="overflow-y:auto;background:#f0f0f0;padding:16px;">
            <div style="font-size:11px;font-weight:600;text-transform:uppercase;color:#888;margin-bottom:10px;text-align:center;">Preview do E-mail</div>
            <iframe id="ed-preview-iframe"
              style="width:100%;height:calc(100% - 30px);min-height:500px;border:none;border-radius:8px;background:white;"
              sandbox="allow-same-origin">
            </iframe>
          </div>

        </div>
      </div>`;

    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);

    // Renderiza preview inicial
    setTimeout(() => _renderPreview(tpl), 100);
  }

  function _lerFormulario() {
    return {
      corPrimaria:  document.getElementById('ed-cor')?.value || '#1D9E75',
      assinatura:   document.getElementById('ed-assinatura')?.value || '',
      assunto:      document.getElementById('ed-assunto')?.value || '',
      saudacao:     document.getElementById('ed-saudacao')?.value || '',
      introducao:   document.getElementById('ed-introducao')?.value || '',
      rodape:       document.getElementById('ed-rodape')?.value || '',
      logo: true,
      blocos: {
        geracao:     document.getElementById('ed-bloco-geracao')?.checked ?? true,
        performance: document.getElementById('ed-bloco-performance')?.checked ?? true,
        historico:   document.getElementById('ed-bloco-historico')?.checked ?? true,
        status:      document.getElementById('ed-bloco-status')?.checked ?? true,
      },
    };
  }

  function _renderPreview(tpl) {
    const iframe = document.getElementById('ed-preview-iframe');
    if (!iframe) return;
    const html = gerarPreviewHTML(tpl, DB.clientes[0]);
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open(); doc.write(html); doc.close();

    // WhatsApp preview
    const wpEl = document.getElementById('ed-whatsapp-preview');
    if (wpEl) wpEl.textContent = gerarWhatsApp(tpl, DB.clientes[0]);

    // Sincroniza hex com color picker
    const hexEl = document.getElementById('ed-cor-hex');
    if (hexEl) hexEl.value = tpl.corPrimaria;
  }

  function _atualizar() {
    const tpl = _lerFormulario();
    _renderPreview(tpl);
  }

  async function _salvarEFechar() {
    const tpl = _lerFormulario();
    await salvar(tpl);
    document.getElementById('modal-editor-relatorio')?.remove();
    App.toast('Template salvo com sucesso!');
  }

  function _resetar() {
    if (!confirm('Resetar para o template padrão?')) return;
    _template = { ...TEMPLATE_DEFAULT };
    document.getElementById('modal-editor-relatorio')?.remove();
    abrir();
  }

  return { abrir, carregar, salvar, gerarPreviewHTML, gerarWhatsApp, _atualizar, _salvarEFechar, _resetar };
})();
