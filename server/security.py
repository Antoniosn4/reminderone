"""Quem pode falar com o servidor local.

O servidor escuta na rede para o celular sincronizar. Conexões da própria
máquina (o app desktop, o Vite e o emulador Android, que chega por 10.0.2.2
como loopback) passam direto; as de outros aparelhos precisam do token de
sincronização (docs/SYNC_PROTOCOL.md).
"""

from __future__ import annotations

import hashlib
import hmac

from fastapi import Request

# Mutável de propósito: o TestClient se apresenta como "testclient", e os
# testes o incluem aqui para simular uma conexão local.
LOOPBACK_HOSTS = {"127.0.0.1", "::1", "localhost"}


def is_loopback(request: Request) -> bool:
    host = request.client.host if request.client else ""
    return host in LOOPBACK_HOSTS or host.startswith("127.") or host.startswith("::ffff:127.")


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def bearer_token(request: Request) -> str | None:
    header = request.headers.get("Authorization", "")
    scheme, _, token = header.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        return None
    return token.strip()


def token_matches(request: Request, auth_hash: str | None) -> bool:
    """O token do header confere com o hash guardado no pareamento."""
    token = bearer_token(request)
    if not token or not auth_hash:
        return False
    return hmac.compare_digest(hash_token(token), auth_hash)
