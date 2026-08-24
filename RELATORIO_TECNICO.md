# RELATÓRIO TÉCNICO — REMINDER1
**Data:** 14 de maio de 2026  
**Analista:** Claude Code (claude-sonnet-4-6)  
**Status do Projeto:** v0.1.0 — Em desenvolvimento avançado

---

## SUMÁRIO EXECUTIVO

O **Reminder1** é um assistente de produtividade local para Windows, construído como aplicação desktop Tauri com frontend em React e backend Python (FastAPI) executado como processo sidecar. O projeto implementa criptografia de ponta a ponta (zero-knowledge), transcrição de voz com Whisper, integração com Google Calendar via OAuth2, e parsing de tarefas com inteligência artificial (Google Gemini).

**Resultado geral:** O projeto está em estado sólido e funcional, com práticas de segurança acima da média para um projeto solo/pequena equipe. Estimativa de ~80% pronto para uma release 0.1.0 funcional para o usuário final.

---

## 1. ESTRUTURA DO PROJETO

```
Reminder1/
├── src/                          # Frontend React (Vite)
│   ├── components/               # 40+ componentes React
│   │   ├── Sidebar/              # Navegação lateral (6 arquivos)
│   │   ├── TaskList/             # Lista de tarefas
│   │   ├── modals/               # Diálogos CRUD
│   │   ├── views/                # Telas principais (8 views)
│   │   └── vault/                # Autenticação e bloqueio
│   ├── hooks/                    # 14 hooks customizados
│   ├── services/                 # Integração API e criptografia
│   ├── utils/                    # Utilitários (IDs, logging)
│   ├── App.jsx                   # Componente raiz (631 linhas)
│   ├── main.jsx                  # Ponto de entrada
│   └── index.css                 # Tailwind + temas customizados
│
├── server/                       # Backend Python FastAPI
│   ├── main.py                   # App principal (147 linhas)
│   ├── entrypoint.py             # Ponto de entrada PyInstaller
│   ├── app_paths.py              # Resolução de caminhos cross-plataforma
│   ├── routers/
│   │   ├── calendar.py           # Google Calendar OAuth + sync (384 linhas)
│   │   └── whisper.py            # Transcrição de voz (224 linhas)
│   ├── middleware/
│   │   └── rate_limit.py         # Rate limiter sliding-window (54 linhas)
│   ├── requirements.txt          # Dependências Python (produção)
│   ├── requirements-dev.txt      # Dependências de desenvolvimento/testes
│   ├── reminder-server.spec      # Configuração PyInstaller
│   ├── .env.example              # Template de variáveis de ambiente
│   └── tests/                    # Suite pytest
│
├── src-tauri/                    # Shell Tauri (Rust)
│   ├── src/
│   │   ├── main.rs               # Setup do app + atalhos globais
│   │   ├── sidecar.rs            # Gerenciamento do processo sidecar
│   │   └── tray.rs               # Integração com bandeja do sistema
│   ├── tauri.conf.json           # Configuração Tauri
│   ├── Cargo.toml                # Dependências Rust
│   └── build.rs                  # Script de build
│
├── scripts/
│   └── build-sidecar.ps1         # Automação de build (PowerShell)
│
├── tests/                        # Testes frontend (Vitest)
│
├── .github/
│   └── workflows/
│       └── release-desktop.yml   # Pipeline CI/CD (Windows build)
│
├── package.json                  # Dependências frontend
├── vite.config.js                # Configuração Vite
├── vitest.config.js              # Configuração de testes
├── tailwind.config.js            # Tema Tailwind com variáveis CSS
└── index.html                    # HTML de entrada
```

---

## 2. STACK TECNOLÓGICO

### Frontend (React / Vite)
| Biblioteca | Versão | Função |
|---|---|---|
| React | 18.2.0 | Framework UI |
| Vite | 5.0.8 | Build tool |
| Tailwind CSS | 3.4.0 | Estilização |
| Mantine | 8.3.18 | Biblioteca de componentes |
| BlockNote | 0.50.0 | Editor de texto rico (notas) |
| Lucide React | 0.300.0 | Ícones |
| react-hot-toast | 2.6.0 | Notificações toast |
| idb | 8.0.3 | Wrapper IndexedDB |
| @hello-pangea/dnd | 18.0.1 | Drag-and-drop (Kanban) |

### Backend (Python / FastAPI)
| Biblioteca | Versão | Função |
|---|---|---|
| FastAPI | 0.111.0 | Framework API |
| Uvicorn | 0.29.0 | Servidor ASGI |
| faster-whisper | 1.2.1 | Transcrição de voz local (CPU/CUDA) |
| google-auth-oauthlib | 1.3.1 | OAuth2 Google |
| google-api-python-client | 2.194.0 | Google Calendar API |
| httpx | 0.27.0 | HTTP client async (proxy Gemini) |
| python-dotenv | 1.0.1 | Configuração via .env |

### Desktop / CI (Rust / Tauri)
| Plugin | Função |
|---|---|
| Tauri 2.x | Shell desktop cross-platform |
| tauri-plugin-shell | Gerenciamento processo sidecar |
| tauri-plugin-updater | Auto-update integrado |
| tauri-plugin-notification | Notificações nativas |
| tauri-plugin-global-shortcut | Atalhos globais (Ctrl+Alt+R) |

### Tooling
- **Vitest 4.1.5** — Testes frontend
- **Testing Library 16.3.2** — Testes de componentes React
- **PyTest** — Testes backend
- **Node 20 LTS / Python 3.11 / Rust 1.77+**

---

## 3. ARQUITETURA

### 3.1 Fluxo de Dados — Criação de Tarefa

```
Entrada do usuário (texto ou voz)
        │
        ▼ (se voz)
[useVoiceRecording] ──► transcribeAudio() ──► POST /api/whisper
        │
        ▼
[useTasks.addTaskFromText]
        │
        ▼
callGemini(prompt, TASK_PARSE_SCHEMA) ──► FastAPI /api/gemini ──► Gemini API
        │
        ▼ (fallback se offline)
buildFallbackTask()
        │
        ▼
putTask(key, task) ──► AES-GCM encrypt ──► IndexedDB (tasks_encrypted)
        │
        ▼
syncTask(task) ──► POST /api/calendar/sync ──► Google Calendar
        │
        ▼
Update task.gcalEventId + task.syncStatus
```

### 3.2 Camadas de Armazenamento

| Camada | Tecnologia | O que guarda |
|---|---|---|
| IndexedDB (criptografado) | AES-GCM-256 | Tarefas |
| localStorage (criptografado) | AES-GCM-256 | Projetos, equipes, rotinas, notas |
| Sistema de arquivos local | JSON | Credenciais Google (`%LOCALAPPDATA%\Reminder1\`) |
| RAM (não persiste) | Web Crypto API | Chave mestre de criptografia |

### 3.3 Rotas da API Backend

**Main Server (`main.py`):**
- `GET /` — Health check
- `POST /api/gemini` — Proxy para Google Gemini (com rate limit)

**Calendar Router (`/api/calendar/*`):**
- `GET /status` — Verificar autenticação Google
- `GET /auth` — Iniciar fluxo OAuth2
- `GET /callback` — Callback OAuth2 (code → token)
- `POST /disconnect` — Revogar token
- `POST /sync` — Criar/atualizar evento
- `DELETE /event/{event_id}` — Remover evento

**Whisper Router (`/api/whisper`):**
- `POST /whisper` — Transcrever áudio

---

## 4. FUNCIONALIDADES IMPLEMENTADAS

### Gestão de Tarefas ✅
- Parsing de linguagem natural (Gemini) → título, data, hora, projeto, prioridade
- Auto-classificação em projetos (Entrada, Ideias de Produto, personalizados)
- Toggle de conclusão + exclusão suave
- Sincronização bidirecional com Google Calendar
- Geração de subtarefas via Gemini
- Filtragem por view (hoje, projeto, subprojeto)
- Modal de calendário com seletor de dias
- Badges de prioridade (urgente/alto/normal/baixo)
- @-menções de membros de equipe

### Funcionalidades de Voz ✅
- Gravação via WebAudio API (com beep de início)
- Display de tempo em tempo real
- Botão de cancelamento
- Transcrição Whisper (local, acelerada por GPU)
- Criação automática de tarefa a partir do texto transcrito
- Rate limiting (10 req/min)

### Views de Produtividade ✅
- **Hoje** — Lista inbox com seções pendentes/concluídas
- **Calendário** — Grade mensal, click para ver/editar dia
- **Prioridades** — Buckets (Urgente/Alto/Normal/Baixo)
- **Histórico** — Tarefas concluídas com datas
- **Notas** — Editor de texto rico (BlockNote) criptografado
- **Kanban** — Colunas drag-drop com estados customizados
- **Relatório Semanal** — Modal com estatísticas

### Organização ✅
- **Projetos** — Lista dinâmica com cores e subprojetos
- **Equipes** — Grupos com @-menções de membros
- **Rotinas** — Tarefas recorrentes com agendamento e notificações locais
- **Sidebar** — Árvore de navegação

### Segurança e Privacidade ✅
- **Vault PIN/senha** — Senha mestre no lançamento
- **Criptografia AES-GCM-256** — Todos os dados em repouso
- **Backoff exponencial** — Proteção contra força bruta
- **Zero-knowledge** — Servidor nunca vê texto simples
- **Local-first** — Todo processamento no dispositivo
- **Desconectar Google** — Revogar OAuth a qualquer momento

### Funcionalidades Avançadas ✅
- **Troca de temas** — Escuro/Azul/Claro (CSS custom properties)
- **Atalhos globais** — Ctrl+N, Ctrl+K, Ctrl+L, Ctrl+,
- **Modal de busca** — Busca em texto completo
- **Quick add modal** — Entrada rápida minimal
- **Auto-lock** — Timeout configurável (5m/15m/30m/1h/nunca)
- **Sincronização auto** — Tarefas sincronizam ao criar/editar
- **Error boundary** — Recuperação de crashes de componentes

---

## 5. ANÁLISE DE SEGURANÇA

### 5.1 Pontos Fortes (Boas Práticas)

✅ **PBKDF2-SHA256 com 600.000 iterações** — Padrão OWASP 2023. Excelente.  
✅ **AES-GCM-256** — Autenticado, detecta adulteração.  
✅ **IV único por operação** — 12 bytes aleatórios por encrypt, sem reutilização.  
✅ **Chave apenas em RAM** — Nunca persiste em disco.  
✅ **Salt aleatório (16 bytes)** — Persiste só o salt, não a chave.  
✅ **Backoff exponencial** — Proteção eficaz contra brute-force do cofre.  
✅ **CORS explícito** — Sem wildcard; origens configuráveis via env var.  
✅ **Bind em 127.0.0.1** — API nunca exposta na rede local.  
✅ **PKCE no OAuth2** — State + code_verifier com TTL de 5 min.  
✅ **Chave Gemini no header** — Nunca em URL (não aparece em logs).  
✅ **Rate limiting** — Sliding window determinístico sem dependência externa.  
✅ **CSP no Tauri** — Content Security Policy configurada.

### 5.2 Problemas de Segurança Encontrados

#### [MÉDIO] Salt do vault no localStorage em texto simples
- **Onde:** `src/services/cryptoService.js`
- **Problema:** O salt de derivação de chave fica em localStorage sem criptografia.
- **Impacto:** Se alguém exportar o localStorage, terá o salt. Mas isso sozinho não quebra a criptografia — ainda precisa da senha.
- **Mitigação aceitável:** Por design, é necessário persistir o salt. Sem ele, não há como re-derivar a chave em re-aberturas.
- **Recomendação:** Documentar isso como decisão de design consciente.

#### [MÉDIO] Sem reset de senha
- **Onde:** Fluxo de autenticação do vault
- **Problema:** Se o usuário esquecer a senha, todos os dados são irrecuperáveis.
- **Impacto:** Perda total de dados para o usuário final.
- **Recomendação:** Exibir aviso claro no onboarding de que não há recuperação. Opcionalmente, implementar exportação de chave protegida.

#### [BAIXO] token.json do Google em texto simples
- **Onde:** `%LOCALAPPDATA%\Reminder1\token.json`
- **Problema:** Token de acesso ao Google Calendar salvo em disco sem criptografia adicional.
- **Impacto:** Acesso físico ao computador pode usar o token até expirar.
- **Recomendação:** Criptografar com a chave do vault. Mas isso impede sync em background (trade-off).

#### [BAIXO] Sem validação de codec de áudio no Whisper
- **Onde:** `server/routers/whisper.py`
- **Problema:** Endpoint aceita qualquer blob de áudio sem validar MIME type ou tamanho máximo.
- **Recomendação:** Validar `content-type` e tamanho antes de tentar transcrever.

#### [BAIXO] Estado global de OAuth em memória
- **Onde:** `server/routers/calendar.py`
- **Problema:** Dicionário `_pending_flows` em memória — se o servidor reiniciar durante o fluxo OAuth, o state é perdido.
- **Impacto:** Usuário pode precisar tentar novamente. Não é um risco de segurança.
- **Recomendação:** Aceitável para v0.1.0.

#### [BAIXO] Sem proteção CSRF explícita
- **Contexto:** Não aplicável — binding em 127.0.0.1 protege contra CSRF por padrão (origem cruzada não pode fazer POST para localhost com credenciais em browsers modernos).

### 5.3 Matriz de Risco

| Problema | Severidade | Exploitabilidade | Prioridade de Fix |
|---|---|---|---|
| Sem reset de senha | Médio | N/A (UX, não segurança) | Alta |
| Salt em texto simples | Médio | Muito baixa | Baixa |
| token.json sem encrypt | Baixo | Requer acesso físico | Média |
| Sem validação codec áudio | Baixo | Baixa | Média |
| Estado OAuth em memória | Baixo | Não explorável | Baixa |

---

## 6. QUALIDADE DO CÓDIGO

### 6.1 Frontend

**Boas Práticas Seguidas:**
- ✅ Componentes funcionais com hooks (sem class components)
- ✅ `useCallback` com arrays de dependências corretos
- ✅ Separação clara: hooks = lógica, componentes = UI
- ✅ Error boundaries para recuperação de crashes
- ✅ Logger centralizado (não usa `console.log` direto)
- ✅ Serviços isolados em `src/services/`
- ✅ Criptografia encapsulada em `cryptoService.js`
- ✅ IDs únicos com utilitário dedicado

**Problemas de Qualidade:**

**[ALTO] App.jsx monolítico (631 linhas)**
- Componente raiz com lógica demais.
- Mistura de estado global, roteamento e renderização.
- Dificulta testes e manutenção.
- *Sugestão:* Extrair gerenciamento de estado para contexto separado; usar React Router ou estado de navegação customizado.

**[MÉDIO] Sem TypeScript**
- Todo o projeto é JavaScript puro.
- Em 40+ componentes e 14 hooks, a falta de tipos aumenta risco de bugs silenciosos.
- *Sugestão:* Migração gradual para `.tsx` / `.ts` usando `allowJs: true` no tsconfig.

**[MÉDIO] Cobertura de testes baixa**
- Apenas 7 arquivos de teste identificados.
- Não há testes de integração (fluxo completo: input → encrypt → IndexedDB → sync).
- Componentes UI não testados.
- *Sugestão:* Adicionar testes para hooks críticos (`useTasks`, `useVoiceRecording`) e para o fluxo de criptografia.

**[MÉDIO] Prop drilling em alguns lugares**
- VaultContext funciona bem, mas outros estados são passados manualmente.
- *Sugestão:* Considerar Zustand ou Jotai para estado global mais complexo.

**[BAIXO] Sem detecção de feature para MediaRecorder**
- Gravação de voz falha silenciosamente em contextos sem suporte.
- *Sugestão:* Checar `navigator.mediaDevices` antes de exibir o botão de voz.

**[BAIXO] Sem confirmação antes de exclusões destrutivas**
- Deletar projeto/equipe/rotina ocorre sem "Tem certeza?"
- *Sugestão:* Adicionar modal de confirmação com nome do item a ser deletado.

### 6.2 Backend

**Boas Práticas Seguidas:**
- ✅ Routers modulares (calendar.py, whisper.py)
- ✅ Type hints e Pydantic schemas
- ✅ Logs estruturados com contexto
- ✅ `app_paths.py` para portabilidade cross-platform
- ✅ Carregamento lazy do modelo Whisper (não bloqueia inicialização)
- ✅ Rate limiter thread-safe e determinístico

**Problemas de Qualidade:**

**[MÉDIO] Sem testes de backend**
- `server/tests/` existe mas cobertura é mínima.
- Rotas críticas (OAuth, sync de calendário, Whisper) não testadas.
- *Sugestão:* Mockar a API do Google e testar o fluxo OAuth completo.

**[MÉDIO] Timezone hardcoded para São Paulo**
- `REMINDER_LOCAL_TZ` padrão é America/Sao_Paulo no código.
- Usuários em outros fusos horários terão problemas com horários de tarefas.
- *Sugestão:* Detectar timezone do sistema ou permitir configuração na UI.

**[BAIXO] Sem limite de tamanho no upload de áudio**
- Endpoint Whisper não rejeita arquivos grandes.
- *Sugestão:* Adicionar `max_size` no FastAPI para o endpoint.

**[BAIXO] Mensagens de erro genéricas nos 500s**
- Alguns erros internos retornam apenas `{"detail": "Internal server error"}`.
- *Sugestão:* Log detalhado no servidor + mensagem amigável pro cliente.

### 6.3 Rust/Tauri

**Boas Práticas Seguidas:**
- ✅ Sidecar gerenciado com lifecycle correto
- ✅ System tray integrado
- ✅ Auto-update configurado
- ✅ CSP policy no `tauri.conf.json`

**Sem problemas críticos identificados no código Tauri.**

---

## 7. BUGS IDENTIFICADOS

### Críticos (bloqueiam uso)
*Nenhum identificado.* O código está em estado funcional.

### Altos (devem ser corrigidos antes de release)

**[BUG-01] Sem feedback visual durante carregamento do modelo Whisper**
- **Onde:** `src/services/whisperService.js` + `server/routers/whisper.py`
- **Descrição:** O primeiro uso de transcrição de voz leva 3–5 segundos para o modelo Whisper carregar, mas a UI não mostra loading state adequado.
- **Impacto:** Usuário acha que travou.
- **Fix:** Mostrar spinner com texto "Carregando modelo de voz..." na primeira transcrição.

**[BUG-02] TTL do OAuth pode expirar durante autenticação lenta**
- **Onde:** `server/routers/calendar.py`
- **Descrição:** O fluxo OAuth tem TTL de 5 minutos no estado. Se o usuário demorar no browser do Google (ex: múltiplas contas), o state expira.
- **Impacto:** Erro de "state inválido" ao retornar para o app.
- **Fix:** Aumentar TTL para 10–15 minutos ou mostrar erro amigável com botão "Tentar novamente".

### Médios (deveriam ser corrigidos em breve)

**[BUG-03] Exclusão sem confirmação**
- **Onde:** Todos os modais de CRUD (`ProjectModals.jsx`, `TeamModals.jsx`, `RoutineModals.jsx`)
- **Descrição:** Ação de deletar executa imediatamente sem confirmação.
- **Fix:** Adicionar `window.confirm()` ou modal de confirmação custom.

**[BUG-04] Header `Retry-After` ausente em algumas respostas 429**
- **Onde:** `server/middleware/rate_limit.py`
- **Descrição:** Endpoint Whisper não inclui `Retry-After` nas respostas de rate limit.
- **Fix:** Incluir `Retry-After` consistentemente em todos os 429.

**[BUG-05] Sem suporte a `MediaRecorder` verificado antes de exibir UI de voz**
- **Onde:** `src/components/SmartInput.jsx` (ou similar)
- **Descrição:** O botão de microfone é exibido mesmo em contextos onde `MediaRecorder` não está disponível.
- **Fix:** `if (!navigator.mediaDevices?.getUserMedia) { hideVoiceButton(); }`

### Baixos (polimento)

**[BUG-06] Tema não persiste entre sessões em alguns casos edge**
- **Onde:** `src/hooks/useTheme.js`
- **Descrição:** Troca de tema pode não persistir se vault não foi desbloqueado ainda.
- **Fix:** Verificar se tema pode ser salvo fora do vault (não é dado sensível).

**[BUG-07] Tarefas de rotinas não têm desfazer**
- **Onde:** `src/hooks/useRoutines.js`
- **Descrição:** Completar uma tarefa de rotina é irreversível.
- **Fix:** Implementar soft-delete com toast "Desfazer" por 5 segundos (padrão Gmail).

---

## 8. FUNCIONALIDADES INCOMPLETAS OU AUSENTES

### Não Implementado (mas UI existe)

**[INCOMPLETO-01] Colaboração de equipes em tempo real**
- A UI de equipes existe e permite criar grupos e mencionar membros.
- Mas não há sincronização real entre dispositivos — os dados são locais.
- *Nível de esforço para completar:* Alto (requer backend remoto ou P2P sync).

**[INCOMPLETO-02] Exportação/Importação de dados**
- Não há como exportar tarefas para CSV, JSON ou outro formato.
- Não há como importar dados de outros apps (Todoist, Notion, etc.).
- *Nível de esforço:* Médio.

**[INCOMPLETO-03] Padrões de recorrência avançados nas Rotinas**
- Rotinas existem mas os padrões de agendamento são limitados.
- Faltam opções tipo "segunda e quarta-feira", "último dia do mês", etc.
- *Nível de esforço:* Médio.

**[INCOMPLETO-04] Notificações persistentes**
- Notificações de rotina usam a API do browser — são descartadas se o app não está rodando.
- *Nível de esforço:* Médio (Tauri tem plugin de notificação nativa que pode resolver).

**[INCOMPLETO-05] Sync de notas com serviços externos**
- Notas são locais apenas. Não há integração com Google Keep, Notion, Obsidian.
- *Nível de esforço:* Alto (requer integração por serviço).

### Ausente (sem plano visível)

- **Busca avançada** — Filtros por data, projeto, prioridade simultaneamente
- **Subtarefas com progress visual** — Geração existe mas exibição é simples
- **Drag-and-drop entre projetos** — Kanban interno mas sem mover entre views
- **Atalho global para Windows** — Ctrl+Alt+R existe, mas não configurable pelo usuário
- **Integração com Outlook Calendar** — Só Google Calendar implementado
- **Modo offline robusto** — App funciona offline mas sem indicador de estado de sync
- **Analytics de produtividade** — Sem gráficos de tendência, streaks, etc.
- **Multi-idioma (i18n)** — Interface em português fixo

---

## 9. AVALIAÇÃO DE PROXIMIDADE AO EXECUTÁVEL FUNCIONAL

### Critérios Avaliados

| Critério | Status | Observação |
|---|---|---|
| Build frontend (npm run build) | ✅ Funcional | Vite compila sem erros |
| Build backend (PyInstaller) | ✅ Configurado | Script `build-sidecar.ps1` existe |
| Build desktop (tauri build) | ✅ Configurado | Gera MSI + NSIS |
| Pipeline CI/CD | ✅ Completa | GitHub Actions (`release-desktop.yml`) |
| Auto-update | ✅ Configurado | Plugin Tauri updater ativo |
| System tray | ✅ Funcional | Com ícone e menu contextual |
| Atalho global | ✅ Funcional | Ctrl+Alt+R toggle |
| Instalador Windows | ✅ Configurado | MSI + NSIS |
| Funcionalidades core | ✅ Completas | Tasks, voz, calendar, notas |
| Segurança | ✅ Robusta | AES-GCM, PBKDF2, rate limit |

### O que falta para o executável do usuário final

**Dependências externas que o usuário precisará configurar:**
1. **GEMINI_API_KEY** — Chave da API do Google Gemini (gratuita com limites). Precisa ser embutida no instalador ou configurada via UI.
2. **credentials.json** — Credenciais OAuth do Google Cloud para Calendar. Requer projeto no Google Cloud Console.
3. **Primeiro lançamento** — Usuário precisa configurar senha do vault.

**O maior bloqueio para distribuição pública:** A necessidade de credentials.json do Google é um bloqueio de UX severo. Usuários comuns não sabem criar um projeto no Google Cloud. Isso precisa ser resolvido antes de uma release pública.

### Estimativa de Progresso

```
[============================>    ] 80% pronto para release 0.1.0

Completo:
  ✅ Core features (100%)
  ✅ Segurança e criptografia (100%)
  ✅ Build automation (100%)
  ✅ Instalador Windows (100%)
  ✅ Sistema de voz (100%)
  ✅ Google Calendar sync (90%)

Pendente para release pública:
  ⚠️  Onboarding do usuário (0%) — crítico
  ⚠️  Configuração de API keys via UI (0%) — crítico
  ⚠️  Testes de backend (20%)
  ⚠️  Feedback visual de loading states (40%)
  ⚠️  Confirmações destrutivas (0%)
```

---

## 10. IDEIAS DE MELHORIA

### Curto Prazo (Quick Wins — 1–2 semanas)

**1. Onboarding wizard**
- Tela de configuração inicial guiada: senha do vault → chave Gemini → conectar Google.
- Sem isso, o usuário não sabe por onde começar.

**2. API key configurável pela UI**
- Adicionar campo "Gemini API Key" nas configurações.
- Salvar criptografado no vault (chave API é dado sensível).
- Elimina necessidade de `.env` manual.

**3. Feedback de loading no Whisper**
- Spinner na primeira transcrição com texto explicativo.
- Já que o modelo precisa carregar, seja transparente.

**4. Confirmações antes de deletar**
- Modal simples: "Deletar projeto 'X'? Esta ação não pode ser desfeita."
- 30 minutos de trabalho, alto impacto em UX.

**5. Indicador de status de sync**
- Ícone pequeno ao lado de cada tarefa: sincronizado ✓ / pendente ⟳ / erro ✗
- Usuário fica sem saber se a tarefa foi para o Google Calendar.

### Médio Prazo (2–4 semanas)

**6. Migração gradual para TypeScript**
- Começar pelos serviços críticos: `cryptoService.ts`, `calendarService.ts`.
- `allowJs: true` no tsconfig para migração não-destrutiva.

**7. Refatorar App.jsx**
- Extrair estado global para Context ou Zustand.
- Separar em componentes: `<AppShell>`, `<MainView>`, `<AppProviders>`.
- Meta: App.jsx com menos de 100 linhas.

**8. Testes de integração do backend**
- Mockar Google Calendar API e testar o fluxo OAuth completo.
- Testar rate limiting sob carga.
- Testar Whisper com arquivos de áudio reais.

**9. Timezone configurável**
- Campo na UI de Configurações: "Meu fuso horário".
- Enviar para o servidor como header ou parâmetro.
- Eliminar o hardcode de São Paulo.

**10. Exportação de dados (LGPD/GDPR compliance)**
- Botão "Exportar meus dados" nas configurações.
- Gera JSON/ZIP com todas as tarefas descriptografadas.
- Importante para conformidade e confiança do usuário.

### Longo Prazo (1–3 meses)

**11. Modelo de API key própria para o Google Calendar**
- Criar um flow OAuth mais amigável onde o Reminder1 tem um Client ID registrado.
- Usuário conecta Google sem precisar de credentials.json próprio.
- Requer registro de app no Google Cloud Console (uma vez, não por usuário).

**12. Sync P2P para colaboração**
- Usar CRDT (Conflict-free Replicated Data Types) para sync offline-first.
- Bibliotecas como Yjs ou Automerge.
- Permitiria colaboração real em equipes sem servidor central.

**13. Plugin system para integrações**
- Arquitetura de plugins para adicionar: Outlook, Jira, Linear, GitHub Issues.
- API interna que plugins consomem.

**14. Motor de IA local**
- Usar Ollama com modelos locais (Llama 3, Mistral) como fallback para Gemini.
- Benefício: funciona 100% offline, sem custo de API.

**15. Analytics de produtividade**
- Dashboard semanal/mensal: tarefas criadas vs concluídas, tempo médio de conclusão.
- Heatmap de atividade (estilo GitHub contributions).
- Totalmente local, sem telemetria externa.

---

## 11. CONFORMIDADE COM BOAS PRÁTICAS

### Seguidas ✅
- [x] Componentes pequenos com responsabilidade única (maioria)
- [x] Hooks customizados para lógica de negócio
- [x] Separação de concerns (services, hooks, components)
- [x] Tratamento de erros com Error Boundary
- [x] Variáveis de ambiente para configuração sensível
- [x] Sem secrets hardcoded no código
- [x] CORS configurável, não wildcard
- [x] Rate limiting em endpoints públicos
- [x] Criptografia com padrões OWASP
- [x] CSP configurada no Tauri
- [x] Logging centralizado
- [x] Lazy loading de recursos pesados (Whisper)
- [x] Auto-update para usuários finais
- [x] CI/CD automatizado

### Não Seguidas ⚠️
- [ ] TypeScript (sem tipagem estática)
- [ ] Testes de backend (cobertura mínima)
- [ ] Componente raiz muito grande (App.jsx 631 linhas)
- [ ] Confirmações antes de ações destrutivas
- [ ] Documentação de API (sem OpenAPI docs customizados)
- [ ] Semantic versioning explícito nos CHANGELOGs
- [ ] Gestão de estado global formal (sem Redux/Zustand/Jotai)

---

## 12. CONCLUSÃO

O Reminder1 é um projeto tecnicamente impressionante para sua escala. A pilha tecnológica é moderna e adequada, a segurança é robusta com práticas acima da média, e o conjunto de funcionalidades é completo para um v0.1.0.

**Pontos fortes:**
- Criptografia zero-knowledge bem implementada
- Pipeline de build e CI/CD funcionando
- Integração de IA (Gemini + Whisper) bem arquitetada
- Design de API limpo e modular

**Bloqueios para release pública:**
1. **Onboarding do usuário** — Sem um wizard de configuração, a maioria dos usuários não conseguirá configurar o app.
2. **API keys pela UI** — Exigir que o usuário edite `.env` não é aceitável para usuário final.
3. **credentials.json do Google** — Este é o maior obstáculo UX. Requer criar projeto no Google Cloud.

**Estimativa de esforço para release 0.1.0 pública:**
- 1 semana para onboarding wizard + configuração de API key via UI
- 3–5 dias para feedback de loading, confirmações, e polimento UX
- 2–3 dias para testes e ajustes de CI/CD

**Total estimado: 2–3 semanas de trabalho focado** para uma release que um usuário leigo consegue usar sem orientação técnica.

---

*Relatório gerado em 14/05/2026 por análise automatizada de 60+ arquivos, 40+ componentes React, 7 rotas backend, configurações Tauri/Rust, e pipeline CI/CD.*
