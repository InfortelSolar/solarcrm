// ============================================================
//  SolarCRM — Camada de dados (Supabase)
// ============================================================

const supabase = createClient(
  'https://ovqwavrbxdplehvgplcv.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im92cXdhdnJieGRwbGVodmdwbGN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNDUzMTMsImV4cCI6MjA5MzgyMTMxM30.XWr7CRvjxAFzghgPbYHPyH4HzQRX-LkoRtF_qCvj6zM'
)

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

  async load() {
    // Carregar clientes
    const { data: clientes } = await supabase
      .from('clientes').select('*, inversores(*)')
    this.clientes = (clientes || []).map(c => ({
      id: c.id,
      iniciais: c.nome.split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase(),
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
      geracaoHoje: c.inversores?.[0]?.geracao_hoje || 0,
      metaMes: Math.round((c.potencia || 0) * 110),
      geracaoMes: 0,
      hist12: [0,0,0,0,0,0,0,0,0,0,0,0],
      performance: 0,
      relatoriosEnviados: [],
    }))

    // Carregar inversores
    const { data: inversores } = await supabase
      .from('inversores').select('*, clientes(nome)')
    this.inversores = (inversores || []).map(i => ({
      id: i.id,
      sigla: (i.fabricante || 'INV').slice(0,3).toUpperCase(),
      bgCol: '#E1F5EE', txtCol: '#0F6E56',
      modelo: i.modelo || '',
      status: i.status || 'ok',
      statusLabel: i.status === 'err' ? 'Offline' : i.status === 'warn' ? 'Alerta' : 'Online',
      cliente: i.clientes?.nome || '',
      serial: i.serial || '',
      api: (i.fabricante || '') + ' API',
      geracaoHoje: i.geracao_hoje || 0,
      temp: i.temperatura || null,
      potencia: 0,
    }))

    // Carregar alertas
    const { data: alertas } = await supabase
      .from('alertas').select('*, clientes(nome)')
      .eq('resolvido', false)
      .order('created_at', { ascending: false })
    this.alertas = (alertas || []).map(a => ({
      id: a.id,
      tipo: a.tipo || 'warn',
      icon: a.tipo === 'err' ? 'ti-alert-circle' : 'ti-alert-triangle',
      titulo: a.titulo || '',
      detalhe: a.detalhe || '',
      acao: 'Diagnosticar',
      prompt: a.titulo,
    }))

    // Atualizar KPIs
    this.dashKpis.clientesAtivos = this.clientes.length
    this.dashKpis.alertasAtivos = this.alertas.length
    this.dashKpis.geracaoHoje = this.clientes.reduce((s,c) => s + (c.geracaoHoje||0), 0)
    this.dashKpis.economiaMes = Math.round(this.clientes.reduce((s,c) => s + (c.geracaoHoje||0) * (c.tarifa||0.82) * 30, 0))
  },

  getCliente(id) {
    return this.clientes.find(c => c.id === id)
  },

  computeEconomia(cliente) {
    return (cliente.geracaoMes * cliente.tarifa).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  },

  computeEconomiaHoje(cliente) {
    return (cliente.geracaoHoje * cliente.tarifa).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  },

  async addCliente(dados) {
    const { data, error } = await supabase
      .from('clientes')
      .insert({
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
      })
      .select().single()
    if (error) throw error
    await this.load()
    return data
  },

  async resolverAlerta(id) {
    await supabase.from('alertas').update({ resolvido: true }).eq('id', id)
    this.alertas = this.alertas.filter(a => a.id !== id)
    this.dashKpis.alertasAtivos = this.alertas.length
  },
}
