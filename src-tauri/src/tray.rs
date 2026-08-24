// =============================================================
//  tray.rs
//  System tray icon com menu contextual minimalista:
//    • Mostrar/Ocultar — alterna a janela principal.
//    • Sair — encerra o sidecar e fecha o app.
// =============================================================

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager,
};

use crate::sidecar;

const ID_TOGGLE: &str = "toggle";
const ID_QUIT: &str = "quit";

pub fn install(app: AppHandle) -> tauri::Result<()> {
    let toggle = MenuItem::with_id(&app, ID_TOGGLE, "Mostrar / Ocultar", true, None::<&str>)?;
    let quit = MenuItem::with_id(&app, ID_QUIT, "Sair", true, None::<&str>)?;
    let menu = Menu::with_items(&app, &[&toggle, &quit])?;

    let mut tray = TrayIconBuilder::with_id("reminder1-tray")
        .tooltip("Reminder1")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            ID_TOGGLE => toggle_main_window(app),
            ID_QUIT => {
                sidecar::stop_server(app);
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                toggle_main_window(tray.app_handle());
            }
        });

    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }

    tray.build(&app)?;

    Ok(())
}

fn toggle_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        if window.is_visible().unwrap_or(false) {
            let _ = window.hide();
        } else {
            let _ = window.show();
            let _ = window.set_focus();
        }
    }
}
