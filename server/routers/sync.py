"""Rotas da sincronização desktop ↔ mobile (protocolo v1).

Contrato completo em docs/SYNC_PROTOCOL.md. Resumo:
- ``/status``, ``/push`` e ``/pull`` exigem o token de sincronização;
- ``/pair``, ``/unpair`` e ``/hosts`` só aceitam conexões da própria máquina,
  porque é o app desktop quem ativa a sincronia e mostra o QR code.
"""

from __future__ import annotations

import asyncio
import time
import ipaddress
import socket
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field

from app_paths import app_data_file
from security import is_loopback, token_matches
from sync_store import ENTITIES, AlreadyPairedError, Envelope, SyncStore

router = APIRouter(prefix="/sync", tags=["sync"])

MAX_BATCH = 500
MAX_PULL_PAGE = 1000
DEFAULT_PULL_PAGE = 500
MAX_PAYLOAD_CHARS = 1_000_000
# `Date.prototype.toISOString`: milissegundos fixos para a comparação de texto valer.
ISO_UTC_MS = r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$"

EntityName = Literal[tuple(sorted(ENTITIES))]  # type: ignore[valid-type]

_store: SyncStore | None = None


def get_store() -> SyncStore:
    """O banco da sincronização, criado na primeira chamada no diretório de dados do app."""
    global _store
    if _store is None:
        _store = SyncStore(app_data_file("sync.db", create_parent=True))
    return _store


def require_local(request: Request) -> None:
    if not is_loopback(request):
        raise HTTPException(status_code=403, detail="Disponível só no próprio computador.")


def require_token(request: Request, store: SyncStore = Depends(get_store)) -> SyncStore:
    auth_hash = store.auth_hash()
    if auth_hash is None:
        raise HTTPException(status_code=412, detail="not_paired")
    if not token_matches(request, auth_hash):
        raise HTTPException(status_code=401, detail="invalid_token")
    return store


# ── Schemas ─────────────────────────────────────────────────

class EnvelopeIn(BaseModel):
    entity: EntityName
    id: str = Field(min_length=1, max_length=200)
    updatedAt: str = Field(pattern=ISO_UTC_MS)
    deleted: bool
    payload: str = Field(min_length=1, max_length=MAX_PAYLOAD_CHARS)

    def to_envelope(self) -> Envelope:
        return Envelope(
            entity=self.entity,
            id=self.id,
            updated_at=self.updatedAt,
            deleted=self.deleted,
            payload=self.payload,
        )


class PushBody(BaseModel):
    deviceId: str = Field(default="", max_length=100)
    changes: list[EnvelopeIn] = Field(max_length=MAX_BATCH)


class PairBody(BaseModel):
    authHash: str = Field(pattern=r"^[0-9a-f]{64}$")
    reset: bool = False


# ── Rotas ───────────────────────────────────────────────────

@router.get("/status")
def status(store: SyncStore = Depends(require_token)):
    store_id, cursor = store.status()
    return {"paired": True, "storeId": store_id, "cursor": cursor}


@router.post("/push")
def push(body: PushBody, store: SyncStore = Depends(require_token)):
    result = store.push([change.to_envelope() for change in body.changes], body.deviceId)
    return {
        "accepted": [{"entity": entity, "id": record_id} for entity, record_id in result.accepted],
        "rejected": [envelope.to_wire() for envelope in result.rejected],
        "cursor": result.cursor,
    }


@router.get("/pull")
def pull(
    since: int = Query(default=0, ge=0),
    limit: int = Query(default=DEFAULT_PULL_PAGE, ge=1, le=MAX_PULL_PAGE),
    store: SyncStore = Depends(require_token),
):
    result = store.pull(since, limit)
    return {
        "storeId": result.store_id,
        "changes": [envelope.to_wire() for envelope in result.changes],
        "cursor": result.cursor,
        "hasMore": result.has_more,
    }


@router.post("/pair", dependencies=[Depends(require_local)])
def pair(body: PairBody, store: SyncStore = Depends(get_store)):
    try:
        store_id = store.pair(body.authHash, reset=body.reset)
    except AlreadyPairedError as error:
        raise HTTPException(status_code=409, detail="paired_with_another_key") from error
    return {"storeId": store_id}


@router.post("/unpair", dependencies=[Depends(require_local)])
def unpair(store: SyncStore = Depends(get_store)):
    store.unpair()
    return {"paired": False}


@router.get("/hosts", dependencies=[Depends(require_local)])
def hosts(request: Request):
    return {"port": request.url.port or 8000, "addresses": lan_addresses()}


def lan_addresses() -> list[str]:
    """IPv4 desta máquina que o celular pode alcançar, os de rede doméstica primeiro."""
    found: set[str] = set()
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            found.add(info[4][0])
    except OSError:
        pass
    try:
        # Não envia nada: só descobre o IP da interface da rota padrão.
        probe = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        try:
            probe.connect(("10.255.255.255", 1))
            found.add(probe.getsockname()[0])
        finally:
            probe.close()
    except OSError:
        pass

    usable = []
    for address in found:
        try:
            ip = ipaddress.IPv4Address(address)
        except ValueError:
            continue
        if ip.is_loopback or ip.is_link_local or ip.is_unspecified:
            continue
        usable.append(ip)
    # Redes privadas (192.168.x, 10.x, 172.16-31.x) antes de VPNs como a do Radmin (26.x).
    usable.sort(key=lambda ip: (not ip.is_private, str(ip)))
    return [str(ip) for ip in usable]


@router.get("/changes")
async def changes(
    request: Request,
    since: int = Query(default=0, ge=0),
    store_id: str = "",
    timeout: float = Query(default=25, ge=0, le=25),
    store: SyncStore = Depends(require_token),
):
    """Authenticated long poll: envelopes still travel exclusively through pull.

    Recheck every 250 ms, including other server processes sharing the SQLite DB.
    Async waiting does not occupy a worker thread for each connected device.
    """
    deadline = time.monotonic() + timeout
    while True:
        current_id, cursor = await asyncio.to_thread(store.status)
        if current_id != store_id or cursor != since or time.monotonic() >= deadline:
            return {"storeId": current_id or "", "cursor": cursor}
        if await request.is_disconnected():
            return {"storeId": current_id or "", "cursor": cursor}
        await asyncio.sleep(0.25)
