# ReminderONE

Persistência durável, sincronização com Android, execução e prints: [validação local-first](docs/local-first-validacao.md).

> Assistente de produtividade pessoal com IA — NLP via Gemini, transcrição de voz local (Whisper) e calendário próprio de tarefas.

---

## 🚀 Stack

| Camada | Tecnologia |
|---|---|
| **Frontend** | React 18 + Vite + TailwindCSS |
| **Backend (Sidecar)** | Python FastAPI + Uvicorn |
| **Desktop** | Tauri v2 (Rust) |
| **IA — NLP** | Gemini 2.5 Flash (proxy local) |
| **IA — Voz** | Faster-Whisper (CUDA / CPU) |
| **Criptografia** | Web Crypto API (AES-GCM + PBKDF2) |
| **Persistência** | IndexedDB (cifrada) + localStorage |
| **Calendário** | Agenda mensal e diária com as tarefas locais do app |

---

## 📋 Pré-requisitos

- **Node.js** 18+ ([download](https://nodejs.org/))
- **Python** 3.11+ ([download](https://www.python.org/downloads/))
- **Git** ([download](https://git-scm.com/))
- (Opcional) **GPU NVIDIA** com CUDA para transcrição via Whisper acelerada

---

## ⚡ Setup Rápido

### 1. Clonar o repositório

```bash
git clone https://github.com/Antoniosn4/reminderone.git
cd reminderone
```

### 2. Instalar dependências do frontend

```bash
npm install
```

### 3. Configurar o backend Python

```bash
cd server
python -m venv .venv

# Windows
.venv\Scripts\activate

# Linux/Mac
source .venv/bin/activate

pip install -r requirements.txt
```

### 4. Configurar variáveis de ambiente

```bash
# Copiar o arquivo de exemplo
cp server/.env.example server/.env
```

Edite `server/.env` e preencha:

```env
GEMINI_API_KEY=sua_chave_aqui
```

> **⚠️ Cada desenvolvedor deve criar sua própria API key gratuita em [Google AI Studio](https://aistudio.google.com/apikey)**

### Calendário próprio

O calendário usa as tarefas salvas no dispositivo e funciona sem conta externa ou conexão com a internet. A grade mensal abre a agenda de cada dia para consultar, editar, concluir e excluir tarefas. Depois de desbloquear o cofre, o app abre diretamente na tela Hoje, sem tutorial inicial. A configuração opcional da chave Gemini continua em Configurações.

---

## ▶️ Rodar o Projeto

Abra **dois terminais**:

**Terminal 1 — Backend:**
```bash
cd server
.venv\Scripts\activate        # Windows
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

**Terminal 2 — Frontend:**
```bash
npm run dev
```

Acesse: **http://localhost:5173**

---

## 📁 Estrutura do Projeto

```
reminderone/
├── src/                    # Frontend React
│   ├── components/         # Componentes de UI
│   ├── contexts/           # Context providers (AppContext)
│   ├── hooks/              # Custom hooks (useTasks, useProjects, etc.)
│   ├── services/           # Persistência cifrada e APIs (Gemini, Whisper)
│   └── utils/              # Utilitários (id, logger)
├── server/                 # Backend Python (FastAPI)
│   ├── main.py             # Entry point — proxy Gemini
│   ├── routers/            # Transcrição Whisper
│   ├── middleware/          # Rate limiting
│   └── .env.example        # Template de variáveis de ambiente
├── src-tauri/              # App desktop Tauri (Rust)
├── tests/                  # Testes automatizados (Vitest)
├── index.html              # HTML entry point
├── vite.config.js          # Configuração Vite
└── package.json            # Dependências e scripts
```

---

## 🧪 Testes

```bash
npm test                    # Rodar testes
npm run test:watch          # Modo watch
npm run test:coverage       # Com cobertura
```

---

## 🔑 Variáveis de Ambiente

| Variável | Obrigatória | Descrição |
|---|---|---|
| `GEMINI_API_KEY` | ✅ | Chave da API Gemini ([obter aqui](https://aistudio.google.com/apikey)) |
| `WHISPER_MODEL` | ❌ | Tamanho do modelo Whisper: `tiny`, `base`, `small`, `medium`, `large-v3` (default: `medium`) |
| `WHISPER_DEVICE` | ❌ | `cuda`, `cpu` ou `auto` (default: `auto`) |

---

## ⚠️ Segurança

**NUNCA commite estes arquivos:**
- `server/.env` — contém API keys
- `server/credentials.json` e `server/token.json` — credenciais legadas, se ainda existirem
- `src-tauri/.signing/` — chaves de assinatura

Todos já estão no `.gitignore`. Se precisar verificar: `git status`

---

## 📝 Licença

Projeto acadêmico — uso interno.
