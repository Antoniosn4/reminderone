# =============================================================
#  middleware/rate_limit.py
#  Sliding-window rate limiter custom em memória.
#
#  Por que custom em vez de slowapi/limits?
#    - Reduz dependências de terceiros (princípio de menor superfície
#      de supply-chain).
#    - Sem necessidade de Redis: o servidor é local e single-process.
#    - Comportamento determinístico e auditável em ~50 linhas.
#
#  Aplicação: instanciar um limiter por endpoint e chamar `.check(id)`
#  no início do handler. `id` é tipicamente o IP do cliente.
# =============================================================

from collections import defaultdict, deque
from time import monotonic
from threading import Lock
from typing import Deque

from fastapi import HTTPException


class SlidingWindowRateLimiter:
    """Limita N requisições por janela de tempo deslizante por identificador."""

    def __init__(self, limit: int, window_sec: int):
        if limit <= 0 or window_sec <= 0:
            raise ValueError("limit e window_sec devem ser positivos")
        self._limit = limit
        self._window = window_sec
        self._buckets: dict[str, Deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def check(self, identifier: str) -> None:
        """Lança 429 se o identificador excedeu o limite na janela atual."""
        now = monotonic()
        cutoff = now - self._window

        with self._lock:
            bucket = self._buckets[identifier]
            # Remove timestamps fora da janela.
            while bucket and bucket[0] <= cutoff:
                bucket.popleft()

            if len(bucket) >= self._limit:
                retry_in = max(1, int(bucket[0] + self._window - now))
                raise HTTPException(
                    status_code=429,
                    detail=f"Muitas requisições. Tente novamente em {retry_in}s.",
                    headers={"Retry-After": str(retry_in)},
                )

            bucket.append(now)
