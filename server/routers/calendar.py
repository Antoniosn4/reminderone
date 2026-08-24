# =============================================================
#  routers/calendar.py
#  Google Calendar OAuth2 + sincronização de tarefas.
#
#  FIX (PKCE / invalid_grant): A biblioteca google-auth-oauthlib
#  implementa PKCE por padrão e armazena o code_verifier na instância
#  do Flow. Como o FastAPI é stateless, precisamos persistir a mesma
#  instância do Flow entre /auth e /callback usando um dicionário
#  em memória indexado pelo parâmetro `state` do OAuth.
#
#  Fluxo OAuth (Desktop App):
#    1. GET /api/calendar/auth      → cria Flow, guarda em _pending_flows[state]
#                                   → abre browser com auth_url
#    2. GET /api/calendar/callback  → recupera Flow via ?state=... → fetch_token
#                                   → salva token.json → retorna HTML de sucesso
#    3. GET /api/calendar/status    → verifica se token existe e é válido
#
#  Sincronização:
#    POST   /api/calendar/sync               → cria/atualiza evento
#    DELETE /api/calendar/event/{event_id}   → remove evento
# =============================================================

import os
import time
import webbrowser
import logging
from datetime import date, datetime, timedelta
from threading import Lock
from zoneinfo import ZoneInfo

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from app_paths import app_data_file, google_credentials_file

logger = logging.getLogger(__name__)

router = APIRouter()

# ----- Caminhos -----
CREDENTIALS_FILE = google_credentials_file()
TOKEN_FILE = app_data_file("token.json")

# ----- Configuração OAuth -----
SCOPES = ["https://www.googleapis.com/auth/calendar.events"]
REDIRECT_URI = "http://localhost:8000/api/calendar/callback"

# ----- Configuração de eventos -----
LOCAL_TZ_NAME = os.getenv("REMINDER_LOCAL_TZ", "America/Sao_Paulo")
LOCAL_TZ = ZoneInfo(LOCAL_TZ_NAME)
DEFAULT_EVENT_DURATION_HOURS = 1

# Lembretes (push no app Google Calendar do celular).
# - method="popup" dispara a notificação nativa do app móvel.
# - Configuráveis via REMINDER_DEFAULT_NOTIFY_MINUTES (CSV de minutos antes).
#   Ex: "30,5" → dispara 30 min e 5 min antes do horário.
# - Limite de 5 overrides por evento (regra atual da API do Google).
GCAL_MAX_OVERRIDES = 5
GCAL_DEFAULT_NOTIFY_MINUTES = "30"


def _parse_notify_minutes() -> list[int]:
    raw = os.getenv("REMINDER_DEFAULT_NOTIFY_MINUTES", GCAL_DEFAULT_NOTIFY_MINUTES)
    minutes: list[int] = []
    for chunk in raw.split(","):
        chunk = chunk.strip()
        if not chunk:
            continue
        try:
            value = int(chunk)
        except ValueError:
            continue
        if 0 <= value <= 40320:  # Google permite até 4 semanas (40320 min).
            minutes.append(value)
    return minutes[:GCAL_MAX_OVERRIDES] or [int(GCAL_DEFAULT_NOTIFY_MINUTES)]


DEFAULT_NOTIFY_MINUTES = _parse_notify_minutes()

# ----- Estado global em memória (PKCE fix) -----
# Mapeia state → (Flow, created_monotonic). Garante que o mesmo Flow
# (com o code_verifier PKCE correto) seja usado em /callback. Inclui
# TTL para evitar memory leak e janela de replay.
PENDING_FLOW_TTL_SEC = 10 * 60  # 10 min — accommodates slow auth (multiple accounts, 2FA)
_pending_flows: dict[str, tuple[Flow, float]] = {}
_flows_lock = Lock()


def _purge_expired_flows() -> None:
    """Remove flows OAuth pendentes que excederam o TTL."""
    now = time.monotonic()
    with _flows_lock:
        expired = [
            state for state, (_, created_at) in _pending_flows.items()
            if now - created_at > PENDING_FLOW_TTL_SEC
        ]
        for state in expired:
            _pending_flows.pop(state, None)
        if expired:
            logger.info("OAuth: %d flow(s) expirado(s) removido(s)", len(expired))


# ----- Helpers -----

def _credentials_exist() -> bool:
    return CREDENTIALS_FILE.exists()


def _load_token() -> Credentials | None:
    """Carrega e, se necessário, refresca o token salvo em token.json."""
    if not TOKEN_FILE.exists():
        return None
    try:
        creds = Credentials.from_authorized_user_file(str(TOKEN_FILE), SCOPES)
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
            TOKEN_FILE.parent.mkdir(parents=True, exist_ok=True)
            TOKEN_FILE.write_text(creds.to_json(), encoding="utf-8")
        return creds if creds and creds.valid else None
    except Exception as exc:
        logger.warning("Falha ao carregar token: %s", exc)
        return None


def _get_calendar_service():
    """Retorna um cliente autenticado da Google Calendar API."""
    creds = _load_token()
    if not creds:
        raise HTTPException(
            status_code=401,
            detail="Não autenticado. Acesse /api/calendar/auth para conectar.",
        )
    return build("calendar", "v3", credentials=creds, cache_discovery=False)


def _resolve_task_date(task: dict) -> date:
    """Lê `task.date` no formato ISO; cai para hoje se ausente ou inválido."""
    raw = task.get("date")
    if not raw:
        return date.today()
    try:
        return date.fromisoformat(raw)
    except (ValueError, TypeError):
        return date.today()


def _build_reminders() -> dict:
    """Configura overrides de notificação push (popup) para o evento."""
    return {
        "useDefault": False,
        "overrides": [
            {"method": "popup", "minutes": minutes}
            for minutes in DEFAULT_NOTIFY_MINUTES
        ],
    }


def _parse_task_to_event(task: dict) -> dict:
    """
    Converte uma tarefa do Reminder em um recurso de evento do Google Calendar.
    - `time` no formato HH:MM → evento com hora exata na timezone local.
    - Caso contrário → evento de dia inteiro (all-day) na data da tarefa.
    Inclui sempre `reminders.overrides` (popup) para garantir notificação
    push no app Google Calendar do celular do usuário.
    """
    title = task.get("title", "Tarefa sem título")
    raw_time: str = task.get("time", "") or ""
    task_date = _resolve_task_date(task)
    reminders = _build_reminders()

    if ":" in raw_time:
        try:
            hour, minute = map(int, raw_time.split(":")[:2])
            start_dt = datetime(
                task_date.year, task_date.month, task_date.day,
                hour, minute, tzinfo=LOCAL_TZ,
            )
            end_dt = start_dt + timedelta(hours=DEFAULT_EVENT_DURATION_HOURS)
            return {
                "summary": title,
                "start": {"dateTime": start_dt.isoformat(), "timeZone": LOCAL_TZ_NAME},
                "end":   {"dateTime": end_dt.isoformat(),   "timeZone": LOCAL_TZ_NAME},
                "reminders": reminders,
            }
        except (ValueError, TypeError):
            pass

    iso_date = task_date.isoformat()
    end_date = (task_date + timedelta(days=1)).isoformat()
    return {
        "summary": title,
        "start": {"date": iso_date},
        "end":   {"date": end_date},
        "reminders": reminders,
    }


# ----- Schemas -----

class SyncPayload(BaseModel):
    task: dict


# ----- Rotas -----

@router.get("/calendar/status")
def calendar_status():
    """Informa se o usuário está autenticado no Google Calendar."""
    if not _credentials_exist():
        return {
            "connected": False,
            "reason": f"credentials.json nao encontrado. Coloque em {CREDENTIALS_FILE.parent}",
        }
    creds = _load_token()
    return {"connected": creds is not None}


@router.get("/calendar/auth")
def calendar_auth():
    """
    Inicia o fluxo OAuth2.
    - Cria uma instância do Flow (que gera o code_verifier PKCE internamente).
    - Armazena a instância em _pending_flows[state] para recuperar no callback.
    - Abre o browser com a URL de autorização.
    """
    if not _credentials_exist():
        raise HTTPException(
            status_code=500,
            detail=(
                f"Arquivo credentials.json nao encontrado em {CREDENTIALS_FILE.parent}. "
                "Crie credenciais OAuth no Google Cloud Console e coloque o JSON nesse local."
            ),
        )

    _purge_expired_flows()

    flow = Flow.from_client_secrets_file(
        str(CREDENTIALS_FILE),
        scopes=SCOPES,
        redirect_uri=REDIRECT_URI,
    )

    # authorization_url() gera o code_verifier/code_challenge PKCE e devolve o state
    auth_url, state = flow.authorization_url(
        prompt="consent",
        access_type="offline",
    )

    # PKCE fix: guarda a instância do Flow vinculada ao state, com timestamp para TTL.
    with _flows_lock:
        _pending_flows[state] = (flow, time.monotonic())
    logger.info("Flow pendente criado para state=%s", state[:12])

    webbrowser.open(auth_url)
    return {"status": "browser_opened", "message": "Autorizando no browser..."}


@router.get("/calendar/callback", response_class=HTMLResponse)
def calendar_callback(code: str = Query(...), state: str = Query(...)):
    """
    Recebe o authorization code e state do Google.
    Recupera a instância do Flow original (com o code_verifier PKCE intacto),
    troca o code por tokens e salva em token.json.
    """
    _purge_expired_flows()

    # PKCE fix: recupera o Flow que foi criado em /auth (e checa TTL).
    with _flows_lock:
        entry = _pending_flows.pop(state, None)
    if entry is None:
        logger.error("Flow não encontrado para state=%s. Possível replay ou expiração.", state[:12])
        raise HTTPException(
            status_code=400,
            detail="Sessão OAuth inválida ou expirada. Tente conectar novamente.",
        )

    flow, _created_at = entry

    try:
        flow.fetch_token(code=code)
        creds = flow.credentials
        TOKEN_FILE.parent.mkdir(parents=True, exist_ok=True)
        TOKEN_FILE.write_text(creds.to_json(), encoding="utf-8")
        logger.info("Token OAuth salvo com sucesso em token.json.")
    except Exception as exc:
        logger.error("Falha ao obter token: %s", exc)
        raise HTTPException(status_code=500, detail=f"Falha na autenticação: {str(exc)}")

    return """
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>Reminder — Conectado!</title>
      <style>
        body { font-family: system-ui, sans-serif; display:flex; align-items:center;
               justify-content:center; min-height:100vh; margin:0; background:#111827; color:#e5e7eb; }
        .card { text-align:center; padding:2rem; border-radius:1rem;
                background:#1f2937; border:1px solid #374151; max-width:400px; }
        h1 { color:#10b981; margin-bottom:.5rem; }
        p  { color:#9ca3af; }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>✅ Conectado ao Google Calendar!</h1>
        <p>Você pode fechar esta aba e voltar ao Reminder.</p>
      </div>
    </body>
    </html>
    """


@router.post("/calendar/disconnect")
def calendar_disconnect():
    """Remove o token OAuth local, desconectando a conta Google."""
    try:
        if TOKEN_FILE.exists():
            TOKEN_FILE.unlink()
            logger.info("Token OAuth removido com sucesso.")
        return {"disconnected": True}
    except Exception as exc:
        logger.error("Falha ao remover token: %s", exc)
        raise HTTPException(status_code=500, detail=f"Falha ao desconectar: {exc}")


@router.post("/calendar/sync")
def sync_task(payload: SyncPayload):
    """
    Cria ou atualiza um evento no Google Calendar para a tarefa fornecida.
    - Se `task.gcalEventId` existir → atualiza (PATCH) o evento existente.
    - Caso contrário → cria um novo evento e retorna o `eventId`.
    """
    service = _get_calendar_service()
    event_body = _parse_task_to_event(payload.task)
    existing_event_id: str | None = payload.task.get("gcalEventId")

    try:
        if existing_event_id:
            event = service.events().patch(
                calendarId="primary",
                eventId=existing_event_id,
                body=event_body,
            ).execute()
        else:
            event = service.events().insert(
                calendarId="primary",
                body=event_body,
            ).execute()

        logger.info("Evento sincronizado: %s", event["id"])
        return {"eventId": event["id"]}

    except HttpError as exc:
        logger.error("Erro na API do Google Calendar: %s", exc)
        raise HTTPException(
            status_code=exc.resp.status,
            detail=f"Erro ao sincronizar com Google Calendar: {exc}",
        )


@router.delete("/calendar/event/{event_id}")
def delete_calendar_event(event_id: str):
    """Remove um evento do Google Calendar pelo seu ID."""
    service = _get_calendar_service()
    try:
        service.events().delete(calendarId="primary", eventId=event_id).execute()
        logger.info("Evento removido: %s", event_id)
        return {"deleted": True}
    except HttpError as exc:
        if exc.resp.status == 410:  # Gone — já não existe
            return {"deleted": True}
        logger.error("Erro ao deletar evento: %s", exc)
        raise HTTPException(
            status_code=exc.resp.status,
            detail=f"Erro ao remover evento do Google Calendar: {exc}",
        )
