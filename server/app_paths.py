"""Runtime paths for the Reminder1 local sidecar.

The PyInstaller onefile runtime extracts code into a temporary directory, so
runtime state must never be written next to ``__file__``. This module centralizes
where config and OAuth tokens live.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

APP_NAME = "Reminder1"


def server_dir() -> Path:
    return Path(__file__).resolve().parent


def resource_dir() -> Path:
    frozen_root = getattr(sys, "_MEIPASS", None)
    return Path(frozen_root).resolve() if frozen_root else server_dir()


def app_data_dir(create: bool = False) -> Path:
    override = os.getenv("REMINDER_DATA_DIR")
    if override:
        path = Path(override).expanduser()
    elif os.name == "nt":
        base = os.getenv("LOCALAPPDATA") or os.getenv("APPDATA")
        path = Path(base).expanduser() / APP_NAME if base else Path.home() / "AppData" / "Local" / APP_NAME
    elif sys.platform == "darwin":
        path = Path.home() / "Library" / "Application Support" / APP_NAME
    else:
        base = os.getenv("XDG_DATA_HOME")
        path = Path(base).expanduser() / APP_NAME if base else Path.home() / ".local" / "share" / APP_NAME

    if create:
        path.mkdir(parents=True, exist_ok=True)
    return path


def app_data_file(name: str, create_parent: bool = False) -> Path:
    return app_data_dir(create=create_parent) / name


def env_file_candidates() -> list[Path]:
    candidates: list[Path] = []
    explicit = os.getenv("REMINDER_ENV_FILE")
    if explicit:
        candidates.append(Path(explicit).expanduser())

    candidates.extend([
        app_data_file(".env"),
        resource_dir() / ".env",
        server_dir() / ".env",
    ])

    return _dedupe(candidates)


def _dedupe(paths: list[Path]) -> list[Path]:
    seen: set[str] = set()
    result: list[Path] = []
    for path in paths:
        key = str(path)
        if key in seen:
            continue
        seen.add(key)
        result.append(path)
    return result
