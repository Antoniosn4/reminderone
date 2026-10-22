# =============================================================
#  main.py — Servidor local FastAPI
#  Proxies: Gemini (NLP) + Whisper (transcrição de voz), e o banco da
#  sincronização desktop ↔ mobile (routers/sync.py).
#
#  ──────────────────────────────────────────────────────────────
#  Hardening de produção (Tauri/Electron):
#  ──────────────────────────────────────────────────────────────
#  • Bind: o app desktop sobe o servidor em 0.0.0.0 para o celular
#    sincronizar pela rede local. Conexões da própria máquina passam
#    direto; as de outros aparelhos só entram com o token de
#    sincronização (middleware `lan_guard`, abaixo). Sem pareamento,
#    a rede não acessa nada além do health check.
#    Só local:  uvicorn main:app --host 127.0.0.1 --port 8000
#
#  • CORS: lista explícita configurável via env REMINDER_ALLOWED_ORIGINS
#    (separada por vírgulas). Default cobre apenas o dev server do Vite.
#
#  • API key: a GEMINI_API_KEY nunca aparece em URLs — é enviada via
#    header `x-goog-api-key`, reduzindo o risco de leak por logs.
#    Aceita também via header X-Gemini-Key do frontend (prioridade).
#
#  • Rate limit: limiter sliding-window custom em memória; protege
#    contra loops de retry que podem queimar a quota do Gemini.
# =============================================================

import os
from typing import Any

import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from dotenv import load_dotenv

from app_paths import env_file_candidates
from middleware.rate_limit import SlidingWindowRateLimiter
from security import is_loopback, token_matches

# Carrega o .env do mesmo diretório deste arquivo (server/.env)
for env_file in env_file_candidates():
    load_dotenv(dotenv_path=env_file, override=False)

from routers import whisper as whisper_router  # noqa: E402
from routers import sync as sync_router  # noqa: E402

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = "gemini-2.5-flash"
GEMINI_URL = (
    f"https://generativelanguage.googleapis.com/v1beta/models/"
    f"{GEMINI_MODEL}:generateContent"
)

DEFAULT_ALLOWED_ORIGINS = "http://localhost:5173,http://127.0.0.1:5173,tauri://localhost,http://tauri.localhost,https://tauri.localhost"
ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv("REMINDER_ALLOWED_ORIGINS", DEFAULT_ALLOWED_ORIGINS).split(",")
    if origin.strip()
]

GEMINI_REQUEST_TIMEOUT_SEC = 30.0
GEMINI_RATE_LIMIT_PER_MINUTE = 20
RATE_LIMIT_WINDOW_SEC = 60

# ----- App -----

app = FastAPI(
    title="Reminder Local Server",
    description="Proxy seguro para Gemini, transcrição Whisper local e sincronização cifrada.",
    version="2.2.0",
)

# Lista explícita de origens. Não usamos "*" — mesmo em ambiente local,
# isso reduz a exposição se a porta for bindada acidentalmente em 0.0.0.0.
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Content-Type", "Authorization", "X-Gemini-Key"],
)

app.include_router(whisper_router.router, prefix="/api")
app.include_router(sync_router.router, prefix="/api")


@app.middleware("http")
async def lan_guard(request: Request, call_next):
    """Barra quem vem da rede sem o token de sincronização.

    Livre: o health check (`GET /`) e qualquer conexão da própria máquina.
    As rotas de `/api/sync` respondem sozinhas (412 sem pareamento, 401 com
    token errado). O resto — Gemini, Whisper e a documentação do FastAPI —
    exige o token, para ninguém no Wi-Fi gastar a cota do Gemini.
    """
    path = request.url.path
    if path == "/" or is_loopback(request) or path.startswith("/api/sync/"):
        return await call_next(request)
    if not token_matches(request, sync_router.get_store().auth_hash()):
        return JSONResponse(status_code=401, content={"detail": "invalid_token"})
    return await call_next(request)

gemini_limiter = SlidingWindowRateLimiter(
    limit=GEMINI_RATE_LIMIT_PER_MINUTE,
    window_sec=RATE_LIMIT_WINDOW_SEC,
)


# ----- Schemas -----

class GenerationConfig(BaseModel):
    responseMimeType: str
    responseSchema: Any


class GeminiRequest(BaseModel):
    contents: list
    generationConfig: GenerationConfig


# ----- Helpers -----

def _client_id(request: Request) -> str:
    return request.client.host if request.client else "unknown"


# ----- Rotas -----

@app.get("/")
async def root():
    """Health check — confirma que o servidor está rodando."""
    return {
        "status": "ok",
        "service": "Reminder Local Server",
        "api_key_loaded": bool(GEMINI_API_KEY),
    }


@app.post("/api/gemini")
async def proxy_gemini(payload: GeminiRequest, request: Request):
    """
    Proxy seguro para o Gemini.
    - Aceita GEMINI_API_KEY via header X-Gemini-Key (prioridade)
      ou via variável de ambiente GEMINI_API_KEY (fallback).
    - A chave é enviada ao Google via header x-goog-api-key (nunca na URL).
    - Aplica rate limit por IP cliente para conter loops de retry.
    """
    # Prioridade: header do frontend > variável de ambiente
    api_key = request.headers.get("X-Gemini-Key") or GEMINI_API_KEY

    if not api_key:
        raise HTTPException(
            status_code=500,
            detail=(
                "GEMINI_API_KEY não configurada. "
                "Configure em Configurações > Chave da API Gemini."
            ),
        )

    gemini_limiter.check(_client_id(request))

    async with httpx.AsyncClient(timeout=GEMINI_REQUEST_TIMEOUT_SEC) as client:
        response = await client.post(
            GEMINI_URL,
            json=payload.model_dump(),
            headers={
                "Content-Type": "application/json",
                "x-goog-api-key": api_key,
            },
        )

    if response.status_code != 200:
        raise HTTPException(
            status_code=response.status_code,
            detail=f"Erro da API Gemini: {response.text}",
        )

    return response.json()
