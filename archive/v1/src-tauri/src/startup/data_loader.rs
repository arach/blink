use crate::error::{BlinkError, BlinkResult};
use crate::modules::file_notes_storage::FileNotesStorage;
use crate::ModifiedStateTrackerState;
use crate::modules::storage::{
    load_config_from_disk as load_config_from_disk_storage,
    load_detached_windows_from_disk as load_detached_windows_from_disk_storage,
};
use crate::types::config::AppConfig;
use crate::ConfigState;
use crate::types::window::{DetachedWindowsState, NotesState};
use crate::{log_error, log_info};
use tauri::{AppHandle, Manager, Emitter};

/// Load all application data on startup
pub async fn load_application_data(app_handle: AppHandle) -> BlinkResult<()> {
    log_info!("STARTUP", "Loading data asynchronously...");

    // Load config first (needed for notes directory)
    let config = load_config(app_handle.clone()).await?;

    // Load notes and windows in parallel
    let (notes_result, windows_result) = tokio::join!(
        load_notes(app_handle.clone(), &config),
        load_detached_windows()
    );

    // Update notes state
    if let Ok(notes) = notes_result {
        update_notes_state(&app_handle, notes).await?;
    }

    // Update windows state
    if let Ok(windows) = windows_result {
        update_windows_state(&app_handle, windows).await?;
    }

    // Notify frontend that data is loaded
    let _ = app_handle.emit("data-loaded", ());

    log_info!("STARTUP", "✅ All data loaded successfully");
    Ok(())
}

async fn load_config(app_handle: AppHandle) -> BlinkResult<AppConfig> {
    let config_result = load_config_from_disk_storage().await;

    let config = if let Ok(config) = config_result {
        if let Some(config_state) = app_handle.try_state::<ConfigState>() {
            let mut config_lock = config_state.lock().await;
            *config_lock = config.clone();
            log_info!("STARTUP", "✅ Loaded config");
        }
        config
    } else {
        AppConfig::default()
    };

    Ok(config)
}

async fn load_notes(
    app_handle: AppHandle,
    config: &AppConfig,
) -> BlinkResult<std::collections::HashMap<String, crate::types::note::Note>> {
    // Create FileNotesStorage
    let file_storage = FileNotesStorage::new(config)
        .map_err(|e| BlinkError::Storage(format!("Failed to create file storage: {}", e)))?;

    // Run migration if needed
    let notes_dir = crate::modules::storage::get_notes_directory()
        .map_err(|e| BlinkError::Storage(e))?;
    let json_path = notes_dir.join("notes.json");
    file_storage
        .migrate_if_needed(json_path)
        .await
        .map_err(|e| BlinkError::Storage(e))?;

    // Load notes from files
    file_storage
        .load_notes()
        .await
        .map_err(|e| BlinkError::Storage(e))
}

async fn load_detached_windows(
) -> BlinkResult<std::collections::HashMap<String, crate::types::window::DetachedWindow>> {
    load_detached_windows_from_disk_storage()
        .await
        .map_err(|e| BlinkError::Storage(e))
}

async fn update_notes_state(
    app_handle: &AppHandle,
    notes: std::collections::HashMap<String, crate::types::note::Note>,
) -> BlinkResult<()> {
    if let Some(notes_state) = app_handle.try_state::<NotesState>() {
        let mut notes_lock = notes_state.lock().await;
        let notes_count = notes.len();
        *notes_lock = notes;
        log_info!("STARTUP", "✅ Loaded {} notes", notes_count);

        // Initialize modified state tracker for all loaded notes
        if let Some(modified_tracker) = app_handle.try_state::<ModifiedStateTrackerState>() {
            for note in notes_lock.values() {
                modified_tracker.initialize_note(note).await;
            }
            log_info!(
                "STARTUP",
                "✅ Initialized modified state tracking for {} notes",
                notes_count
            );
        }
    }
    Ok(())
}

async fn update_windows_state(
    app_handle: &AppHandle,
    windows: std::collections::HashMap<String, crate::types::window::DetachedWindow>,
) -> BlinkResult<()> {
    if let Some(windows_state) = app_handle.try_state::<DetachedWindowsState>() {
        let mut windows_lock = windows_state.lock().await;
        let windows_count = windows.len();
        *windows_lock = windows;
        log_info!("STARTUP", "✅ Loaded {} detached windows", windows_count);
    }
    Ok(())
}