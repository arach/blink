use crate::error::BlinkResult;
use crate::handlers::{build_app_menu, handle_menu_event, register_global_shortcuts, handle_global_shortcut};
use crate::handlers::window_handler::apply_initial_window_settings;
use crate::startup::data_loader::load_application_data;
use crate::types::config::AppConfig;
use crate::types::window::{DetachedWindowsState, NotesState, ToggleState};
use crate::{log_error, log_info};
use std::collections::HashMap;
use tauri::{App, Manager};
use tauri_plugin_global_shortcut::ShortcutState;

/// Setup the application on startup
pub fn setup_app(app: &mut App) -> BlinkResult<()> {
    let app_handle = app.handle().clone();

    // Get states for menu building
    let notes_state = app.state::<NotesState>();
    let detached_windows_state = app.state::<DetachedWindowsState>();

    // Set up initial menu
    let app_handle_for_menu = app_handle.clone();
    tauri::async_runtime::block_on(async {
        let notes_lock = notes_state.lock().await;
        let windows_lock = detached_windows_state.lock().await;
        if let Ok(menu) = build_app_menu(&app_handle_for_menu, &*windows_lock, &*notes_lock) {
            let _ = app_handle_for_menu.set_menu(menu);
        }
    });

    // Register global shortcuts
    register_global_shortcuts(&app_handle)?;

    // Apply config settings synchronously
    let config_state_ref = app.state::<crate::ConfigState>();
    let config_for_init = tauri::async_runtime::block_on(async {
        config_state_ref.lock().await.clone()
    });

    apply_initial_window_settings(&app_handle, &config_for_init);

    // Load data asynchronously after app starts
    let app_handle_for_loading = app_handle.clone();
    tauri::async_runtime::spawn(async move {
        if let Err(e) = load_application_data(app_handle_for_loading).await {
            log_error!("STARTUP", "Failed to load application data: {}", e);
        }
    });

    Ok(())
}

/// Build the global shortcut handler
pub fn build_shortcut_handler() -> impl Fn(&tauri::AppHandle, &tauri_plugin_global_shortcut::Shortcut, tauri_plugin_global_shortcut::ShortcutEvent) + Send + Sync + 'static {
    |app, shortcut, event| {
        log_info!(
            "SHORTCUT-HANDLER",
            "🎯 Global shortcut handler invoked - Event: {:?}, Shortcut: {:?}",
            event.state,
            shortcut
        );
        
        if event.state == ShortcutState::Pressed {
            handle_global_shortcut(app, shortcut, event.state);
        }
    }
}

/// Build the menu event handler
pub fn build_menu_handler() -> impl Fn(&tauri::AppHandle, tauri::menu::MenuEvent) + Send + Sync + 'static {
    |app, event| {
        let menu_id = event.id();
        handle_menu_event(app, menu_id.0.as_str());
    }
}