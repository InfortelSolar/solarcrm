// ============================================================
//  SolarCRM — Dados e estado da aplicação
// ============================================================

const DB = {

  clientes: [
    {
      id: 'js', iniciais: 'JS', avBg: '#E1F5EE', avCor: '#0F6E56',
      nome: 'João Santos', tipo: 'Residencial',
      endereco: 'Rua das Palmeiras, 123 · João Pessoa — PB',
      email: 'joao.santos@email.com', whats: '(83) 99123-4567',
      dataInstalacao: '14/03/2023', tarifa: 0.82,
      potencia: 5.4, paineis: 12, inversor: 'Growatt MIN 5000TL',
      status: 'ok', statusLabel: 'Normal',
      geracaoHoje: 52, metaMes: 1300, geracaoMes: 1240,
      hist12: [820, 790, 950, 1100, 1040, 1190, 1250, 1180, 1090, 1150, 1240, 1240],
      performance: 94,
      relatoriosEnviados: [
        { mes: 'Abril 2026', data: '01/05/2026', canais: 'E-mail · WhatsApp · PDF' },
        { mes: 'Março 2026', data: '01/04/2026', canais: 'E-mail · WhatsApp · PDF' },
        { mes: 'Fevereiro 2026', data: '01/03/2026', canais: 'E-mail · WhatsApp · PDF' },
      ]
    },
    {
      id: 'ml', iniciais: 'ML', avBg: '#E6F1FB', avCor: '#185FA5',
      nome: 'Maria Lima', tipo: 'Residencial',
      endereco: 'Av. Epitácio Pessoa, 55 · João Pessoa — PB',
      email: 'maria.lima@email.com', whats: '(83) 98765-1234',
      dataInstalacao: '20/07/2022', tarifa: 0.82,
      potencia: 8.1, paineis: 18, inversor: 'SolarEdge SE8K',
      status: 'ok', statusLabel: 'Normal',
      geracaoHoje: 71, metaMes: 1900, geracaoMes: 1780,
      hist12: [1200, 1180, 1350, 1500, 1450, 1620, 1700, 1650, 1580, 1640, 1750, 1780],
      performance: 88,
      relatoriosEnviados: [
        { mes: 'Abril 2026', data: '01/05/2026', canais: 'E-mail · WhatsApp · PDF' },
        { mes: 'Março 2026', data: '01/04/2026', canais: 'E-mail · PDF' },
      ]
    },
    {
      id: 'xyz', iniciais: 'XZ', avBg: '#FAEEDA', avCor: '#854F0B',
      nome: 'Empresa XYZ', tipo: 'Comercial',
      endereco: 'Rua do Comércio, 200 · Guarabira — PB',
      email: 'energia@empresaxyz.com.br', whats: '(83) 3271-0000',
      dataInstalacao: '10/01/2023', tarifa: 0.76,
      potencia: 24, paineis: 60, inversor: 'Fronius Symo 24.0',
      status: 'warn', statusLabel: 'Alerta',
      geracaoHoje: 136, metaMes: 5800, geracaoMes: 3240,
      hist12: [4100, 3900, 4500, 5000, 4800, 5300, 5500, 5200, 4900, 5100, 4200, 3240],
      performance: 76,
      relatoriosEnviados: [
        { mes: 'Abril 2026', data: '01/05/2026', canais: 'E-mail · WhatsApp · PDF' },
      ]
    },
    {
      id: 'cn', iniciais: 'CN', avBg: '#FCEBEB', avCor: '#A32D2D',
      nome: 'Carlos Neto', tipo: 'Residencial',
      endereco: 'Rua das Flores, 45 · Guarabira — PB',
      email: 'carlos.neto@email.com', whats: '(83) 99456-7890',
      dataInstalacao: '05/09/2023', tarifa: 0.82,
      potencia: 3.3, paineis: 8, inversor: 'Growatt MIN 3000TL',
      status: 'err', statusLabel: 'Crítico',
      geracaoHoje: 0, metaMes: 720, geracaoMes: 0,
      hist12: [480, 460, 530, 610, 590, 640, 660, 630, 600, 620, 580, 0],
      performance: 0,
      relatoriosEnviados: [
        { mes: 'Abril 2026', data: '01/05/2026', canais: 'E-mail · PDF' },
      ]
    },
    {
      id: 'ac', iniciais: 'AC', avBg: '#E1F5EE', avCor: '#0F6E56',
      nome: 'Ana Costa', tipo: 'Residencial',
      endereco: 'Travessa das Mangueiras, 12 · Campina Grande — PB',
      email: 'ana.costa@email.com', whats: '(83) 99321-0987',
      dataInstalacao: '22/11/2022', tarifa: 0.82,
      potencia: 6.6, paineis: 15, inversor: 'SolarEdge SE6K',
      status: 'ok', statusLabel: 'Normal',
      geracaoHoje: 44, metaMes: 1500, geracaoMes: 1050,
      hist12: [980, 960, 1100, 1250, 1200, 1350, 1400, 1330, 1200, 1270, 1120, 1050],
      performance: 61,
      relatoriosEnviados: [
        { mes: 'Abril 2026', data: '01/05/2026', canais: 'E-mail · WhatsApp · PDF' },
        { mes: 'Março 2026', data: '01/04/2026', canais: 'E-mail · WhatsApp · PDF' },
      ]
    },
  ],

  inversores: [
    {
      id: 'inv1', sigla: 'GRW', bgCol: '#E1F5EE', txtCol: '#0F6E56',
      modelo: 'Growatt MIN 5000TL', status: 'ok', statusLabel: 'Online',
      cliente: 'João Santos', serial: 'GW2023051234', api: 'Growatt API v1.2',
      geracaoHoje: 52, temp: 49.2, potencia: 5.0,
    },
    {
      id: 'inv2', sigla: 'FRN', bgCol: '#E6F1FB', txtCol: '#185FA5',
      modelo: 'Fronius Symo 24.0', status: 'warn', statusLabel: 'Alerta',
      cliente: 'Empresa XYZ', serial: 'FR20220867', api: 'SolarAPI v2',
      geracaoHoje: 136, temp: 51.7, potencia: 24.0,
    },
    {
      id: 'inv3', sigla: 'GRW', bgCol: '#FCEBEB', txtCol: '#A32D2D',
      modelo: 'Growatt MIN 3000TL', status: 'err', statusLabel: 'Offline',
      cliente: 'Carlos Neto', serial: 'GW2021094521', api: 'Sem resposta há 6h',
      geracaoHoje: 0, temp: null, potencia: 3.0,
    },
    {
      id: 'inv4', sigla: 'SE', bgCol: '#EAF3DE', txtCol: '#3B6D11',
      modelo: 'SolarEdge SE8K', status: 'ok', statusLabel: 'Online',
      cliente: 'Maria Lima', serial: 'SE2024010033', api: 'SetApp API',
      geracaoHoje: 71, temp: 47.1, potencia: 8.0,
    },
    {
      id: 'inv5', sigla: 'SE', bgCol: '#EAF3DE', txtCol: '#3B6D11',
      modelo: 'SolarEdge SE6K', status: 'ok', statusLabel: 'Online',
      cliente: 'Ana Costa', serial: 'SE2023080044', api: 'SetApp API',
      geracaoHoje: 44, temp: 45.8, potencia: 6.0,
    },
  ],

  alertas: [
    {
      id: 'a1', tipo: 'err', icon: 'ti-alert-circle',
      titulo: 'Crítico: Inversor Growatt MIN 3000TL offline — Carlos Neto',
      detalhe: 'Hoje 08:14 · Sem comunicação há 6h · Possível falha de rede ou hardware',
      acao: 'Diagnóstico',
      prompt: 'Diagnóstico completo para inversor Growatt MIN 3000TL offline do cliente Carlos Neto: causas possíveis, checklist de verificação no local e orientações para o cliente.'
    },
    {
      id: 'a2', tipo: 'err', icon: 'ti-bolt-off',
      titulo: 'Crítico: Produção zero desde as 13h — Ana Costa (string 2)',
      detalhe: 'Hoje 13:00 · Restante do sistema normal · Possível módulo ou disjuntor',
      acao: 'Diagnosticar',
      prompt: 'Diagnóstico para string 2 com produção zero na cliente Ana Costa, sistema SolarEdge SE8K: causas possíveis e plano de ação detalhado.'
    },
    {
      id: 'a3', tipo: 'warn', icon: 'ti-solar-electricity',
      titulo: 'Atenção: Geração 40% abaixo do esperado — Empresa XYZ',
      detalhe: 'Hoje 10:32 · Fronius Symo 24.0 · Possível sombreamento ou sujeira',
      acao: 'Analisar',
      prompt: 'Análise de queda de 40% na geração da Empresa XYZ com inversor Fronius Symo 24.0: causas prováveis, impacto financeiro e recomendações de manutenção.'
    },
    {
      id: 'a4', tipo: 'warn', icon: 'ti-trending-down',
      titulo: 'Atenção: Queda gradual de eficiência — João Santos (−8% em 30 dias)',
      detalhe: 'Ontem 14:20 · Pode indicar degradação de módulos ou sujeira acumulada',
      acao: 'Analisar',
      prompt: 'Análise de queda gradual de 8% na eficiência solar de João Santos em 30 dias: diagnóstico, recomendação de manutenção preventiva e comunicado ao cliente.'
    },
  ],

  dashKpis: {
    geracaoHoje: 1847,
    clientesAtivos: 38,
    economiaMes: 9240,
    alertasAtivos: 4,
    geracaoDias: [210, 280, 320, 290, 340, 180, 200],
    economiaMeses: [7200, 7600, 8100, 8700, 9240],
  },

  relatorios: [
    { id: 'r1', nome: 'Relatório Mensal — Abril 2026', clientes: 38, data: '01/05/2026', status: 'ok' },
    { id: 'r2', nome: 'Relatório Mensal — Março 2026', clientes: 35, data: '01/04/2026', status: 'ok' },
    { id: 'r3', nome: 'Relatório Mensal — Fevereiro 2026', clientes: 35, data: '01/03/2026', status: 'ok' },
  ],

  // Computed helpers
  getCliente(id) { return this.clientes.find(c => c.id === id); },

  computeEconomia(cliente) {
    return (cliente.geracaoMes * cliente.tarifa).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  },

  computeEconomiaHoje(cliente) {
    return (cliente.geracaoHoje * cliente.tarifa).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  },

  addCliente(dados) {
    const id = 'c' + Date.now();
    const initials = dados.nome.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
    this.clientes.push({
      id, iniciais: initials, avBg: '#E1F5EE', avCor: '#0F6E56',
      status: 'ok', statusLabel: 'Normal',
      geracaoHoje: 0, metaMes: Math.round(dados.potencia * 110),
      geracaoMes: 0, hist12: new Array(12).fill(0), performance: 0,
      relatoriosEnviados: [], dataInstalacao: new Date().toLocaleDateString('pt-BR'),
      tarifa: 0.82,
      ...dados
    });
    this.dashKpis.clientesAtivos++;
    return id;
  },
};
