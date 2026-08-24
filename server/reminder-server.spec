# =============================================================
#  reminder-server.spec
#  Spec PyInstaller para empacotar o backend FastAPI como um
#  binário único (`reminder-server`).
#
#  Por que `--onefile`?
#    - O sidecar do Tauri suporta um único executável.
#    - Reduz a complexidade de assinatura/code-signing.
#  Por que hidden imports?
#    - uvicorn/fastapi carregam módulos dinamicamente; o PyInstaller
#      não consegue detectá-los apenas pelos imports estáticos.
# =============================================================

# -*- mode: python ; coding: utf-8 -*-

block_cipher = None

hidden_imports = [
    "uvicorn",
    "uvicorn.lifespan",
    "uvicorn.lifespan.on",
    "uvicorn.loops",
    "uvicorn.loops.asyncio",
    "uvicorn.protocols",
    "uvicorn.protocols.http",
    "uvicorn.protocols.http.h11_impl",
    "uvicorn.protocols.websockets",
    "uvicorn.protocols.websockets.websockets_impl",
    "uvicorn.logging",
    "fastapi",
    "starlette",
    "pydantic",
    "tzdata",
    "faster_whisper",
    "google.oauth2",
    "google.oauth2.credentials",
    "google_auth_oauthlib",
    "googleapiclient",
    "googleapiclient.discovery",
]

a = Analysis(
    ["entrypoint.py"],
    pathex=["."],
    binaries=[],
    datas=[
        # credentials.json embutido no binário: o app não precisa que o usuário
        # copie o arquivo manualmente após instalar. O token OAuth (token.json)
        # ainda é gerado em %LOCALAPPDATA%\Reminder1\ na primeira autenticação.
        ("credentials.json", "."),
    ],
    hiddenimports=hidden_imports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        # Plugins de type-checking do Pydantic/Mypy nao sao usados em runtime
        # e podem quebrar a extracao onefile em ambientes Windows restritos.
        "81d243bd2c585b0f4821__mypyc",
        "mypy",
        "pydantic.mypy",
        "pydantic.v1.mypy",
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name="reminder-server",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
