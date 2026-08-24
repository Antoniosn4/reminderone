# =============================================================
#  build-sidecar.ps1
#  1. Cria/usa um venv local em server/.venv-build.
#  2. Compila o backend para um binário único via PyInstaller.
#  3. Copia o binário para src-tauri/binaries/ com o sufixo
#     de target exigido pelo Tauri (ex: -x86_64-pc-windows-msvc.exe).
# =============================================================

$ErrorActionPreference = "Stop"
$Root      = Resolve-Path "$PSScriptRoot\.."
$ServerDir = Join-Path $Root "server"
$DistDir   = Join-Path $ServerDir "dist"
$Venv      = Join-Path $ServerDir ".venv-build"
$Binaries  = Join-Path $Root "src-tauri\binaries"

if (-not (Test-Path $Venv)) {
    Write-Host "==> Criando venv de build em $Venv"
    python -m venv $Venv
}

$PythonExe = Join-Path $Venv "Scripts\python.exe"

Write-Host "==> Instalando dependências (silencioso)"
& $PythonExe -m pip install --disable-pip-version-check --no-input -r (Join-Path $ServerDir "requirements.txt") | Out-Null
& $PythonExe -m pip install --disable-pip-version-check --no-input pyinstaller | Out-Null

Write-Host "==> Compilando reminder-server.spec"
Push-Location $ServerDir
try {
    & $PythonExe -m PyInstaller --noconfirm --clean reminder-server.spec
} finally {
    Pop-Location
}

# Detecta target triple do Rust para nomear o binário.
$Target = & rustc -vV | Select-String "host:" | ForEach-Object { ($_ -split " ")[1] }
if (-not $Target) { $Target = "x86_64-pc-windows-msvc" }

$Source = Join-Path $DistDir "reminder-server.exe"
$Dest   = Join-Path $Binaries "reminder-server-$Target.exe"

if (-not (Test-Path $Binaries)) {
    New-Item -ItemType Directory -Path $Binaries | Out-Null
}

Copy-Item -Force $Source $Dest
Write-Host "==> Sidecar pronto em $Dest"
