# 🏗️ Radar de Obras PRO | Inteligência B2B na Construção Civil

![Status](https://img.shields.io/badge/Status-Em%20Produ%C3%A7%C3%A3o-success)
![Next.js](https://img.shields.io/badge/Next.js-14.x-black?logo=next.js)
![Google Gemini](https://img.shields.io/badge/Google%20Gemini-Flash_Latest-blue?logo=google)
![Firebase](https://img.shields.io/badge/Firebase-v10-yellow?logo=firebase)

O **Radar de Obras PRO** é uma plataforma de Inteligência de Mercado B2B projetada para resolver a ineficiência na prospecção de vendas da construção civil. Através de "Data Mining" e "Inteligência Artificial", o sistema coleta massivamente dados burocráticos, filtra ruídos e sinaliza automaticamente o nível de urgência comercial de novos alvarás e licenciamentos em São Paulo.

## 🚧 O Problema

Para empresas que vendem insumos (concreto, cimento, escoramento, maquinário) ou prestam serviços na construção civil corporativa, encontrar o "*Timing*" da obra é essencial. Procuradores manuais, raspadores genéricos (scrapers) e buscadores de licitações públicas geram uma avalanche de planilhas de chumbo inútil, trazendo editais que não cabem no perfil privado ou chegando atrasado quando as negociações já fecharam.

## 🚀 A Solução (A Proposta de Valor)

Ao invés de retornar apenas editais aleatórios, o ecossistema atua como um autêntico filtro inteligente de Inteligência Comercial (Sales Intelligence):

1. **Scraping Customizado:** Motores integrados rastreiam o Diário Oficial, CETESB e Aprovações Governamentais para "pescar" emissões exatas de licitações de grande escopo, focando em condomínios e loteamentos em SP.
2. **Scoring Heurístico B2B:** Algoritmo de priorização de pontuação.
   * `🔴 +50 Pontos:` Emissões de novos Alvarás (indica que a terra será escavada em poucas semanas).
   * `🔴 +50 Pontos:` Match reverso com Construtoras Alvo.
   * `🟠 +30 Pontos:` Detecção Regex de telefones e e-mails atrelados.
3. **Analisador de IA (Briefing Direto):** O usuário não precisa ler 3 páginas de um Diário Oficial denso. Com um clique em "Analisar com IA", um agente usando *Google Gemini* lê o documento e constrói um resumo ágil: *"O que é a obra, Onde é, O que vender, Vale a pena?"*

## 🛠️ Stack Tecnológica

O projeto foi construído pensando nas melhores práticas do mercado, mantendo velocidade em tempo de execução e baixo custo de operações na nuvem.

- **Front-end:** [React](https://reactjs.org/) e [Next.js (App Router)](https://nextjs.org/) rodando estático/dinâmico e provendo APIs ágeis. Hospedado globalmente na **Vercel**.
- **User Interface (UI):** [Tailwind CSS](https://tailwindcss.com/) com elementos interativos baseados em Lucide Icons. Layout focado integralmente na experiência de um *Vendedor Técnico / Engenheiro*.
- **Back-end e Banco de Dados:** [Firebase (Firestore)](https://firebase.google.com/) responsável por reter bases tratadas via NoSQL e lidar com a Autenticação (Firebase Auth).
- **Core de Inteligência:** Integração nativa SDK do `@google/generative-ai` com os modelos fundacionais de linguagem do **Google Gemini (Flash)** em `v1beta`.
- **Rastreadores Espaciais:** Scripts robustos em Vanilla Node.js injetados na malha de coleta assíncrona.

## ⚙️ Principais Funcionalidades Implementadas

- [x] Motor duplo de busca (APIs Federais + Banco de Dados Local).
- [x] Regras dinâmicas de filtragem de lixo do estado de SP por "Pesos" (Scoring Algorithm).
- [x] Painel de "Dashboard de Insights" capaz de sumarizar macrotendências com IA a partir de dezenas de leads salvos.
- [x] Fluxo de "Salvar Lead" estilo Kanban (Favoritos de Vendas).
- [x] Badges visuais imediatistas (🚩 Alvará, 🚩 Tem contato, ✨ Motivo de Recomendação).

---

> *"Transformando dados pesados perdidos em repartições públicas na listagem de ligações diárias de um vendedor."*

*Este sistema integra o portfólio focado em Engenharia de Software focada em Soluções Corporativas.*
