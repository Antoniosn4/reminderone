"""Cobre o SlidingWindowRateLimiter: aceita até o limite, bloqueia além
e libera após a janela passar (simulada com monkeypatch em monotonic)."""

import pytest

from middleware.rate_limit import SlidingWindowRateLimiter
from fastapi import HTTPException


class FakeClock:
    """Relógio determinístico para simular passagem de tempo nos testes."""

    def __init__(self, start: float = 0.0):
        self.now = start

    def __call__(self) -> float:
        return self.now

    def advance(self, seconds: float) -> None:
        self.now += seconds


def patch_clock(monkeypatch, clock: FakeClock):
    monkeypatch.setattr("middleware.rate_limit.monotonic", clock)


def test_allows_requests_under_limit(monkeypatch):
    clock = FakeClock()
    patch_clock(monkeypatch, clock)

    limiter = SlidingWindowRateLimiter(limit=3, window_sec=60)
    for _ in range(3):
        limiter.check("user-1")  # não deve levantar


def test_rejects_when_limit_reached(monkeypatch):
    clock = FakeClock()
    patch_clock(monkeypatch, clock)

    limiter = SlidingWindowRateLimiter(limit=2, window_sec=60)
    limiter.check("user-1")
    limiter.check("user-1")
    with pytest.raises(HTTPException) as exc:
        limiter.check("user-1")
    assert exc.value.status_code == 429
    assert "Retry-After" in exc.value.headers


def test_resets_after_window(monkeypatch):
    clock = FakeClock()
    patch_clock(monkeypatch, clock)

    limiter = SlidingWindowRateLimiter(limit=1, window_sec=60)
    limiter.check("user-1")

    clock.advance(61)
    limiter.check("user-1")  # janela expirou — deve permitir


def test_isolates_identifiers(monkeypatch):
    clock = FakeClock()
    patch_clock(monkeypatch, clock)

    limiter = SlidingWindowRateLimiter(limit=1, window_sec=60)
    limiter.check("user-a")
    limiter.check("user-b")  # outro usuário não compartilha bucket


def test_invalid_arguments_raise():
    with pytest.raises(ValueError):
        SlidingWindowRateLimiter(limit=0, window_sec=60)
    with pytest.raises(ValueError):
        SlidingWindowRateLimiter(limit=10, window_sec=0)
