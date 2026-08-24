# Roteiro de Apresentação - Reminder1 (Trabalho Prático)

Este documento serve como um guia passo a passo do que falar e mostrar durante a gravação do vídeo de apresentação do projeto.

---

## 1. Introdução e Motivação (Duração sugerida: 1 min)
**O que mostrar na tela:** Tela inicial do Reminder (Dashboard/Inbox) limpa, talvez mostrando a tela de login/vault inicial.

**O que falar:**
> "Olá a todos, este é o projeto **Reminder**, desenvolvido por [Seu Nome/Nome da Equipe]. 
> Ele é um assistente de produtividade desktop. A principal **motivação** deste projeto foi criar uma ferramenta de organização que utilizasse inteligência artificial para facilitar a entrada de tarefas, mas sem comprometer a privacidade do usuário. Diferente de soluções de mercado, nós focamos em processamento local e dados criptografados (Zero-Knowledge)."

**Objetivos específicos a mencionar:**
> "Nossos objetivos principais foram: 
> 1. Permitir a criação de tarefas via linguagem natural e comando de voz.
> 2. Manter a flexibilidade de visualização em Listas, Kanban e Calendário.
> 3. Integrar com as agendas já utilizadas pelo usuário."

---

## 2. Tipos de Integrações Utilizadas (Duração sugerida: 1 min)
**O que mostrar na tela:** Diagrama de arquitetura (se tiver) ou apenas a interface principal, alternando para o código se necessário.

**O que falar:**
> "Para atender aos requisitos do trabalho, nosso projeto foca em 3 integrações principais:
> - **Integração via API:** Consumimos a API do Google Gemini para processar texto e a API do Google Calendar para sincronizar eventos.
> - **Microarquitetura (Sidecar):** Nosso frontend (React) se integra localmente com um backend em Python (FastAPI) dedicado a processamento pesado.
> - **Baseada em Banco de Dados:** Integramos o sistema com o banco IndexedDB local para persistência de dados no desktop."

---

## 3. Demonstração dos 5 Requisitos Funcionais (Duração sugerida: 3 min)

Para cada requisito, siga o fluxo: **1. Mostre no App -> 2. Mostre no Código**.

### RF1: Processamento de Linguagem Natural (Integração API)
*   **Ação no App:** Digite no input algo como: *"Lembrar de entregar o trabalho de arquitetura amanhã as 20h com prioridade urgente"*. Mostre a tarefa sendo criada com as tags corretas.
*   **Ação no Código:** Abra `src/services/geminiService.js`.
*   **O que falar:** *"Como RF1, temos a criação de tarefas via IA. Aqui no código mostramos a integração via API com o Google Gemini. Enviamos o texto do usuário e a IA nos devolve um JSON estruturado que nosso app converte na tarefa final."*

### RF2: Transcrição de Voz Local (Microarquitetura)
*   **Ação no App:** Clique no botão de microfone e fale uma tarefa. Mostre o texto aparecendo.
*   **Ação no Código:** Abra `server/routers/whisper.py`.
*   **O que falar:** *"Como RF2, temos a transcrição de voz local. Para não enviar o áudio pra nuvem, integramos o front-end via microarquitetura a um backend FastAPI rodando localmente (sidecar). O código em Python recebe o áudio e usa o Whisper para transcrever na própria máquina do usuário."*

### RF3: Sincronização Bidirecional (Integração com Sistema Externo)
*   **Ação no App:** Mostre a tarefa no Reminder e depois mostre a mesma tarefa aparecendo no seu Google Calendar.
*   **Ação no Código:** Abra `server/routers/calendar.py` ou `src/services/calendarService.js`.
*   **O que falar:** *"O RF3 é a sincronização com o calendário. Aqui fazemos uma integração via API usando OAuth2. Sempre que uma tarefa é criada ou editada, comunicamos com a API do Google Calendar para manter as agendas espelhadas."*

### RF4: Armazenamento Criptografado (Integração com Banco de Dados)
*   **Ação no App:** Fale sobre como os dados estão salvos e o fato de pedir senha ao entrar.
*   **Ação no Código:** Abra `src/services/cryptoService.js`.
*   **O que falar:** *"O RF4 garante a privacidade. Antes de qualquer integração com nosso banco de dados (IndexedDB), os dados passam por essa camada de serviço de criptografia (AES-GCM-256). Assim, o banco de dados só armazena informações ilegíveis, garantindo a segurança Zero-Knowledge."*

### RF5: Visualização e Organização Dinâmica
*   **Ação no App:** Mostre a troca de tela (View) de Inbox (Lista) para Kanban e mova uma tarefa de coluna.
*   **Ação no Código:** Abra `src/App.jsx` ou algum componente dentro de `src/components/`.
*   **O que falar:** *"Por fim, nosso RF5 é a organização dinâmica em Views. Através da componentização do React, o usuário pode consumir os mesmos dados criptografados do banco e manipulá-los de forma reativa, seja numa visualização de lista tradicional ou arrastando cards num quadro Kanban."*

---

## 4. Encerramento (Duração sugerida: 30 seg)
**O que mostrar na tela:** Tela principal do app de volta ou a visão de "Hoje".

**O que falar:**
> "Para finalizar, o Reminder demonstra como a integração de diferentes tecnologias — desde chamadas de API externas até microserviços rodando localmente com IA — podem resultar em um produto robusto e seguro. Obrigado pela atenção!"
