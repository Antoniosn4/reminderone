"""Cobre a TTL do estado OAuth pendente: flows expirados são purgados."""

import time

import importlib

calendar_module = importlib.import_module("routers.calendar")


def test_expired_flows_are_purged(monkeypatch):
    fake_now = {"value": 1000.0}
    monkeypatch.setattr(time, "monotonic", lambda: fake_now["value"])
    monkeypatch.setattr(calendar_module.time, "monotonic", lambda: fake_now["value"])

    calendar_module._pending_flows.clear()
    calendar_module._pending_flows["s1"] = (object(), fake_now["value"])
    calendar_module._pending_flows["s2"] = (object(), fake_now["value"] - 999)

    calendar_module._purge_expired_flows()
    assert "s1" in calendar_module._pending_flows
    assert "s2" not in calendar_module._pending_flows


def test_recent_flows_are_kept(monkeypatch):
    fake_now = {"value": 2000.0}
    monkeypatch.setattr(calendar_module.time, "monotonic", lambda: fake_now["value"])

    calendar_module._pending_flows.clear()
    calendar_module._pending_flows["alive"] = (object(), fake_now["value"] - 60)

    calendar_module._purge_expired_flows()
    assert "alive" in calendar_module._pending_flows
