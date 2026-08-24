// Prevents additional console window on Windows in release.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod sidecar;
mod tray;

use tauri::Manager;
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    if event.state == ShortcutState::Pressed {
                        let toggle =
                            Shortcut::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::KeyR);
                        if shortcut == &toggle {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = if window.is_visible().unwrap_or(false) {
                                    window.hide()
                                } else {
                                    let _ = window.show();
                                    window.set_focus()
                                };
                            }
                        }
                    }
                })
                .build(),
        )
        .setup(|app| {
            // 1. Sidecar FastAPI (binário PyInstaller empacotado).
            sidecar::start_server(app.handle().clone());

            // 2. System tray.
            tray::install(app.handle().clone())?;

            // 3. Atalho global de "show/hide" (Ctrl+Alt+R).
            let shortcut = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::ALT), Code::KeyR);
            if let Err(e) = app.global_shortcut().register(shortcut) {
                eprintln!("[aviso] Nao foi possivel registrar o atalho global: {}", e);
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            // Em vez de fechar, esconde — o tray mantém o app vivo.
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .run(tauri::generate_context!())
        .expect("erro ao rodar Reminder1");
}
