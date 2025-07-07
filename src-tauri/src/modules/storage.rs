use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use tauri::State;

use crate::types::{
    note::Note,
    config::AppConfig,
    window::{DetachedWindow, ConfigState, DetachedWindowsState},
};
use crate::{log_debug, log_info};

/// Save notes to disk as JSON
pub async fn save_notes_to_disk(notes: &HashMap<String, Note>) -> Result<(), String> {
    let notes_dir = get_notes_directory()?;
    fs::create_dir_all(&notes_dir).map_err(|e| format!("Failed to create notes directory: {}", e))?;
    
    let notes_file = notes_dir.join("notes.json");
    let notes_json = serde_json::to_string_pretty(notes)
        .map_err(|e| format!("Failed to serialize notes: {}", e))?;
    
    fs::write(notes_file, notes_json)
        .map_err(|e| format!("Failed to write notes to disk: {}", e))?;
    
    Ok(())
}

/// Load notes from disk
pub async fn load_notes_from_disk() -> Result<HashMap<String, Note>, String> {
    let notes_dir = get_notes_directory()?;
    let notes_file = notes_dir.join("notes.json");
    
    if !notes_file.exists() {
        return Ok(HashMap::new());
    }
    
    let notes_json = fs::read_to_string(notes_file)
        .map_err(|e| format!("Failed to read notes from disk: {}", e))?;
    
    let notes: HashMap<String, Note> = serde_json::from_str(&notes_json)
        .map_err(|e| format!("Failed to parse notes JSON: {}", e))?;
    
    Ok(notes)
}

/// Save app configuration to disk
pub async fn save_config_to_disk(config: &AppConfig) -> Result<(), String> {
    let notes_dir = get_notes_directory()?;
    fs::create_dir_all(&notes_dir).map_err(|e| format!("Failed to create notes directory: {}", e))?;
    
    let config_file = notes_dir.join("config.json");
    let config_json = serde_json::to_string_pretty(config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;
    
    fs::write(config_file, config_json)
        .map_err(|e| format!("Failed to write config to disk: {}", e))?;
    
    log_debug!("CONFIG", "Config saved to disk");
    Ok(())
}

/// Load app configuration from disk
pub async fn load_config_from_disk() -> Result<AppConfig, String> {
    let notes_dir = get_notes_directory()?;
    let config_file = notes_dir.join("config.json");
    
    if !config_file.exists() {
        log_debug!("CONFIG", "No config file found, using defaults");
        return Ok(AppConfig::default());
    }
    
    let config_json = fs::read_to_string(config_file)
        .map_err(|e| format!("Failed to read config from disk: {}", e))?;
    
    let config: AppConfig = serde_json::from_str(&config_json)
        .map_err(|e| format!("Failed to parse config JSON: {}", e))?;
    
    log_debug!("CONFIG", "Config loaded from disk");
    Ok(config)
}

/// Save detached windows state to disk
pub async fn save_detached_windows_to_disk(windows: &HashMap<String, DetachedWindow>) -> Result<(), String> {
    let notes_dir = get_notes_directory()?;
    fs::create_dir_all(&notes_dir).map_err(|e| format!("Failed to create notes directory: {}", e))?;
    
    let windows_file = notes_dir.join("detached_windows.json");
    let windows_json = serde_json::to_string_pretty(windows)
        .map_err(|e| format!("Failed to serialize detached windows: {}", e))?;
    
    fs::write(windows_file, windows_json)
        .map_err(|e| format!("Failed to write detached windows to disk: {}", e))?;
    
    Ok(())
}

/// Load detached windows state from disk
pub async fn load_detached_windows_from_disk() -> Result<HashMap<String, DetachedWindow>, String> {
    let notes_dir = get_notes_directory()?;
    let windows_file = notes_dir.join("detached_windows.json");
    
    if !windows_file.exists() {
        return Ok(HashMap::new());
    }
    
    let windows_json = fs::read_to_string(windows_file)
        .map_err(|e| format!("Failed to read detached windows from disk: {}", e))?;
    
    let windows: HashMap<String, DetachedWindow> = serde_json::from_str(&windows_json)
        .map_err(|e| format!("Failed to parse detached windows JSON: {}", e))?;
    
    Ok(windows)
}

/// Get the notes directory path
fn get_notes_directory() -> Result<PathBuf, String> {
    get_default_notes_directory()
}

/// Get the default notes directory path
pub fn get_default_notes_directory() -> Result<PathBuf, String> {
    // Always use app data directory to avoid restart loops in development
    let data_dir = if cfg!(debug_assertions) {
        // Development: use app data directory with dev suffix
        dirs::data_dir()
            .ok_or_else(|| "Failed to get data directory".to_string())?
            .join("com.blink.dev")
            .join("data")
    } else {
        // Production: use app data directory
        dirs::data_dir()
            .ok_or_else(|| "Failed to get data directory".to_string())?
            .join("com.blink.dev")
            .join("data")
    };
    
    log_debug!("STORAGE", "Default data directory path: {:?}", data_dir);
    Ok(data_dir)
}

/// Get the configured notes directory (with custom directory support)
pub fn get_configured_notes_directory(config: &AppConfig) -> Result<PathBuf, String> {
    if config.storage.use_custom_directory {
        if let Some(custom_dir) = &config.storage.notes_directory {
            let path = PathBuf::from(custom_dir);
            log_debug!("STORAGE", "Using custom notes directory: {:?}", path);
            return Ok(path);
        }
    }
    
    // Fall back to default directory
    get_default_notes_directory()
}

// Configuration management commands
#[tauri::command]
pub async fn get_config(config: State<'_, ConfigState>) -> Result<AppConfig, String> {
    let config_lock = config.lock().await;
    Ok(config_lock.clone())
}

#[tauri::command]
pub async fn update_config(
    new_config: AppConfig,
    config: State<'_, ConfigState>,
) -> Result<(), String> {
    let mut config_lock = config.lock().await;
    *config_lock = new_config.clone();
    save_config_to_disk(&new_config).await?;
    log_info!("CONFIG", "Configuration updated");
    Ok(())
}

#[tauri::command]
pub async fn get_detached_windows(
    windows: State<'_, DetachedWindowsState>,
) -> Result<HashMap<String, DetachedWindow>, String> {
    let windows_lock = windows.lock().await;
    Ok(windows_lock.clone())
}