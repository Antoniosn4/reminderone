Sidecar FastAPI (reminder-server)
================================

Antes de rodar `npm run tauri dev` ou `npm run tauri:build`, este diretório precisa
conter o executável gerado pelo PyInstaller, com o nome exato que o Tauri espera:

  reminder-server-x86_64-pc-windows-msvc.exe   (Windows 64-bit)

Gere-o com:

  npm run sidecar:build

Isso executa scripts/build-sidecar.ps1 e copia o binário para cá.
