# SolarCRM v2.0 — Guia de instalação e integração

## Estrutura do projeto

```
solarcrm/
├── index.html          # Ponto de entrada da aplicação
├── css/
│   └── style.css       # Todos os estilos (tema claro/escuro automático)
├── js/
│   ├── data.js         # Dados e estado da aplicação (DB)
│   ├── charts.js       # Módulo de gráficos (Chart.js)
│   ├── pages.js        # Construtores HTML de cada página
│   └── app.js          # Controlador principal (roteamento, modais, eventos)
└── README.md
```

---

## Como rodar localmente

### Opção 1 — Abrir direto no navegador
Basta abrir o arquivo `index.html` diretamente no Chrome, Firefox ou Edge.

### Opção 2 — Servidor local (recomendado para desenvolvimento)
```bash
# Com Python 3
cd solarcrm
python -m http.server 8080
# Acesse: http://localhost:8080

# Com Node.js (npx)
npx serve .
```

---

## Conectar dados reais de inversores

### Growatt API
```js
// Substitua em data.js → DB.clientes (campo geracaoHoje, hist12)
const res = await fetch('https://server.growatt.com/v1/plant/energy', {
  headers: { Authorization: 'Bearer SEU_TOKEN_GROWATT' }
});
const data = await res.json();
```

### Fronius Solar API
```js
const res = await fetch('https://api.solarweb.com/v1/pvsystems/{id}/aggrdata', {
  headers: {
    'AccessKeyId': 'SEU_ACCESS_KEY',
    'AccessKeyValue': 'SEU_ACCESS_VALUE',
  }
});
```

### SolarEdge SetApp API
```js
const res = await fetch(
  `https://monitoringapi.solaredge.com/site/{siteId}/energy?timeUnit=DAY&api_key=SEU_API_KEY`
);
```

---

## Envio de e-mail (SMTP)

Integre com um serviço transacional para envio dos relatórios.

### SendGrid
```js
// Backend Node.js / Express
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

await sgMail.send({
  to: cliente.email,
  from: 'relatorios@suaempresa.com.br',
  subject: `Seu relatório solar de maio 2026 — ${cliente.nome}`,
  html: gerarHtmlRelatorio(cliente),
  attachments: [{
    content: pdfBase64,
    filename: `relatorio-maio-2026-${cliente.nome}.pdf`,
    type: 'application/pdf',
    disposition: 'attachment',
  }],
});
```

### Nodemailer (SMTP direto)
```js
const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransport({
  host: 'smtp.seuprovedor.com.br',
  port: 587,
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});
await transporter.sendMail({ from, to, subject, html, attachments });
```

---

## Envio via WhatsApp Business API (Meta)

```js
// Requer conta Meta Business e número aprovado WABA
const res = await fetch(`https://graph.facebook.com/v18.0/${PHONE_ID}/messages`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.META_TOKEN}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    messaging_product: 'whatsapp',
    to: cliente.whats.replace(/\D/g, ''), // apenas dígitos
    type: 'template',
    template: {
      name: 'relatorio_solar_mensal', // template aprovado na Meta
      language: { code: 'pt_BR' },
      components: [{
        type: 'body',
        parameters: [
          { type: 'text', text: cliente.nome },
          { type: 'text', text: String(cliente.geracaoMes) },
          { type: 'text', text: DB.computeEconomia(cliente) },
        ],
      }],
    },
  }),
});
```

---

## Geração de PDF do relatório

```js
// Usando Puppeteer (Node.js)
const puppeteer = require('puppeteer');

async function gerarPDF(htmlConteudo, nomeArquivo) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setContent(htmlConteudo);
  await page.pdf({
    path: `./relatorios/${nomeArquivo}.pdf`,
    format: 'A4', printBackground: true,
    margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
  });
  await browser.close();
}
```

---

## Personalizar logo e cores

No arquivo `css/style.css`, altere as variáveis:

```css
:root {
  --teal: #1D9E75;       /* Cor principal — altere para a cor da sua empresa */
  --teal-dark: #0F6E56;  /* Hover da cor principal */
  --teal-light: #E1F5EE; /* Fundo suave da cor principal */
}
```

Para adicionar o logo da empresa na sidebar, substitua em `index.html`:
```html
<div class="logo-icon">
  <img src="logo.png" alt="Logo" style="width:28px;height:28px;object-fit:contain;" />
</div>
```

---

## Deploy em produção

### Vercel / Netlify (static hosting)
```bash
# Faça upload da pasta solarcrm/ diretamente no painel
# ou use o CLI:
npx vercel --prod
```

### Nginx
```nginx
server {
  listen 80;
  server_name crm.suaempresa.com.br;
  root /var/www/solarcrm;
  index index.html;
  location / { try_files $uri $uri/ /index.html; }
}
```

---

## Adicionar backend (recomendado para produção)

Para persistência real de dados, autenticação e automações, integre com:
- **Supabase** (PostgreSQL + REST API gratuito)
- **Firebase Firestore** (banco NoSQL em tempo real)
- **Node.js + Express + MongoDB**

O arquivo `js/data.js` está preparado para ser substituído por chamadas de API:
```js
// Substituir DB.clientes por:
const { data: clientes } = await supabase.from('clientes').select('*');
```

---

Desenvolvido com SolarCRM v2.0 · Powered by Claude (Anthropic)
