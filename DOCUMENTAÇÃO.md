# 🏗️ Radar de Obras PRO
> Inteligência Artificial e Automação para Prospecção de Obras em São Paulo.

O **Radar de Obras PRO** é uma plataforma full-stack de alta performance projetada para empresas que buscam antecipar oportunidades no mercado de construção civil. O sistema automatiza o monitoramento de diários oficiais e licenças ambientais, transformando textos jurídicos complexos em leads comerciais estruturados.

---

## 🚀 Como o Projeto Funciona (Workflow)

O fluxo de operação do Radar de Obras PRO é dividido em quatro etapas principais:

1.  **Captura (Scraping):** Robôs inteligentes (Puppeteer) monitoram fontes governamentais como a CETESB e o Diário Oficial do Estado de São Paulo (DOE-SP) em busca de novas licenças e editais.
2.  **Processamento (IA com Gemini):** O texto bruto capturado é processado pelo **Google Gemini 1.5/2.0 Flash**. A IA "lê" a nota técnica e extrai cirurgicamente: nome do empreendimento, construtora responsável, localização e estágio da obra.
3.  **Inteligência de Dados:** O sistema aplica regras de limpeza e anti-duplicação, garantindo que o banco de dados contenha apenas leads inéditos e qualificados.
4.  **Gestão (Dashboard):** Os dados são exibidos em um painel interativo em tempo real, onde o usuário pode visualizar as obras em um mapa e gerenciar o funil de vendas em um quadro Kanban.

---

## 🛠️ Stack Tecnológica

O projeto utiliza o que há de mais moderno no ecossistema de desenvolvimento voltado para escalabilidade e UX:

*   **Frontend:** Next.js 16 (App Router) & React 19.
*   **Estilização:** Tailwind CSS 4 (Design System customizado e premium).
*   **Backend & DB:** Firebase (Firestore para banco de dados e Authentication para acesso seguro).
*   **IA:** Google Generative AI (Gemini SDK).
*   **Automação:** Puppeteer & Node.js para os scrapers headless.
*   **Interatividade:**
    *   **Google Maps API:** Visualização georreferenciada dos leads.
    *   **DND Kit:** Interface de arrastar e soltar para o CRM Kanban.
    *   **Lucide React:** Iconografia moderna.

---

## ✨ Funcionalidades Principais

*   **🕵️ Monitoramento Automatizado:** Scrapers que buscam licenças da CETESB e publicações no DOE.
*   **🧠 Mineração de Dados com IA:** Extração automática de dados estruturados (JSON) a partir de descrições textuais caóticas.
*   **📋 CRM Kanban Inteligente:** Gerenciamento de leads através de colunas (Lead Novo, Em Negociação, Proposta Enviada, Ganho/Perdido).
*   **📍 Mapa de Obras:** Integração com Google Maps para visualizar a densidade de obras por região.
*   **⚡ Real-time Updates:** Sincronização instantânea entre o banco de dados Firestore e a interface do usuário.
*   **🛡️ Regras Anti-Duplicidade:** Lógica que evita que o mesmo processo de licenciamento gere múltiplos leads repetidos.
*   **📱 Design Responsivo:** Interface premium otimizada para desktops e tablets.

---

## 📐 Design e Arquitetura

O projeto foi projetado seguindo princípios de **Clean Architecture** e **Resiliência de Sistema**:

*   **Maestro de Scrapers (`scripts/run-all.mjs`):** Um orquestrador central que executa múltiplos motores de busca (CETESB, DOE-SP, Prefeitura SP) de forma sequencial.
*   **Isolamento de Processos:** Os scrapers rodam como **Child Processes**, garantindo que se um robô travar por falha no site de origem ou falta de memória, a orquestração continue e os outros robôes não sejam afetados.
*   **Camada de Serviços:** Centralizada na pasta `/lib`, isolando a lógica do Firebase e da API do Gemini.
*   **Componentização:** UI baseada em micro-componentes reutilizáveis em `/components`.
*   **Segurança:** Variáveis de ambiente sensíveis (API Keys) protegidas e acessadas apenas via Server Side ou expostas controladamente (prefixo `NEXT_PUBLIC_`).

---

## 📈 Capacidades de Expansão

O Radar de Obras PRO foi construído para ser escalável:
- **Novas Fontes:** Fácil adição de novos scrapers para portais de outras cidades ou estados.
- **Integração CRM:** Exportação automática via Webhook para CRMs externos (Pipedrive, Salesforce).
- **Notificações:** Sistema de alertas via WhatsApp/Email para novos leads de alta relevância.

---

*Documento gerado em 05/04/2026 para fins de registro técnico do projeto.*
