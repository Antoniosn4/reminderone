"""Cobre os caminhos persistentes usados pelo sidecar empacotado."""

from pathlib import Path

from app_paths import app_data_dir, app_data_file, google_credentials_file


def test_app_data_dir_honors_override(monkeypatch, tmp_path):
    monkeypatch.setenv("REMINDER_DATA_DIR", str(tmp_path))

    assert app_data_dir() == tmp_path
    assert app_data_file("token.json") == tmp_path / "token.json"


def test_google_credentials_prefers_explicit_file(monkeypatch, tmp_path):
    credentials = tmp_path / "google-client.json"
    credentials.write_text("{}", encoding="utf-8")
    monkeypatch.setenv("REMINDER_GOOGLE_CREDENTIALS", str(credentials))

    assert google_credentials_file() == credentials


def test_google_credentials_falls_back_to_app_data(monkeypatch, tmp_path):
    monkeypatch.setenv("REMINDER_DATA_DIR", str(tmp_path))
    monkeypatch.delenv("REMINDER_GOOGLE_CREDENTIALS", raising=False)

    expected = Path(tmp_path) / "credentials.json"
    assert google_credentials_file() == expected
