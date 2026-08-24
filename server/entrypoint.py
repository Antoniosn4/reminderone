"""Entrypoint do binário PyInstaller.

Permite iniciar o servidor FastAPI com argumentos `--host` e `--port`
quando rodando como sidecar do Tauri. Em desenvolvimento,
você ainda pode usar `uvicorn main:app --reload` diretamente.
"""

import argparse
import os
import sys
from pathlib import Path

# Em builds PyInstaller sem console no Windows, stdout/stderr podem ser None.
# Uvicorn/logging esperam streams validos durante o startup.
if sys.stdout is None:
    sys.stdout = open(os.devnull, "w", encoding="utf-8")
if sys.stderr is None:
    sys.stderr = open(os.devnull, "w", encoding="utf-8")

# Garante que o diretório do servidor está no sys.path quando o
# binário é descomprimido para um diretório temporário pelo PyInstaller.
ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import uvicorn  # noqa: E402
from main import app  # noqa: E402


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Reminder1 local server")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    # Hardening: bind explicito em loopback. Recusa qualquer pedido
    # para escutar em 0.0.0.0 vindo dos argumentos.
    host = "127.0.0.1" if args.host in {"0.0.0.0", "::", ""} else args.host
    uvicorn.run(app, host=host, port=args.port, log_level="warning")


if __name__ == "__main__":
    main()
