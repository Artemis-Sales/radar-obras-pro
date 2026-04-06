# 🏗️ Radar de Obras PRO
> **Inteligência Artificial e Automação para Prospecção de Obras em São Paulo.**

O **Radar de Obras PRO** é uma plataforma inovadora desenvolvida para empresas do setor de construção civil que desejam encontrar novos clientes de forma proativa. O sistema utiliza robôs de automação (scrapers) e Inteligência Artificial de última geração para monitorar fontes públicas e extrair oportunidades de negócios reais.

---

## 🚀 Principais Tecnologias
- **Next.js 16 (App Router)** - Framework React para o frontend.
- **Google Gemini 2.5 Flash** - IA para processamento de linguagem natural e extração de dados.
- **Firebase (Firestore & Auth)** - Banco de dados em tempo real e autenticação.
- **Puppeteer** - Automação de navegador para captura de dados governamentais.
- **Tailwind CSS 4** - Design moderno, fluido e premium.
- **Google Maps API** - Geolocalização de leads em mapa interativo.

---

## 🎨 Funcionalidades em Destaque
- **🕵️ Mineração Automatizada:** Busca diária por novas licenças ambientais e editais públicos.
- **🧠 Extração com IA:** Transforma petições e diários oficiais "ilegíveis" em JSON estruturado com precisão cirúrgica.
- **📍 Mapa de Obras:** Visualize geograficamente onde estão os novos canteiros de obras.
- **📋 CRM Kanban:** Arraste leads entre estágios (Lead Novo, Em Negociação, Fechado) para gerenciar sua prospecção.
- **🛡️ Anti-Duplicação:** Motor inteligente que evita o cadastro duplicado de uma mesma obra.

---

## 📁 Estrutura do Repositório
- `/app` - Páginas e rotas do sistema (Dashboard, Login, Kanban, Mapas).
- `/components` - Componentes reutilizáveis de UI com design premium.
- `/lib` - Configurações de API (Firebase client, Gemini config).
- `/scripts` - Motores de scraping (Puppeteer) e scripts de carga de dados.
- `/public` - Ativos estáticos e ícones.

---

## 🛠️ Como Iniciar
1.  Instale as dependências: `npm install`
2.  Configure as variáveis de ambiente no arquivo `.env.local`:
    - `NEXT_PUBLIC_FIREBASE_...`
    - `GEMINI_API_KEY`
    - `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
3.  Inicie o servidor de desenvolvimento: `npm run dev`
4.  Para testar o robô extrator: `node scripts/run-all.mjs`

---

## 📖 Documentação Completa
Para detalhes técnicos detalhados, acesse o arquivo [DOCUMENTAÇÃO.md](./DOCUMENTAÇÃO.md).

---
*Radar de Obras PRO - Todos os direitos reservados.*
