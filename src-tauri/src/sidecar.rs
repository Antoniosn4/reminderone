// =============================================================
//  sidecar.rs
//  Inicia o servidor FastAPI (empacotado pelo PyInstaller) como
//  sub-processo do app, e o encerra quando o app fecha.
//
//  - O binário é resolvido pela API do Tauri (`shell.sidecar`),
//    que aplica o sufixo de plataforma (-x86_64-pc-windows-msvc.exe).
//  - Bind sempre em 127.0.0.1 (nunca exposto à rede).
//  - Logs do sidecar são silenciados em release.
// =============================================================

use std::sync::Mutex;
use tauri::{AppHandle, Manager};
use tauri_plugin_shell::process::CommandChild;
#[cfg(debug_assertions)]
use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;

pub struct SidecarState(pub Mutex<Option<CommandChild>>);

pub fn start_server(app: AppHandle) {
    let shell = app.shell();
    let command = match shell.sidecar("reminder-server") {
        Ok(cmd) => cmd.args(["--host", "127.0.0.1", "--port", "8000"]),
        Err(err) => {
            eprintln!("[sidecar] não encontrado: {err}");
            return;
        }
    };

    let (mut rx, child) = match command.spawn() {
        Ok(handle) => handle,
        Err(err) => {
            eprintln!("[sidecar] falha ao iniciar: {err}");
            return;
        }
    };

    app.manage(SidecarState(Mutex::new(Some(child))));

    // Drena stdout/stderr em uma task async para não bloquear.
    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            #[cfg(debug_assertions)]
            match event {
                CommandEvent::Stdout(line) => {
                    println!("[sidecar] {}", String::from_utf8_lossy(&line))
                }
                CommandEvent::Stderr(line) => {
                    eprintln!("[sidecar] {}", String::from_utf8_lossy(&line))
                }
                CommandEvent::Terminated(payload) => {
                    eprintln!("[sidecar] encerrado: code={:?}", payload.code);
                }
                _ => {}
            }
            #[cfg(not(debug_assertions))]
            {
                let _ = event;
            }
        }
    });
}

pub fn stop_server(app: &AppHandle) {
    if let Some(state) = app.try_state::<SidecarState>() {
        if let Ok(mut guard) = state.0.lock() {
            if let Some(child) = guard.take() {
                let _ = child.kill();
            }
        }
    }
}
