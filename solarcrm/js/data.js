// ============================================================
//  SolarCRM — Camada de dados
// ============================================================

const DB = {
  clientes: [],
  inversores: [],
  alertas: [],
  dashKpis: {
    geracaoHoje: 0,
    clientesAtivos: 0,
    economiaMes: 0,
    alertasAtivos: 0,
    geracaoDias: [0,0,0,0,0,0,0],
    economiaMeses: [0,0,0,0,0],
  },
  relatorios: [],
  _supabase: null,

  init() {
    this._supabase = window.supabase.createClient(
      'https://ovqwavrbxdplehvgplcv.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im92cXdhdnJieGRwbGVodmdwbGN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNDUzMTMsImV4cCI6MjA5MzgyMTMxM30.XWr7CRvjxAFzghgPbYHPyH4HzQRX-LkoRtF_qCvj6zM'
    )
  },

  load() {
    const self = this
    return self._supabase.from('clientes').select('*, inversores(*)')
      .then(function(res) {
        self.clientes = (res.data || []).map(function(c) {
          return {
            id: c.id,
            iniciais: c.nome.split(' ').slice(0,2).map(function(w){return w[0]}).join('').toUpperCase(),
            avBg: '#E1F5EE', avCor: '#0F6E56',
            nome: c.nome,
            tipo: c.tipo || 'Residencial',
            endereco: c.endereco || '',
            email: c.email,
            whats: c.whatsapp || '',
            dataInstalacao: c.created_at ? new Date(c.created_at).toLocaleDateString('pt-BR') : '',
            tarifa: c.tarifa || 0.82,
            potencia: c.potencia || 0,
            paineis: c.paineis || 0,
            inversor: c.inversor || '',
            status: c.status || 'ok',
            statusLabel: c.status === 'err' ? 'Crítico' : c.status === 'warn' ? 'Alerta' : 'Normal',
            geracaoHoje: c.inversores && c.inversores[0] ? c.inversores[0].geracao_hoje || 0 : 0,
            metaMes: Math.round((c.potencia || 0) * 110),
            geracaoMes: 0,
            hist12: [0,0,0,0,0,0,0,0,0,0,0,0],
            performance: 0,
            relatoriosEnviados: [],
          }
        })
        self.dashKpis.clientesAtivos = self.clientes.length
        self.dashKpis.geracaoHoje = self.clientes.reduce(function(s,c){return s+(c.geracaoHoje||0)},0)
        self.dashKpis.economiaMes = Math.round(self.clientes.reduce(function(s,c){return s+(c.geracaoHoje||0)*(c.tarifa||0.82)*30},0))
        return self._supabase.from('alertas').select('*').eq('resolvido', false)
      })
      .then(function(res) {
        const self2 = DB
        self2.alertas = (res.data || []).map(function(a) {
          return {
            id: a.id,
            tipo: a.tipo || 'warn',
            icon: a.tipo === 'err' ? 'ti-alert-circle' : 'ti-alert-triangle',
            titulo: a.titulo || '',
            detalhe: a.detalhe || '',
            acao: 'Diagnosticar',
          }
        })
       self2.dashKpis.alertasAtivos = self2.alertas.length

        // Só re-renderiza se o GDASH ainda não carregou
        if (!window._gdashLoaded) {
          const content = document.querySelector('.content');
          if (content && content.innerHTML.includes('grid-metrics')) {
            content.innerHTML = Pages.dashboard();
            if (typeof Charts !== 'undefined') {
              setTimeout(() => {
                if (typeof Charts.init === 'function') Charts.init();
              }, 50);
            }
          }
        }
      })
  },

  getCliente(id) {
    return this.clientes.find(function(c){return c.id === id})
  },

  computeEconomia(cliente) {
    return (cliente.geracaoMes * cliente.tarifa).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  },

  computeEconomiaHoje(cliente) {
    return (cliente.geracaoHoje * cliente.tarifa).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  },

  addCliente(dados) {
    const self = this
    return self._supabase.from('clientes').insert({
      nome: dados.nome,
      tipo: dados.tipo,
      email: dados.email,
      whatsapp: dados.whats,
      endereco: dados.endereco,
      potencia: dados.potencia,
      paineis: dados.paineis,
      inversor: dados.inversor,
      tarifa: 0.82,
      status: 'ok',
    }).select().single()
    .then(function(res) {
      if (res.error) throw res.error
      return self.load()
    })
  },

  resolverAlerta(id) {
    const self = this
    return self._supabase.from('alertas').update({ resolvido: true }).eq('id', id)
      .then(function() {
        self.alertas = self.alertas.filter(function(a){return a.id !== id})
        self.dashKpis.alertasAtivos = self.alertas.length
      })
  },
}
