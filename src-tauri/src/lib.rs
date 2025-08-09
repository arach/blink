// Core imports
use std::collections::HashMap;

// Module declarations
mod error;
mod handlers;
mod modules;
mod services;
mod startup;
mod state;
mod types;
mod utils;

#[cfg(test)]
mod tests;

// Re-export commonly used types and functions
pub use error::{BlinkError, BlinkResult};

// Re-export state types explicitly to avoid ambiguity
pub use state::{
    AppState,
    NotesState,
    ConfigState,
    DetachedWindowsState,
    ToggleState,
    ModifiedStateTrackerState,
};

// Re-export from modules for backward compatibility
pub use modules::{
    logging::*,
    commands::*,
    storage::{get_default_notes_directory, get_configured_notes_directory, 
             get_config, update_config, get_detached_windows},
    windows::*,
    file_operations::*,
    system_commands::*,
    test_commands::*,
};

// Re-export from types (excluding the state type aliases to avoid ambiguity)
pub use types::{
    note::*,
    config::*,
    window::{DetachedWindow, CreateDetachedWindowRequest},
};

// Import handler functions
use handlers::{
    reregister_global_shortcuts as reregister_global_shortcuts_handler,
    update_app_menu as update_app_menu_handler,
    load_spatial_data,
    save_window_position,
    save_window_size,
};

// Wrapper commands for backward compatibility
#[tauri::command]
async fn update_app_menu(
    app: tauri::AppHandle,
    detached_windows: tauri::State<'_, DetachedWindowsState>,
    notes: tauri::State<'_, NotesState>,
) -> Result<(), String> {
    update_app_menu_handler(app, detached_windows, notes).await
}

#[tauri::command]
async fn reregister_global_shortcuts(app: tauri::AppHandle) -> Result<String, String> {
    let results = reregister_global_shortcuts_handler(app)
        .await
        .map_err(|e| e.to_string())?;
    
    if results.iter().any(|r| r.contains("failed")) {
        Err(results.join("; "))
    } else {
        Ok(results.join("; "))
    }
}

// Main entry point
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    use modules::logging::init_file_logging;
    use modules::modified_state_tracker::ModifiedStateTracker;
    use startup::{setup_app, build_shortcut_handler, build_menu_handler};
    
    // Initialize file logging
    match init_file_logging() {
        Ok(log_path) => {
            log_info!("STARTUP", "File logging initialized at: {}", log_path.display());
        },
        Err(e) => {
            eprintln!("Failed to initialize file logging: {}", e);
        }
    }
    
    // Initialize with empty states - data will be loaded after app starts
    let notes_state = NotesState::new(HashMap::new());
    let config_state = ConfigState::new(AppConfig::default());
    let detached_windows_state = DetachedWindowsState::new(HashMap::new());
    let modified_state_tracker = ModifiedStateTrackerState::new();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin({
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(build_shortcut_handler())
                .build()
        })
        .manage(notes_state)
        .manage(config_state)
        .manage(detached_windows_state)
        .manage(ToggleState::new(false))
        .manage(modified_state_tracker)
        .invoke_handler(tauri::generate_handler![
            // Note operations
            get_notes,
            get_note,
            create_note,
            update_note,
            delete_note,
            reorder_notes,
            get_notes_directory,
            
            // File operations
            import_notes_from_directory,
            import_single_file,
            export_note_to_file,
            export_all_notes_to_directory,
            set_notes_directory,
            reload_notes_from_directory,
            get_current_notes_directory,
            
            // Config operations
            get_config,
            update_config,
            
            // Window operations
            toggle_window_visibility,
            set_window_opacity,
            set_window_always_on_top,
            toggle_all_windows_hover,
            set_window_focus,
            force_main_window_visible,
            debug_webview_state,
            reload_main_window,
            create_detached_window,
            close_detached_window,
            focus_detached_window,
            get_detached_windows,
            update_detached_window_position,
            update_detached_window_size,
            toggle_window_shade,
            toggle_main_window_shade,
            restore_detached_windows,
            clear_all_detached_windows,
            debug_all_windows_state,
            force_all_windows_opaque,
            gather_all_windows_to_main_screen,
            recreate_missing_windows,
            test_detached_window_creation,
            get_window_state_truth,
            list_all_windows,
            create_test_window,
            test_window_events,
            force_create_detached_window,
            cleanup_stale_windows,
            cleanup_destroyed_window,
            force_close_test_window,
            cleanup_stale_hybrid_windows,
            
            // Drag and drop operations
            create_drag_ghost,
            update_drag_ghost_position,
            destroy_drag_ghost,
            create_hybrid_drag_window,
            show_hybrid_drag_window,
            update_hybrid_drag_position,
            close_hybrid_drag_window,
            finalize_hybrid_drag_window,
            
            // System operations
            open_system_settings,
            open_directory_in_finder,
            open_directory_dialog,
            
            // Menu and shortcuts
            update_app_menu,
            reregister_global_shortcuts,
            
            // Test and debug operations
            test_emit_new_note,
            test_database_migration,
            test_window_creation,
            get_log_file_path,
            get_recent_logs,
        ])
        .on_menu_event(build_menu_handler())
        .setup(|app| {
            setup_app(app)?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}