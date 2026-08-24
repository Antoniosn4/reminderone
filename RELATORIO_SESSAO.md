# Relatório Técnico de Sessão — Reminder1

**Data:** 15/05/2026  
**Sessão:** Diagnóstico, correções e refatoração da pipeline de voz e autenticação

---

## 1. Problema: Login Google carregando infinito

### Sintoma
Ao clicar em "Entrar" (AccountButton) ou "Conectar Google Calendar" (OnboardingWizard), o app ficava em estado de loading por até 5 minutos sem abrir nenhuma aba do navegador.

### Causa raiz
Três bugs encadeados:

**Bug 1 — `Loader2` não importado em `OnboardingWizard.jsx`**  
O componente usava `<Loader2>` na linha 282 mas não o importava do `lucide-react`. Em produção (modo Tauri), isso causava falha silenciosa na renderização do spinner.

**Bug 2 — `connectCalendar()` não verificava `response.ok`**  
```js
// Antes (swallowa qualquer erro HTTP)
await fetch(apiUrl(`${BASE_PATH}/auth`));

// Depois (retorna { ok, reason })
const res = await fetch(apiUrl(`${BASE_PATH}/auth`));
if (!res.ok) return { ok: false, reason: err.detail };
return { ok: true };
```
Quando o backend retornava HTTP 500 (ex: `credentials.json` ausente), o frontend ignorava o erro e seguia em polling.

**Bug 3 — `AccountButton` ficava 5 minutos em loading após falha**  
```js
// Antes
const handleConnect = async () => {
    setIsConnecting(true);
    await connectCalendar(); // erro ignorado
    // timeout de 5min para limpar isConnecting
};

// Depois
const handleConnect = async () => {
    setIsConnecting(true);
    const result = await connectCalendar();
    if (!result.ok) {
        setConnectError(result.reason); // mostra erro imediatamente
        setIsConnecting(false);         // para o loading
    }
};
```

### Arquivos alterados
- `src/services/calendarService.js` — `connectCalendar()` retorna `{ ok, reason }`
- `src/components/AccountButton.jsx` — verifica resultado, exibe erro em toast vermelho, para loading imediatamente
- `src/components/onboarding/OnboardingWizard.jsx` — adiciona `Loader2` e `AlertTriangle` ao import, adiciona estado `connectError`, exibe mensagem de erro no wizard

---

## 2. Problema: `credentials.json` exigia configuração manual pós-instalação

### Sintoma
Após instalar o app, o usuário precisava manualmente criar credenciais OAuth no Google Cloud Console e copiar o JSON para `%LOCALAPPDATA%\Reminder1\credentials.json`.

### Causa raiz
O arquivo `credentials.json` existia em `server/` mas não era empacotado no binário PyInstaller. O `tauri.conf.json` também tinha `"resources": []` vazio.

### Solução
Adicionado ao `reminder-server.spec`:
```python
datas=[
    ("credentials.json", "."),  # embutido em _MEIPASS no runtime
],
```
O `app_paths.py` já verificava `resource_dir() / "credentials.json"` onde `resource_dir()` retorna `sys._MEIPASS` quando frozen — o arquivo é encontrado automaticamente sem nenhuma ação do usuário.

### Arquivos alterados
- `server/reminder-server.spec` — `datas` inclui `credentials.json`

### Fluxo após a correção
```
Antes: instalar → copiar credentials.json manualmente → abrir app → conectar Google
Depois: instalar → abrir app → clicar "Conectar Google Calendar" → autorizar no browser → pronto
```

---

## 3. Problema: Erro ao buildar (`Access is denied`)

### Sintoma
```
error: failed to remove file `...\reminder1.exe`
Caused by: Access is denied. (os error 5)
```

### Causa raiz
Havia 3 instâncias do `reminder1.exe` rodando em segundo plano (o app minimizado no tray do Windows). O Rust não conseguia sobrescrever o executável em uso.

### Solução
```powershell
Stop-Process -Name reminder1 -Force -ErrorAction SilentlyContinue
```
Em builds futuros, sempre fechar o app pelo tray antes de buildar, ou usar o script:
```powershell
# build-all.ps1
Stop-Process -Name reminder1 -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
.\scripts\build-sidecar.ps1
Start-Sleep -Seconds 5   # aguarda Defender liberar o novo .exe
npm run tauri build
```

---

## 4. Problema: "Falha na transcrição. Verifique se o servidor está rodando."

### Sintoma
Mesmo com chave Gemini configurada e Google Calendar conectado, a transcrição de voz sempre falhava com a mensagem acima.

### Diagnóstico completo

#### Por que o erro aparecia
A mensagem é disparada quando `transcribeAudio()` retorna `null`, o que ocorre quando:
- O `fetch` para `/api/whisper` lança exceção (connection refused)
- OU o servidor retorna status não-2xx

#### Cadeia de falha identificada

```
Usuário clica ✔ → blob de áudio → POST http://127.0.0.1:8000/api/whisper
                                              ↓
                                   sidecar reminder-server.exe tenta
                                   carregar modelo "medium" (~1,5 GB)
                                   do HuggingFace na PRIMEIRA chamada
                                              ↓
                            Download falha / demora / CUDA crash
                                              ↓
                                   HTTPException 500 → null → toast
```

#### Causa raiz 1 — Modelo Whisper não está no disco (mais provável)
`faster-whisper` baixa o modelo do HuggingFace **na primeira chamada ao endpoint**, não na instalação. O modelo `medium` tem ~1,5 GB. Em produção não há console, então o download falha silenciosamente. O PyInstaller empacota a biblioteca `faster_whisper` mas **não os pesos do modelo**.

Cache esperado pelo runtime: `~/.cache/huggingface/hub/models--guillaumekln--faster-whisper-medium/`  
Se esse diretório não existir na máquina do usuário → falha imediata.

#### Causa raiz 2 — CUDA/ctranslate2 DLL incompatível
`faster-whisper` depende de `ctranslate2`, que carrega DLLs CUDA dinamicamente ao ser extraído para `_MEIPASS`. O Windows Defender frequentemente bloqueia ou atrasa esses DLLs por alguns segundos a minutos após a primeira extração, causando crash silencioso do sidecar.

#### Causa raiz 3 — Sidecar não inicia e frontend não detecta
O `sidecar.rs` faz `spawn()` do processo mas não há health-check de disponibilidade. Se o sidecar morrer imediatamente após o spawn, o frontend não sabe — continua tentando chamar `http://127.0.0.1:8000` que retorna connection refused. A única mensagem que o usuário vê é a genérica "Verifique se o servidor está rodando".

#### Causa raiz 4 — `whisperService.js` sem timeout
```js
// Antes: fetch sem timeout — pode bloquear indefinidamente
const response = await fetch(apiUrl(WHISPER_PATH), { method: "POST", body: formData });
```
Durante o download do modelo (~1,5 GB) a request ficava suspensa sem retorno visível ao usuário.

#### Por que a mensagem era enganosa
"Verifique se o servidor está rodando" não distinguia entre:

| Situação real | Mensagem exibida |
|---------------|-----------------|
| Sidecar morto (connection refused) | "Verifique se o servidor está rodando" |
| Modelo não baixado (HTTP 500) | "Verifique se o servidor está rodando" |
| CUDA crash no ctranslate2 | "Verifique se o servidor está rodando" |
| Áudio vazio (HTTP 400) | "Verifique se o servidor está rodando" |

### Solução implementada: Web Speech API como mecanismo primário

#### Comparação de arquiteturas

**Antes:**
```
mic → MediaRecorder → blob de áudio
    → POST /api/whisper (sidecar Python)
    → faster-whisper carrega modelo do disco (~1,5 GB, HuggingFace)
    → texto (3-30s de espera)
```

**Depois:**
```
mic → Web Speech API (nativa do Chromium/WebView2)
    → reconhecimento em tempo real via servidores Google
    → texto aparece enquanto o usuário fala (< 1s)
```

#### Vantagens da Web Speech API
| Critério | Whisper local | Web Speech API |
|----------|--------------|----------------|
| Download de modelo | ~1,5 GB | Nenhum |
| API key necessária | Não | Não |
| Configuração | Nenhuma | Nenhuma |
| Funciona offline | Sim | Não |
| Velocidade | 3-30s | Tempo real |
| Acurácia em pt-BR | Alta | Alta |
| Depende do sidecar | Sim | Não |

#### Lógica de seleção automática
```js
const SpeechRecognitionAPI =
    window.SpeechRecognition || window.webkitSpeechRecognition;

if (SpeechRecognitionAPI) {
    // Usa Web Speech API (Tauri WebView2 = sempre disponível)
    recognition.lang = "pt-BR";
    recognition.continuous = true;
    recognition.interimResults = true; // texto aparece em tempo real
} else {
    // Fallback: MediaRecorder + sidecar Whisper (comportamento anterior)
}
```

#### Nova UX
- Clica no mic → o texto aparece **em tempo real** conforme o usuário fala
- Clica "Confirmar" → submete o texto reconhecido
- Clica "Cancelar" → descarta tudo
- Indicador muda de "Gravando…" para "Ouvindo… fale agora"
- Waveform de áudio continua funcionando (stream de mic solicitada em paralelo)

#### Único requisito
Conexão com internet (o WebView2 usa internamente os mesmos servidores que o Chrome usa para ditado — completamente gratuito, sem API key).

### Arquivos alterados
- `src/hooks/useVoiceRecording.js` — reescrito com Web Speech API como primário e Whisper como fallback
- `src/components/SmartInput.jsx` — detecção de `SpeechRecognition`, label "Ouvindo…" vs "Gravando…", botão "Confirmar" vs "Finalizar"

---

## 5. Segurança da chave Gemini API

### Análise: SEGURA ✅

| Aspecto | Implementação |
|---------|--------------|
| Armazenamento | Cifrada AES-GCM no vault local (localStorage) |
| Transmissão | Via header `X-Gemini-Key` ao proxy local (127.0.0.1) |
| Backend → Google | Via header `x-goog-api-key` (nunca na URL) |
| Visibilidade nos logs | Nunca exposta |
| Rate limiting | 20 req/min sliding window por IP |
| CORS | Apenas `localhost:5173`, `127.0.0.1:5173`, `tauri://localhost` |
| Binding do servidor | Sempre `127.0.0.1` (inacessível pela rede local) |

A chave Gemini nunca trafega em plaintext fora da memória do processo. O proxy local é a única peça que conhece a chave em runtime, e ele a descarta após cada request.

---

## 6. Como rebuildar o app

### Build completo (sidecar + Tauri)
```powershell
# 1. Fechar o app (necessário para o Rust sobrescrever o .exe)
Stop-Process -Name reminder1 -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# 2. Rebuildar sidecar Python (só necessário se o backend mudou)
.\scripts\build-sidecar.ps1
Start-Sleep -Seconds 5   # aguarda Defender liberar o novo .exe

# 3. Build do app Tauri (frontend + instalador)
npm run tauri build
```

### Só frontend mudou (sem mudanças no Python)
```powershell
Stop-Process -Name reminder1 -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
npm run tauri build
```

### Instaladores gerados em
```
src-tauri/target/release/bundle/nsis/Reminder1_0.1.0_x64-setup.exe   ← preferido
src-tauri/target/release/bundle/msi/Reminder1_0.1.0_x64_pt-BR.msi
```

---

## 7. Estado atual do app após esta sessão

### Funcionalidades confirmadas
- [x] Vault com PIN, bloqueio por inatividade, factory reset
- [x] Onboarding wizard (4 passos)
- [x] Chave Gemini configurável via UI, cifrada no vault
- [x] Google Calendar OAuth embutido no instalador (sem configuração manual)
- [x] Transcrição de voz via Web Speech API (tempo real, zero-config)
- [x] Fallback automático para Whisper local se Web Speech API indisponível
- [x] Feedback de erro claro quando conexão Google falha
- [x] Build reproduzível com script único

### Dependências externas necessárias para uso completo
| Feature | Dependência | Configuração |
|---------|-------------|-------------|
| Transcrição de voz | Internet (Web Speech API) | Nenhuma |
| IA (Gemini) | Chave API Gemini | Configurações > Chave Gemini |
| Google Calendar | Conta Google | Botão "Entrar" no app |
| Whisper offline | Sidecar Python rodando + modelo baixado | Automático (fallback) |
