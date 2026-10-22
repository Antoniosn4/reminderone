"""Cobre os caminhos persistentes usados pelo sidecar empacotado."""

from app_paths import app_data_dir, app_data_file, env_file_candidates


def test_app_data_dir_honors_override(monkeypatch, tmp_path):
    monkeypatch.setenv("REMINDER_DATA_DIR", str(tmp_path))

    assert app_data_dir() == tmp_path
    assert app_data_file(".env") == tmp_path / ".env"


def test_env_file_prefers_explicit_file(monkeypatch, tmp_path):
    env_file = tmp_path / "custom.env"
    monkeypatch.setenv("REMINDER_ENV_FILE", str(env_file))

    assert env_file_candidates()[0] == env_file


def test_env_file_falls_back_to_app_data(monkeypatch, tmp_path):
    monkeypatch.setenv("REMINDER_DATA_DIR", str(tmp_path))
    monkeypatch.delenv("REMINDER_ENV_FILE", raising=False)

    assert env_file_candidates()[0] == tmp_path / ".env"
