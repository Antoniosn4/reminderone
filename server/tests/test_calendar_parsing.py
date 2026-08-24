"""Testa as funções puras de parsing de tarefas em eventos do GCal:
- _resolve_task_date  → fallback para hoje em datas inválidas.
- _parse_task_to_event → all-day vs. dateTime, timezone, duração e reminders.
- _parse_notify_minutes → respeita CSV e limita ao máximo permitido."""

import os
from datetime import date, timedelta

import pytest

import importlib

calendar_module = importlib.import_module("routers.calendar")


def reload_with_env(monkeypatch, **env: str):
    """Recarrega o módulo capturando overrides de env (ex: NOTIFY_MINUTES)."""
    for key, value in env.items():
        monkeypatch.setenv(key, value)
    return importlib.reload(calendar_module)


def test_resolve_task_date_uses_today_when_missing():
    today = date.today()
    assert calendar_module._resolve_task_date({}) == today
    assert calendar_module._resolve_task_date({"date": ""}) == today


def test_resolve_task_date_falls_back_when_invalid():
    today = date.today()
    assert calendar_module._resolve_task_date({"date": "31/02/2025"}) == today
    assert calendar_module._resolve_task_date({"date": "abacaxi"}) == today


def test_resolve_task_date_parses_iso():
    assert calendar_module._resolve_task_date({"date": "2027-04-12"}) == date(2027, 4, 12)


def test_parse_task_to_event_with_time_uses_local_tz():
    event = calendar_module._parse_task_to_event({
        "title": "Reunião",
        "date": "2027-04-12",
        "time": "14:30",
    })
    assert event["summary"] == "Reunião"
    assert "dateTime" in event["start"]
    assert event["start"]["timeZone"] == calendar_module.LOCAL_TZ_NAME
    # Janela default = 1h.
    start_iso = event["start"]["dateTime"]
    end_iso = event["end"]["dateTime"]
    assert start_iso.startswith("2027-04-12T14:30")
    assert end_iso.startswith("2027-04-12T15:30")


def test_parse_task_to_event_without_time_is_all_day():
    event = calendar_module._parse_task_to_event({
        "title": "Sem hora",
        "date": "2027-04-12",
        "time": "Sem horário",
    })
    assert event["start"] == {"date": "2027-04-12"}
    assert event["end"] == {"date": "2027-04-13"}


def test_parse_task_to_event_includes_reminders_overrides():
    event = calendar_module._parse_task_to_event({
        "title": "Lembrete",
        "date": "2027-04-12",
        "time": "10:00",
    })
    reminders = event["reminders"]
    assert reminders["useDefault"] is False
    assert all(item["method"] == "popup" for item in reminders["overrides"])
    assert all(isinstance(item["minutes"], int) for item in reminders["overrides"])


def test_parse_notify_minutes_csv_and_clipping(monkeypatch):
    mod = reload_with_env(monkeypatch, REMINDER_DEFAULT_NOTIFY_MINUTES="60,15,5,abc,99999999")
    minutes = mod._parse_notify_minutes()
    assert 60 in minutes
    assert 15 in minutes
    assert 5 in minutes
    assert "abc" not in minutes  # não-numérico ignorado
    assert all(0 <= m <= 40320 for m in minutes)


def test_parse_notify_minutes_falls_back_to_default(monkeypatch):
    mod = reload_with_env(monkeypatch, REMINDER_DEFAULT_NOTIFY_MINUTES=",,,,,")
    minutes = mod._parse_notify_minutes()
    assert minutes == [int(mod.GCAL_DEFAULT_NOTIFY_MINUTES)]
