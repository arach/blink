use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{Emitter, Manager, State, WebviewUrl, WebviewWindowBuilder};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri_plugin_global_shortcut::GlobalShortcutExt;
use tokio::sync::Mutex;
use uuid::Uuid;
use regex::Regex;
// File watching imports - will be used when implementing file watching
// use notify::{RecommendedWatcher, RecursiveMode, Watcher};
// use std::sync::mpsc::channel;

// Module declarations
mod types;
mod modules;
mod services;

// Re-export from modules
pub use modules::{
    logging::*,
    commands::*,
    storage::*,
    windows::*,
};

use modules::logging::init_file_logging;

// Re-export from types
pub use types::{
    note::*,
    config::*,
    window::*,
};








type NotesState = Mutex<HashMap<String, Note>>;
type ConfigState = Mutex<AppConfig>;
type DetachedWindowsState = Mutex<HashMap<String, DetachedWindow>>;
type ToggleState = Mutex<bool>;






// File-based note operations

#[tauri::command]
async fn import_notes_from_directory(
    directory_path: String,
    notes: State<'_, NotesState>,
) -> Result<Vec<Note>, String> {
    log_info!("FILE_IMPORT", "Importing notes from directory: {}", directory_path);
    
    let mut imported_notes = Vec::new();
    let mut notes_lock = notes.lock().await;
    
    let dir_path = Path::new(&directory_path);
    if !dir_path.exists() {
        return Err("Directory does not exist".to_string());
    }
    
    // Read all markdown files in the directory
    let entries = fs::read_dir(dir_path)
        .map_err(|e| format!("Failed to read directory: {}", e))?;
    
    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let path = entry.path();
        
        if path.extension().and_then(|s| s.to_str()) == Some("md") {
            match parse_markdown_file(&path).await {
                Ok(note) => {
                    log_info!("FILE_IMPORT", "Imported note: {} from {}", note.title, path.display());
                    notes_lock.insert(note.id.clone(), note.clone());
                    imported_notes.push(note);
                },
                Err(e) => {
                    log_error!("FILE_IMPORT", "Failed to import {}: {}", path.display(), e);
                }
            }
        }
    }
    
    // Save updated notes to disk
    save_notes_to_disk(&notes_lock).await?;
    
    log_info!("FILE_IMPORT", "Successfully imported {} notes", imported_notes.len());
    Ok(imported_notes)
}

#[tauri::command]
async fn import_single_file(
    file_path: String,
    notes: State<'_, NotesState>,
) -> Result<Note, String> {
    log_info!("FILE_IMPORT", "Importing single file: {}", file_path);
    
    let path = Path::new(&file_path);
    if !path.exists() {
        return Err("File does not exist".to_string());
    }
    
    let note = parse_markdown_file(path).await?;
    
    let mut notes_lock = notes.lock().await;
    notes_lock.insert(note.id.clone(), note.clone());
    save_notes_to_disk(&notes_lock).await?;
    
    log_info!("FILE_IMPORT", "Successfully imported note: {}", note.title);
    Ok(note)
}

#[tauri::command]
async fn export_note_to_file(
    note_id: String,
    file_path: String,
    notes: State<'_, NotesState>,
) -> Result<(), String> {
    log_info!("FILE_EXPORT", "Exporting note {} to {}", note_id, file_path);
    
    let notes_lock = notes.lock().await;
    let note = notes_lock.get(&note_id)
        .ok_or("Note not found")?;
    
    write_note_to_file(note, &file_path).await?;
    
    log_info!("FILE_EXPORT", "Successfully exported note to {}", file_path);
    Ok(())
}

#[tauri::command]
async fn export_all_notes_to_directory(
    directory_path: String,
    notes: State<'_, NotesState>,
) -> Result<Vec<String>, String> {
    log_info!("FILE_EXPORT", "Exporting all notes to directory: {}", directory_path);
    
    let dir_path = Path::new(&directory_path);
    fs::create_dir_all(dir_path)
        .map_err(|e| format!("Failed to create directory: {}", e))?;
    
    let notes_lock = notes.lock().await;
    let mut exported_files = Vec::new();
    
    for note in notes_lock.values() {
        let safe_title = sanitize_filename(&note.title);
        let file_name = if safe_title.is_empty() {
            format!("{}.md", note.id)
        } else {
            format!("{}.md", safe_title)
        };
        
        let file_path = dir_path.join(&file_name);
        
        match write_note_to_file(note, file_path.to_str().unwrap()).await {
            Ok(_) => {
                exported_files.push(file_name);
                log_info!("FILE_EXPORT", "Exported note: {}", note.title);
            },
            Err(e) => {
                log_error!("FILE_EXPORT", "Failed to export {}: {}", note.title, e);
            }
        }
    }
    
    log_info!("FILE_EXPORT", "Successfully exported {} notes", exported_files.len());
    Ok(exported_files)
}

#[tauri::command]
async fn set_notes_directory(
    directory_path: String,
    config: State<'_, ConfigState>,
) -> Result<(), String> {
    log_info!("STORAGE", "Setting notes directory to: {}", directory_path);
    
    let path = PathBuf::from(&directory_path);
    if !path.exists() {
        return Err("Directory does not exist".to_string());
    }
    
    if !path.is_dir() {
        return Err("Path is not a directory".to_string());
    }
    
    let mut config_lock = config.lock().await;
    config_lock.storage.notes_directory = Some(directory_path);
    config_lock.storage.use_custom_directory = true;
    
    let config_clone = config_lock.clone();
    drop(config_lock);
    
    save_config_to_disk(&config_clone).await?;
    
    log_info!("STORAGE", "Notes directory updated successfully");
    Ok(())
}

#[tauri::command]
async fn reload_notes_from_directory(
    config: State<'_, ConfigState>,
    notes: State<'_, NotesState>,
) -> Result<Vec<Note>, String> {
    log_info!("STORAGE", "Reloading notes from configured directory");
    
    let config_lock = config.lock().await;
    let notes_dir = get_configured_notes_directory(&config_lock)?;
    drop(config_lock);
    
    let mut loaded_notes = Vec::new();
    let mut notes_lock = notes.lock().await;
    
    // Clear existing notes
    notes_lock.clear();
    
    // Load all markdown files from the configured directory
    if notes_dir.exists() {
        let entries = fs::read_dir(&notes_dir)
            .map_err(|e| format!("Failed to read notes directory: {}", e))?;
        
        for entry in entries {
            let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
            let path = entry.path();
            
            if path.extension().and_then(|s| s.to_str()) == Some("md") {
                match parse_markdown_file(&path).await {
                    Ok(note) => {
                        log_info!("STORAGE", "Loaded note: {} from {}", note.title, path.display());
                        notes_lock.insert(note.id.clone(), note.clone());
                        loaded_notes.push(note);
                    },
                    Err(e) => {
                        log_error!("STORAGE", "Failed to load {}: {}", path.display(), e);
                    }
                }
            }
        }
    }
    
    // Also save to JSON for compatibility
    save_notes_to_disk(&notes_lock).await?;
    
    log_info!("STORAGE", "Successfully loaded {} notes from directory", loaded_notes.len());
    Ok(loaded_notes)
}

#[tauri::command]
async fn get_current_notes_directory(config: State<'_, ConfigState>) -> Result<String, String> {
    let config_lock = config.lock().await;
    let notes_dir = get_configured_notes_directory(&config_lock)?;
    Ok(notes_dir.to_string_lossy().to_string())
}

// Helper functions for file operations
async fn parse_markdown_file(path: &Path) -> Result<Note, String> {
    let content = fs::read_to_string(path)
        .map_err(|e| format!("Failed to read file: {}", e))?;
    
    // Check if file has frontmatter
    if content.starts_with("---\n") {
        parse_markdown_with_frontmatter(&content)
    } else {
        // Plain markdown file - create note from filename and content
        let title = path.file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("Untitled")
            .to_string();
        
        let now = chrono::Utc::now().to_rfc3339();
        Ok(Note {
            id: Uuid::new_v4().to_string(),
            title,
            content,
            created_at: now.clone(),
            updated_at: now,
            tags: vec![],
        })
    }
}

fn parse_markdown_with_frontmatter(content: &str) -> Result<Note, String> {
    let re = Regex::new(r"(?s)^---\n(.*?)\n---\n(.*)$")
        .map_err(|e| format!("Regex error: {}", e))?;
    
    let captures = re.captures(content)
        .ok_or("Invalid frontmatter format")?;
    
    let frontmatter_str = captures.get(1)
        .ok_or("No frontmatter found")?
        .as_str();
    
    let body = captures.get(2)
        .ok_or("No body found")?
        .as_str();
    
    let frontmatter: NoteFrontmatter = serde_yaml::from_str(frontmatter_str)
        .map_err(|e| format!("Failed to parse frontmatter: {}", e))?;
    
    Ok(Note {
        id: frontmatter.id,
        title: frontmatter.title,
        content: body.to_string(),
        created_at: frontmatter.created_at,
        updated_at: frontmatter.updated_at,
        tags: frontmatter.tags,
    })
}

async fn write_note_to_file(note: &Note, file_path: &str) -> Result<(), String> {
    let frontmatter = NoteFrontmatter {
        id: note.id.clone(),
        title: note.title.clone(),
        created_at: note.created_at.clone(),
        updated_at: note.updated_at.clone(),
        tags: note.tags.clone(),
    };
    
    let frontmatter_yaml = serde_yaml::to_string(&frontmatter)
        .map_err(|e| format!("Failed to serialize frontmatter: {}", e))?;
    
    let full_content = format!("---\n{}---\n\n{}", frontmatter_yaml, note.content);
    
    fs::write(file_path, full_content)
        .map_err(|e| format!("Failed to write file: {}", e))?;
    
    Ok(())
}

fn sanitize_filename(title: &str) -> String {
    let re = Regex::new(r"[^a-zA-Z0-9\s\-_]").unwrap();
    re.replace_all(title, "")
        .trim()
        .replace(" ", "-")
        .to_lowercase()
}







#[tauri::command]
async fn open_system_settings() -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg("x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility")
            .spawn()
            .map_err(|e| format!("Failed to open System Settings: {}", e))?;
    }
    
    #[cfg(not(target_os = "macos"))]
    {
        return Err("System Settings only available on macOS".to_string());
    }
    
    Ok(())
}

#[tauri::command]
async fn open_directory_in_finder(directory_path: String) -> Result<(), String> {
    log_info!("FINDER", "Opening directory in Finder: {}", directory_path);
    
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&directory_path)
            .spawn()
            .map_err(|e| format!("Failed to open directory in Finder: {}", e))?;
        
        log_info!("FINDER", "Successfully opened directory in Finder");
        Ok(())
    }
    
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&directory_path)
            .spawn()
            .map_err(|e| format!("Failed to open directory in Explorer: {}", e))?;
        
        log_info!("FINDER", "Successfully opened directory in Explorer");
        Ok(())
    }
    
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        // Linux and other platforms - try xdg-open
        std::process::Command::new("xdg-open")
            .arg(&directory_path)
            .spawn()
            .map_err(|e| format!("Failed to open directory: {}", e))?;
        
        log_info!("FINDER", "Successfully opened directory with xdg-open");
        Ok(())
    }
}

#[tauri::command]
async fn open_directory_dialog(app: tauri::AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    use tokio::sync::oneshot;
    
    log_info!("DIRECTORY", "Opening native directory picker dialog");
    
    // Use channel for proper async handling
    let (tx, rx) = oneshot::channel();
    
    // Use callback-based API since pick_folder is not async
    app.dialog()
        .file()
        .set_title("Select Notes Directory")
        .pick_folder(move |folder_path| {
            let result = folder_path.map(|path| path.to_string());
            let _ = tx.send(result); // Ignore send errors (receiver might be dropped)
        });
    
    // Wait for the dialog result
    match rx.await {
        Ok(result) => {
            match result {
                Some(path) => {
                    log_info!("DIRECTORY", "Selected directory: {}", path);
                    Ok(Some(path))
                },
                None => {
                    log_info!("DIRECTORY", "User canceled directory selection");
                    Ok(None)
                }
            }
        },
        Err(_) => {
            log_error!("DIRECTORY", "Dialog callback channel was closed unexpectedly");
            Err("Dialog was closed unexpectedly".to_string())
        }
    }
}

#[tauri::command]
async fn test_emit_new_note(app: tauri::AppHandle) -> Result<String, String> {
    log_info!("TEST", "Testing emit menu-new-note event manually...");
    
    match app.emit("menu-new-note", ()) {
        Ok(_) => {
            log_info!("TEST", "✅ Successfully emitted menu-new-note event");
            Ok("Event emitted successfully".to_string())
        },
        Err(e) => {
            log_error!("TEST", "❌ Failed to emit menu-new-note event: {}", e);
            Err(format!("Failed to emit event: {}", e))
        }
    }
}












#[tauri::command]
async fn test_window_creation(app: tauri::AppHandle) -> Result<String, String> {
    println!("[TEST_WINDOW] Starting test window creation...");
    
    let test_label = "test-window";
    let test_url = "index.html";
    
    println!("[TEST_WINDOW] Creating window with label: {}", test_label);
    
    match WebviewWindowBuilder::new(
        &app,
        test_label,
        WebviewUrl::App(test_url.into()),
    )
    .title("Test Window")
    .inner_size(400.0, 300.0)
    .position(200.0, 200.0)
    .visible(true)
    .build() {
        Ok(window) => {
            println!("[TEST_WINDOW] Window created successfully!");
            window.show().map_err(|e| format!("Failed to show test window: {}", e))?;
            Ok("Test window created successfully!".to_string())
        }
        Err(e) => {
            println!("[TEST_WINDOW] ERROR: Failed to create window: {:?}", e);
            Err(format!("Failed to create test window: {:?}", e))
        }
    }
}







async fn save_notes_to_disk(notes: &HashMap<String, Note>) -> Result<(), String> {
    let notes_dir = get_notes_directory()?;
    fs::create_dir_all(&notes_dir).map_err(|e| format!("Failed to create notes directory: {}", e))?;
    
    let notes_file = notes_dir.join("notes.json");
    let notes_json = serde_json::to_string_pretty(notes)
        .map_err(|e| format!("Failed to serialize notes: {}", e))?;
    
    fs::write(notes_file, notes_json)
        .map_err(|e| format!("Failed to write notes to disk: {}", e))?;
    
    Ok(())
}

async fn load_notes_from_disk() -> Result<HashMap<String, Note>, String> {
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

fn get_notes_directory() -> Result<PathBuf, String> {
    get_default_notes_directory()
}

fn get_default_notes_directory() -> Result<PathBuf, String> {
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

fn get_configured_notes_directory(config: &AppConfig) -> Result<PathBuf, String> {
    if config.storage.use_custom_directory {
        if let Some(custom_dir) = &config.storage.notes_directory {
            let path = PathBuf::from(custom_dir);
            if path.exists() && path.is_dir() {
                log_debug!("STORAGE", "Using custom notes directory: {:?}", path);
                return Ok(path);
            } else {
                log_error!("STORAGE", "Custom directory does not exist or is not a directory: {:?}", path);
                // Fall back to default
            }
        }
    }
    
    // Use default directory
    get_default_notes_directory()
}

async fn save_config_to_disk(config: &AppConfig) -> Result<(), String> {
    let notes_dir = get_notes_directory()?;
    fs::create_dir_all(&notes_dir).map_err(|e| format!("Failed to create notes directory: {}", e))?;
    
    let config_file = notes_dir.join("config.json");
    let config_json = serde_json::to_string_pretty(config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;
    
    fs::write(config_file, config_json)
        .map_err(|e| format!("Failed to write config to disk: {}", e))?;
    
    Ok(())
}

async fn load_config_from_disk() -> Result<AppConfig, String> {
    let notes_dir = get_notes_directory()?;
    let config_file = notes_dir.join("config.json");
    
    if !config_file.exists() {
        // println!("Config file not found, creating default config");
        let default_config = AppConfig::default();
        save_config_to_disk(&default_config).await?;
        return Ok(default_config);
    }
    
    let config_json = fs::read_to_string(&config_file)
        .map_err(|e| format!("Failed to read config from disk: {}", e))?;
    
    // println!("Loaded config JSON from disk: {}", config_json);
    
    let config: AppConfig = serde_json::from_str(&config_json)
        .map_err(|e| format!("Failed to parse config JSON: {}", e))?;
    
    // println!("Parsed config: opacity={}, alwaysOnTop={}", config.opacity, config.always_on_top);
    
    Ok(config)
}

async fn save_detached_windows_to_disk(windows: &HashMap<String, DetachedWindow>) -> Result<(), String> {
    let notes_dir = get_notes_directory()?;
    fs::create_dir_all(&notes_dir).map_err(|e| format!("Failed to create notes directory: {}", e))?;
    
    let windows_file = notes_dir.join("detached_windows.json");
    let windows_json = serde_json::to_string_pretty(windows)
        .map_err(|e| format!("Failed to serialize windows: {}", e))?;
    
    fs::write(windows_file, windows_json)
        .map_err(|e| format!("Failed to write windows to disk: {}", e))?;
    
    Ok(())
}

// Function removed - using the one from modules::storage instead

// Spatial positioning functions
async fn load_spatial_data(note_id: &str) -> Option<DetachedWindow> {
    let notes_dir = get_notes_directory().ok()?;
    let spatial_file = notes_dir.join("spatial_positions.json");
    
    if !spatial_file.exists() {
        return None;
    }
    
    let spatial_json = fs::read_to_string(spatial_file).ok()?;
    let spatial_data: HashMap<String, DetachedWindow> = serde_json::from_str(&spatial_json).ok()?;
    
    spatial_data.get(note_id).cloned()
}

// Currently unused - kept for potential future use
#[allow(dead_code)]
async fn save_spatial_data(note_id: &str, window: &DetachedWindow) -> Result<(), String> {
    let notes_dir = get_notes_directory()?;
    let spatial_file = notes_dir.join("spatial_positions.json");
    
    // Load existing spatial data
    let mut spatial_data: HashMap<String, DetachedWindow> = if spatial_file.exists() {
        let spatial_json = fs::read_to_string(&spatial_file)
            .map_err(|e| format!("Failed to read spatial data: {}", e))?;
        serde_json::from_str(&spatial_json)
            .map_err(|e| format!("Failed to parse spatial data: {}", e))?
    } else {
        HashMap::new()
    };
    
    // Update with new data
    spatial_data.insert(note_id.to_string(), window.clone());
    
    // Save back to disk
    let spatial_json = serde_json::to_string_pretty(&spatial_data)
        .map_err(|e| format!("Failed to serialize spatial data: {}", e))?;
    
    fs::write(spatial_file, spatial_json)
        .map_err(|e| format!("Failed to write spatial data: {}", e))?;
    
    Ok(())
}

fn build_app_menu(app: &tauri::AppHandle, detached_windows: &HashMap<String, DetachedWindow>, notes: &HashMap<String, Note>) -> Result<Menu<tauri::Wry>, String> {
    let menu = Menu::new(app).map_err(|e| e.to_string())?;
    
    // App menu
    let app_menu = Submenu::new(app, "Blink", true).map_err(|e| e.to_string())?;
    let about_item = MenuItem::new(app, "About Blink", true, None::<&str>).map_err(|e| e.to_string())?;
    let separator = PredefinedMenuItem::separator(app).map_err(|e| e.to_string())?;
    let services_item = MenuItem::new(app, "Services", true, None::<&str>).map_err(|e| e.to_string())?;
    let separator2 = PredefinedMenuItem::separator(app).map_err(|e| e.to_string())?;
    let hide_item = MenuItem::new(app, "Hide Blink", true, Some("Cmd+H")).map_err(|e| e.to_string())?;
    let hide_others_item = MenuItem::new(app, "Hide Others", true, Some("Cmd+Alt+H")).map_err(|e| e.to_string())?;
    let show_all_item = MenuItem::new(app, "Show All", true, None::<&str>).map_err(|e| e.to_string())?;
    let separator3 = PredefinedMenuItem::separator(app).map_err(|e| e.to_string())?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit Blink", true, Some("Cmd+Q")).map_err(|e| e.to_string())?;
    
    app_menu.append(&about_item).map_err(|e| e.to_string())?;
    app_menu.append(&separator).map_err(|e| e.to_string())?;
    app_menu.append(&services_item).map_err(|e| e.to_string())?;
    app_menu.append(&separator2).map_err(|e| e.to_string())?;
    app_menu.append(&hide_item).map_err(|e| e.to_string())?;
    app_menu.append(&hide_others_item).map_err(|e| e.to_string())?;
    app_menu.append(&show_all_item).map_err(|e| e.to_string())?;
    app_menu.append(&separator3).map_err(|e| e.to_string())?;
    app_menu.append(&quit_item).map_err(|e| e.to_string())?;
    
    // Edit menu
    let edit_menu = Submenu::new(app, "Edit", true).map_err(|e| e.to_string())?;
    let undo_item = MenuItem::new(app, "Undo", true, Some("Cmd+Z")).map_err(|e| e.to_string())?;
    let redo_item = MenuItem::new(app, "Redo", true, Some("Cmd+Shift+Z")).map_err(|e| e.to_string())?;
    let separator4 = PredefinedMenuItem::separator(app).map_err(|e| e.to_string())?;
    let cut_item = MenuItem::new(app, "Cut", true, Some("Cmd+X")).map_err(|e| e.to_string())?;
    let copy_item = MenuItem::new(app, "Copy", true, Some("Cmd+C")).map_err(|e| e.to_string())?;
    let paste_item = MenuItem::new(app, "Paste", true, Some("Cmd+V")).map_err(|e| e.to_string())?;
    let select_all_item = MenuItem::new(app, "Select All", true, Some("Cmd+A")).map_err(|e| e.to_string())?;
    
    edit_menu.append(&undo_item).map_err(|e| e.to_string())?;
    edit_menu.append(&redo_item).map_err(|e| e.to_string())?;
    edit_menu.append(&separator4).map_err(|e| e.to_string())?;
    edit_menu.append(&cut_item).map_err(|e| e.to_string())?;
    edit_menu.append(&copy_item).map_err(|e| e.to_string())?;
    edit_menu.append(&paste_item).map_err(|e| e.to_string())?;
    edit_menu.append(&select_all_item).map_err(|e| e.to_string())?;
    
    // Notes menu
    let notes_menu = Submenu::new(app, "Notes", true).map_err(|e| e.to_string())?;
    let new_note_item = MenuItem::with_id(app, "new-note", "New Note", true, Some("Cmd+Ctrl+Alt+Shift+N")).map_err(|e| e.to_string())?;
    let separator5 = PredefinedMenuItem::separator(app).map_err(|e| e.to_string())?;
    let show_main_window_item = MenuItem::with_id(app, "show-main-window", "Show Main Window", true, None::<&str>).map_err(|e| e.to_string())?;
    let separator5b = PredefinedMenuItem::separator(app).map_err(|e| e.to_string())?;
    
    notes_menu.append(&new_note_item).map_err(|e| e.to_string())?;
    notes_menu.append(&separator5).map_err(|e| e.to_string())?;
    notes_menu.append(&show_main_window_item).map_err(|e| e.to_string())?;
    notes_menu.append(&separator5b).map_err(|e| e.to_string())?;
    
    // Add all notes to the menu
    let mut notes_vec: Vec<(&String, &Note)> = notes.iter().collect();
    notes_vec.sort_by(|a, b| b.1.updated_at.cmp(&a.1.updated_at));
    
    for (note_id, note) in notes_vec.iter() {
        let is_open = detached_windows.values().any(|w| &w.note_id == *note_id);
        let title = if note.title.is_empty() {
            "Untitled Note".to_string()
        } else {
            note.title.clone()
        };
        let menu_title = if is_open {
            format!("• {}", title)
        } else {
            format!("  {}", title)
        };
        let item = MenuItem::with_id(app, format!("open-note-{}", note_id), menu_title, true, None::<&str>).map_err(|e| e.to_string())?;
        notes_menu.append(&item).map_err(|e| e.to_string())?;
    }
    
    // Developer menu (for debugging and development)
    let developer_menu = Submenu::new(app, "Developer", true).map_err(|e| e.to_string())?;
    let reload_app_item = MenuItem::with_id(app, "reload-app", "Reload App", true, Some("Cmd+R")).map_err(|e| e.to_string())?;
    let restart_app_item = MenuItem::with_id(app, "restart-app", "Restart App", true, Some("Cmd+Shift+R")).map_err(|e| e.to_string())?;
    let dev_separator = PredefinedMenuItem::separator(app).map_err(|e| e.to_string())?;
    let force_main_visible_item = MenuItem::with_id(app, "force-main-visible", "Force Main Window Visible", true, None::<&str>).map_err(|e| e.to_string())?;
    
    developer_menu.append(&reload_app_item).map_err(|e| e.to_string())?;
    developer_menu.append(&restart_app_item).map_err(|e| e.to_string())?;
    developer_menu.append(&dev_separator).map_err(|e| e.to_string())?;
    developer_menu.append(&force_main_visible_item).map_err(|e| e.to_string())?;
    
    // Window menu (standard macOS menu)
    let window_menu = Submenu::new(app, "Window", true).map_err(|e| e.to_string())?;
    let minimize_item = MenuItem::with_id(app, "minimize", "Minimize", true, Some("Cmd+M")).map_err(|e| e.to_string())?;
    let zoom_item = MenuItem::new(app, "Zoom", true, None::<&str>).map_err(|e| e.to_string())?;
    let separator6 = PredefinedMenuItem::separator(app).map_err(|e| e.to_string())?;
    
    // Tiling options (macOS 11+)
    let tile_left = MenuItem::new(app, "Tile Window to Left of Screen", true, None::<&str>).map_err(|e| e.to_string())?;
    let tile_right = MenuItem::new(app, "Tile Window to Right of Screen", true, None::<&str>).map_err(|e| e.to_string())?;
    let replace_tiled = MenuItem::new(app, "Replace Tiled Window", true, None::<&str>).map_err(|e| e.to_string())?;
    let separator7 = PredefinedMenuItem::separator(app).map_err(|e| e.to_string())?;
    
    let remove_from_stage = MenuItem::new(app, "Remove Window from Set", true, None::<&str>).map_err(|e| e.to_string())?;
    let separator8 = PredefinedMenuItem::separator(app).map_err(|e| e.to_string())?;
    
    let bring_all_to_front = MenuItem::new(app, "Bring All to Front", true, None::<&str>).map_err(|e| e.to_string())?;
    
    window_menu.append(&minimize_item).map_err(|e| e.to_string())?;
    window_menu.append(&zoom_item).map_err(|e| e.to_string())?;
    window_menu.append(&separator6).map_err(|e| e.to_string())?;
    window_menu.append(&tile_left).map_err(|e| e.to_string())?;
    window_menu.append(&tile_right).map_err(|e| e.to_string())?;
    window_menu.append(&replace_tiled).map_err(|e| e.to_string())?;
    window_menu.append(&separator7).map_err(|e| e.to_string())?;
    window_menu.append(&remove_from_stage).map_err(|e| e.to_string())?;
    window_menu.append(&separator8).map_err(|e| e.to_string())?;
    window_menu.append(&bring_all_to_front).map_err(|e| e.to_string())?;
    
    menu.append(&app_menu).map_err(|e| e.to_string())?;
    menu.append(&edit_menu).map_err(|e| e.to_string())?;
    menu.append(&notes_menu).map_err(|e| e.to_string())?;
    menu.append(&developer_menu).map_err(|e| e.to_string())?;
    menu.append(&window_menu).map_err(|e| e.to_string())?;
    
    Ok(menu)
}

#[tauri::command]
async fn update_app_menu(
    app: tauri::AppHandle,
    detached_windows: State<'_, DetachedWindowsState>,
    notes: State<'_, NotesState>,
) -> Result<(), String> {
    let windows_lock = detached_windows.lock().await;
    let notes_lock = notes.lock().await;
    
    let menu = build_app_menu(&app, &*windows_lock, &*notes_lock)?;
    app.set_menu(menu).map_err(|e| format!("Failed to update menu: {}", e))?;
    
    Ok(())
}

#[tauri::command]
async fn reregister_global_shortcuts(app: tauri::AppHandle) -> Result<String, String> {
    use tauri_plugin_global_shortcut::{Code, Modifiers, Shortcut};
    
    log_info!("SHORTCUT", "Re-registering global shortcuts...");
    
    let shortcut_manager = app.global_shortcut();
    
    // Define the shortcuts
    let hyperkey_n = Shortcut::new(
        Some(Modifiers::SUPER | Modifiers::CONTROL | Modifiers::ALT | Modifiers::SHIFT),
        Code::KeyN
    );
    
    let hyperkey_h = Shortcut::new(
        Some(Modifiers::SUPER | Modifiers::CONTROL | Modifiers::ALT | Modifiers::SHIFT),
        Code::KeyH
    );
    
    log_debug!("SHORTCUT", "Created shortcut objects: Hyperkey+N and Hyperkey+H");
    
    // Unregister and re-register Hyperkey+N
    match shortcut_manager.unregister(hyperkey_n.clone()) {
        Ok(_) => log_info!("SHORTCUT", "Unregistered existing Hyperkey+N"),
        Err(e) => log_debug!("SHORTCUT", "No existing Hyperkey+N to unregister: {}", e),
    };
    
    let mut results = Vec::new();
    
    match shortcut_manager.register(hyperkey_n) {
        Ok(_) => {
            log_info!("SHORTCUT", "✅ Successfully registered Hyperkey+N");
            results.push("Hyperkey+N (⌘⌃⌥⇧N) registered".to_string());
        },
        Err(e) => {
            log_error!("SHORTCUT", "❌ Failed to register Hyperkey+N: {}", e);
            results.push(format!("Hyperkey+N failed: {}", e));
        }
    }
    
    // Unregister and re-register Hyperkey+H
    match shortcut_manager.unregister(hyperkey_h.clone()) {
        Ok(_) => log_info!("SHORTCUT", "Unregistered existing Hyperkey+H"),
        Err(e) => log_debug!("SHORTCUT", "No existing Hyperkey+H to unregister: {}", e),
    };
    
    match shortcut_manager.register(hyperkey_h) {
        Ok(_) => {
            log_info!("SHORTCUT", "✅ Successfully registered Hyperkey+H");
            results.push("Hyperkey+H (⌘⌃⌥⇧H) registered".to_string());
        },
        Err(e) => {
            log_error!("SHORTCUT", "❌ Failed to register Hyperkey+H: {}", e);
            results.push(format!("Hyperkey+H failed: {}", e));
        }
    }
    
    if results.iter().any(|r| r.contains("failed")) {
        Err(results.join("; "))
    } else {
        Ok(results.join("; "))
    }
}

// Currently unused - position tracking handled by frontend with debouncing
#[allow(dead_code)]
async fn save_window_position(note_id: String, x: f64, y: f64) -> Result<(), String> {
    if let Some(mut window_data) = load_spatial_data(&note_id).await {
        window_data.position = (x, y);
        save_spatial_data(&note_id, &window_data).await?;
    } else {
        // Create new spatial data if none exists
        let window_data = DetachedWindow {
            note_id: note_id.clone(),
            window_label: format!("note-{}", note_id),
            position: (x, y),
            size: (800.0, 600.0), // Default size
            always_on_top: false,
            opacity: 1.0,
            is_shaded: false,
            original_height: None,
        };
        save_spatial_data(&note_id, &window_data).await?;
    }
    Ok(())
}

// Currently unused - size tracking handled by frontend with debouncing
#[allow(dead_code)]
async fn save_window_size(note_id: String, width: f64, height: f64) -> Result<(), String> {
    if let Some(mut window_data) = load_spatial_data(&note_id).await {
        window_data.size = (width, height);
        save_spatial_data(&note_id, &window_data).await?;
    } else {
        // Create new spatial data if none exists
        let window_data = DetachedWindow {
            note_id: note_id.clone(),
            window_label: format!("note-{}", note_id),
            position: (100.0, 100.0), // Default position
            size: (width, height),
            always_on_top: false,
            opacity: 1.0,
            is_shaded: false,
            original_height: None,
        };
        save_spatial_data(&note_id, &window_data).await?;
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize file logging
    match init_file_logging() {
        Ok(log_path) => {
            log_info!("STARTUP", "File logging initialized at: {}", log_path.display());
        },
        Err(e) => {
            eprintln!("Failed to initialize file logging: {}", e);
        }
    }
    
    let notes_state = match tauri::async_runtime::block_on(load_notes_from_disk()) {
        Ok(notes) => NotesState::new(notes),
        Err(e) => {
            eprintln!("Failed to load notes from disk: {}", e);
            NotesState::new(HashMap::new())
        }
    };

    let config_state = match tauri::async_runtime::block_on(load_config_from_disk()) {
        Ok(config) => {
            // println!("Loaded config from disk: {:?}", config);
            ConfigState::new(config)
        },
        Err(e) => {
            eprintln!("Failed to load config from disk: {}", e);
            ConfigState::new(AppConfig::default())
        }
    };

    let detached_windows_state = match tauri::async_runtime::block_on(load_detached_windows_from_disk()) {
        Ok(windows) => DetachedWindowsState::new(windows),
        Err(e) => {
            eprintln!("Failed to load detached windows from disk: {}", e);
            DetachedWindowsState::new(HashMap::new())
        }
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin({
            use tauri_plugin_global_shortcut::{Code, Modifiers, Shortcut, ShortcutState};
            
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    log_info!("SHORTCUT-HANDLER", "🎯 Global shortcut handler invoked - Event: {:?}, Shortcut: {:?}", event.state, shortcut);
                    log_debug!("SHORTCUT-HANDLER", "🔍 Raw shortcut details - mods: {:?}, key: {:?}", shortcut.mods, shortcut.key);
                    
                    // Handle Cmd+Ctrl+Alt+Shift+N (Hyperkey+N)
                    if event.state == ShortcutState::Pressed {
                        let hyperkey_n = Shortcut::new(
                            Some(Modifiers::SUPER | Modifiers::CONTROL | Modifiers::ALT | Modifiers::SHIFT),
                            Code::KeyN
                        );
                        
                        let hyperkey_h = Shortcut::new(
                            Some(Modifiers::SUPER | Modifiers::CONTROL | Modifiers::ALT | Modifiers::SHIFT),
                            Code::KeyH
                        );
                        
                        let hyperkey_w = Shortcut::new(
                            Some(Modifiers::SUPER | Modifiers::CONTROL | Modifiers::ALT | Modifiers::SHIFT),
                            Code::KeyW
                        );
                        
                        // Also check for a simpler shortcut (Cmd+Shift+N) for testing
                        let simple_shortcut = Shortcut::new(
                            Some(Modifiers::SUPER | Modifiers::SHIFT),
                            Code::KeyN
                        );
                        
                        log_debug!("SHORTCUT-HANDLER", "Checking which shortcut was pressed...");
                        
                        if shortcut == &hyperkey_n {
                            log_info!("SHORTCUT-HANDLER", "🔥 HYPERKEY+N TRIGGERED! Creating new note...");
                            // Emit event to create new note
                            match app.emit("menu-new-note", ()) {
                                Ok(_) => log_info!("SHORTCUT-HANDLER", "✅ Successfully emitted menu-new-note event"),
                                Err(e) => log_error!("SHORTCUT-HANDLER", "❌ Failed to emit menu-new-note event: {}", e),
                            }
                        } else if shortcut == &hyperkey_h {
                            log_info!("SHORTCUT-HANDLER", "🔥 HYPERKEY+H TRIGGERED! Toggling hover mode for all detached windows...");
                            // Call the toggle command directly instead of emitting an event
                            let app_handle = app.clone();
                            tauri::async_runtime::spawn(async move {
                                // Get the required states
                                let detached_windows = app_handle.state::<DetachedWindowsState>();
                                let notes = app_handle.state::<NotesState>();
                                let toggle_state = app_handle.state::<ToggleState>();
                                
                                match toggle_all_windows_hover(app_handle.clone(), detached_windows, notes, toggle_state).await {
                                    Ok(visible) => log_info!("SHORTCUT-HANDLER", "✅ Successfully toggled windows. Visible: {}", visible),
                                    Err(e) => log_error!("SHORTCUT-HANDLER", "❌ Failed to toggle windows: {}", e),
                                }
                            });
                        } else if shortcut == &hyperkey_w {
                            log_info!("SHORTCUT-HANDLER", "🔥 HYPERKEY+W TRIGGERED! Entering window chord mode...");
                            // Emit event to enter window chord mode
                            match app.emit("chord-window-mode", ()) {
                                Ok(_) => log_info!("SHORTCUT-HANDLER", "✅ Successfully emitted chord-window-mode event"),
                                Err(e) => log_error!("SHORTCUT-HANDLER", "❌ Failed to emit chord-window-mode event: {}", e),
                            }
                        } else if shortcut == &simple_shortcut {
                            log_info!("SHORTCUT-HANDLER", "🔥 CMD+SHIFT+N TRIGGERED! Creating new note...");
                            // Emit event to create new note
                            match app.emit("menu-new-note", ()) {
                                Ok(_) => log_info!("SHORTCUT-HANDLER", "✅ Successfully emitted menu-new-note event"),
                                Err(e) => log_error!("SHORTCUT-HANDLER", "❌ Failed to emit menu-new-note event: {}", e),
                            }
                        } else {
                            // Check for deploy shortcuts (Ctrl+Opt+Shift+1-9, both main row and keypad)
                            let deploy_keys = [
                                // Main number row
                                (1, Code::Digit1), (2, Code::Digit2), (3, Code::Digit3),
                                (4, Code::Digit4), (5, Code::Digit5), (6, Code::Digit6),
                                (7, Code::Digit7), (8, Code::Digit8), (9, Code::Digit9),
                                // Keypad numbers
                                (1, Code::Numpad1), (2, Code::Numpad2), (3, Code::Numpad3),
                                (4, Code::Numpad4), (5, Code::Numpad5), (6, Code::Numpad6),
                                (7, Code::Numpad7), (8, Code::Numpad8), (9, Code::Numpad9)
                            ];
                            
                            let mut handled = false;
                            for (note_index, code) in deploy_keys.iter() {
                                let deploy_shortcut = Shortcut::new(
                                    Some(Modifiers::CONTROL | Modifiers::ALT | Modifiers::SHIFT),
                                    *code
                                );
                                
                                log_debug!("SHORTCUT-HANDLER", "Comparing with Ctrl+Opt+Shift+{}: expected mods={:?}, key={:?}", 
                                    note_index, deploy_shortcut.mods, deploy_shortcut.key);
                                
                                if shortcut == &deploy_shortcut {
                                    log_info!("SHORTCUT-HANDLER", "🔥 CTRL+OPT+SHIFT+{} TRIGGERED! Deploying note window for note {}...", note_index, note_index);
                                    // Emit event with the note index (0-based for array access)
                                    match app.emit("deploy-note-window", note_index - 1) {
                                        Ok(_) => log_info!("SHORTCUT-HANDLER", "✅ Successfully emitted deploy-note-window event for note {}", note_index),
                                        Err(e) => log_error!("SHORTCUT-HANDLER", "❌ Failed to emit deploy-note-window event: {}", e),
                                    }
                                    handled = true;
                                    break;
                                }
                            }
                            
                            if !handled {
                                log_debug!("SHORTCUT-HANDLER", "Shortcut didn't match any registered patterns");
                            }
                        }
                    } else {
                        log_debug!("SHORTCUT-HANDLER", "Event state was not Pressed: {:?}", event.state);
                    }
                })
                .build()
        })
        .manage(notes_state)
        .manage(config_state)
        .manage(detached_windows_state)
        .manage(ToggleState::new(false))
        .invoke_handler(tauri::generate_handler![
            get_notes,
            get_note,
            create_note,
            update_note,
            delete_note,
            import_notes_from_directory,
            import_single_file,
            export_note_to_file,
            export_all_notes_to_directory,
            set_notes_directory,
            reload_notes_from_directory,
            get_current_notes_directory,
            get_config,
            update_config,
            toggle_window_visibility,
            set_window_opacity,
            set_window_always_on_top,
            toggle_all_windows_hover,
            open_system_settings,
            open_directory_in_finder,
            open_directory_dialog,
            test_emit_new_note,
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
            create_drag_ghost,
            update_drag_ghost_position,
            destroy_drag_ghost,
            create_hybrid_drag_window,
            show_hybrid_drag_window,
            update_hybrid_drag_position,
            close_hybrid_drag_window,
            finalize_hybrid_drag_window,
            update_app_menu,
            reregister_global_shortcuts,
            test_window_creation,
            toggle_window_shade,
            toggle_main_window_shade,
            restore_detached_windows,
            clear_all_detached_windows,
            debug_all_windows_state,
            force_all_windows_opaque,
            gather_all_windows_to_main_screen,
            recreate_missing_windows,
            test_detached_window_creation,
            get_log_file_path,
            get_recent_logs,
            get_window_state_truth,
            cleanup_destroyed_window,
            force_close_test_window,
            cleanup_stale_hybrid_windows
        ])
        .on_menu_event(|app, event| {
            let menu_id = event.id();
            
            log_info!("MENU", "Menu event received: {}", menu_id.0);
            
            // Handle quit menu item
            if menu_id.0 == "quit" {
                log_info!("MENU", "Quit menu item selected");
                app.exit(0);
            }
            // Handle minimize menu item
            else if menu_id.0 == "minimize" {
                log_info!("MENU", "Minimize menu item selected");
                // In Tauri v2, we'll minimize the main window
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.minimize();
                }
            }
            // Handle new note menu item
            else if menu_id.0 == "new-note" {
                log_info!("MENU", "New Note menu item selected - emitting menu-new-note event");
                // Emit event to create new note
                match app.emit("menu-new-note", ()) {
                    Ok(_) => log_info!("MENU", "✅ Successfully emitted menu-new-note event"),
                    Err(e) => log_error!("MENU", "❌ Failed to emit menu-new-note event: {}", e),
                }
            }
            // Handle show main window menu item
            else if menu_id.0 == "show-main-window" {
                log_info!("MENU", "Show Main Window menu item selected");
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                    let _ = window.unminimize();
                    log_info!("MENU", "✅ Main window shown and focused");
                } else {
                    log_error!("MENU", "❌ Main window not found");
                }
            }
            // Handle reload app menu item
            else if menu_id.0 == "reload-app" {
                log_info!("MENU", "Reload App menu item selected");
                if let Some(window) = app.get_webview_window("main") {
                    match window.eval("window.location.reload()") {
                        Ok(_) => log_info!("MENU", "✅ App reloaded successfully"),
                        Err(e) => log_error!("MENU", "❌ Failed to reload app: {}", e),
                    }
                } else {
                    log_error!("MENU", "❌ Main window not found for reload");
                }
            }
            // Handle restart app menu item
            else if menu_id.0 == "restart-app" {
                log_info!("MENU", "Restart App menu item selected");
                log_info!("MENU", "Restarting application...");
                app.restart();
            }
            // Handle force main window visible menu item
            else if menu_id.0 == "force-main-visible" {
                log_info!("MENU", "Force Main Window Visible menu item selected");
                let app_handle = app.clone();
                tauri::async_runtime::spawn(async move {
                    match force_main_window_visible(app_handle).await {
                        Ok(_) => log_info!("MENU", "✅ Successfully forced main window visible"),
                        Err(e) => log_error!("MENU", "❌ Failed to force main window visible: {}", e),
                    }
                });
            }
            // Handle note menu items
            else if menu_id.0.starts_with("open-note-") {
                let note_id = menu_id.0.strip_prefix("open-note-").unwrap_or("");
                let app_handle = app.clone();
                let note_id = note_id.to_string();
                
                // Open the note in a floating window
                tauri::async_runtime::spawn(async move {
                    let detached_windows = app_handle.state::<DetachedWindowsState>();
                    let windows_lock = detached_windows.lock().await;
                    
                    // Check if window already exists for this note
                    if let Some((window_label, _)) = windows_lock.iter().find(|(_, w)| w.note_id == note_id) {
                        // Window exists, just focus it
                        if let Some(window) = app_handle.get_webview_window(window_label) {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    } else {
                        // Create new window
                        drop(windows_lock);
                        let notes = app_handle.state::<NotesState>();
                        let request = CreateDetachedWindowRequest {
                            note_id: note_id.clone(),
                            x: None,
                            y: None,
                            width: None,
                            height: None,
                        };
                        let _ = create_detached_window(request, app_handle.clone(), detached_windows.clone(), notes.clone()).await;
                    }
                });
            }
        })
        .setup(|app| {
            let app_handle = app.handle().clone();
            
            // Clone all states upfront before any async operations
            let notes_state = app.state::<NotesState>().clone();
            let detached_windows_state = app.state::<DetachedWindowsState>().clone();
            let config_state = app.state::<ConfigState>().clone();
            
            // Set up initial menu
            let app_handle_for_menu = app_handle.clone();
            tauri::async_runtime::block_on(async {
                let notes_lock = notes_state.lock().await;
                let windows_lock = detached_windows_state.lock().await;
                if let Ok(menu) = build_app_menu(&app_handle_for_menu, &*windows_lock, &*notes_lock) {
                    let _ = app_handle_for_menu.set_menu(menu);
                }
            });
            
            // Register global shortcut for toggle visibility (Hyperkey+N)
            {
                use tauri_plugin_global_shortcut::{Code, Modifiers, Shortcut};
                
                log_info!("STARTUP", "🚀 Initializing global shortcuts...");
                
                // Create the shortcut object for Cmd+Ctrl+Alt+Shift+N
                let hyperkey_shortcut = Shortcut::new(
                    Some(Modifiers::SUPER | Modifiers::CONTROL | Modifiers::ALT | Modifiers::SHIFT),
                    Code::KeyN
                );
                
                log_info!("STARTUP", "Attempting to register global shortcut: Cmd+Ctrl+Alt+Shift+N");
                
                let shortcut_manager = app_handle.global_shortcut();
                
                // First, try to unregister if it exists
                let unregister_shortcut = hyperkey_shortcut.clone();
                match shortcut_manager.unregister(unregister_shortcut) {
                    Ok(_) => log_info!("STARTUP", "Unregistered existing shortcut"),
                    Err(e) => log_debug!("STARTUP", "No existing shortcut to unregister: {}", e),
                }
                
                // Now register the shortcut
                match shortcut_manager.register(hyperkey_shortcut) {
                    Ok(_) => {
                        log_info!("STARTUP", "✅ Successfully registered global shortcut: Cmd+Ctrl+Alt+Shift+N");
                        log_info!("STARTUP", "The shortcut should now create a new note from anywhere");
                        
                        // Register Hyperkey+H for hover mode
                        let hyperkey_h = Shortcut::new(
                            Some(Modifiers::SUPER | Modifiers::CONTROL | Modifiers::ALT | Modifiers::SHIFT),
                            Code::KeyH
                        );
                        
                        match shortcut_manager.register(hyperkey_h) {
                            Ok(_) => {
                                log_info!("STARTUP", "✅ Successfully registered global shortcut: Cmd+Ctrl+Alt+Shift+H (Hover mode)");
                            },
                            Err(e) => {
                                log_error!("STARTUP", "❌ Failed to register Hyperkey+H: {}", e);
                            }
                        }
                        
                        // Register Hyperkey+W for window chord mode
                        let hyperkey_w = Shortcut::new(
                            Some(Modifiers::SUPER | Modifiers::CONTROL | Modifiers::ALT | Modifiers::SHIFT),
                            Code::KeyW
                        );
                        
                        match shortcut_manager.register(hyperkey_w) {
                            Ok(_) => {
                                log_info!("STARTUP", "✅ Successfully registered global shortcut: Cmd+Ctrl+Alt+Shift+W (Window chord mode)");
                            },
                            Err(e) => {
                                log_error!("STARTUP", "❌ Failed to register Hyperkey+W: {}", e);
                            }
                        }
                        
                        // Register Ctrl+Opt+Shift+1-9 for direct note window deployment (both main numbers and keypad)
                        log_info!("STARTUP", "Registering Ctrl+Opt+Shift+1-9 for note deployment (main row + keypad)...");
                        let deploy_keys = [
                            // Main number row
                            (1, Code::Digit1), (2, Code::Digit2), (3, Code::Digit3),
                            (4, Code::Digit4), (5, Code::Digit5), (6, Code::Digit6),
                            (7, Code::Digit7), (8, Code::Digit8), (9, Code::Digit9),
                            // Keypad numbers
                            (1, Code::Numpad1), (2, Code::Numpad2), (3, Code::Numpad3),
                            (4, Code::Numpad4), (5, Code::Numpad5), (6, Code::Numpad6),
                            (7, Code::Numpad7), (8, Code::Numpad8), (9, Code::Numpad9)
                        ];
                        
                        for (note_index, code) in deploy_keys.iter() {
                            let deploy_shortcut = Shortcut::new(
                                Some(Modifiers::CONTROL | Modifiers::ALT | Modifiers::SHIFT),
                                *code
                            );
                            
                            let key_type = match *code {
                                Code::Numpad1 | Code::Numpad2 | Code::Numpad3 | Code::Numpad4 | Code::Numpad5 |
                                Code::Numpad6 | Code::Numpad7 | Code::Numpad8 | Code::Numpad9 => "keypad",
                                _ => "main"
                            };
                            
                            match shortcut_manager.register(deploy_shortcut) {
                                Ok(_) => {
                                    log_info!("STARTUP", "✅ Successfully registered Ctrl+Opt+Shift+{} ({}) for note {} deployment", note_index, key_type, note_index);
                                },
                                Err(e) => {
                                    log_error!("STARTUP", "❌ Failed to register Ctrl+Opt+Shift+{} ({}): {}", note_index, key_type, e);
                                }
                            }
                        }
                        
                        // Also register Cmd+Shift+N for testing
                        let test_shortcut = Shortcut::new(
                            Some(Modifiers::SUPER | Modifiers::SHIFT),
                            Code::KeyN
                        );
                        
                        match shortcut_manager.register(test_shortcut) {
                            Ok(_) => {
                                log_info!("STARTUP", "✅ Also registered test shortcut: Cmd+Shift+N");
                            },
                            Err(e) => {
                                log_debug!("STARTUP", "Could not register test shortcut: {}", e);
                            }
                        }
                    },
                    Err(e) => {
                        log_error!("STARTUP", "❌ Failed to register global shortcut: {}", e);
                        log_error!("STARTUP", "You may need to grant accessibility permissions to this app in System Settings > Privacy & Security > Accessibility");
                    }
                }
            }
            
            // Apply config settings synchronously
            let config_for_init = tauri::async_runtime::block_on(async {
                config_state.lock().await.clone()
            });
            
            println!("Applying initial config settings: opacity={}, alwaysOnTop={}", config_for_init.opacity, config_for_init.always_on_top);
            
            // Try to apply initial window settings immediately 
            if let Some(window) = app.get_webview_window("main") {
                log_info!("STARTUP", "🪟 Found main window, forcing it to be visible...");
                
                // Make sure window is visible
                if let Err(e) = window.show() {
                    log_error!("STARTUP", "Failed to show window: {}", e);
                } else {
                    log_info!("STARTUP", "✅ Window.show() called successfully");
                }
                
                // Center the window
                if let Err(e) = window.center() {
                    log_error!("STARTUP", "Failed to center window: {}", e);
                } else {
                    log_info!("STARTUP", "✅ Window.center() called successfully");
                }
                
                // Set proper size (match tauri.conf.json defaults)
                if let Err(e) = window.set_size(tauri::Size::Physical(tauri::PhysicalSize {
                    width: 1000,
                    height: 700,
                })) {
                    log_error!("STARTUP", "Failed to set window size: {}", e);
                } else {
                    log_info!("STARTUP", "✅ Window.set_size() called successfully");
                }
                
                // Set focus
                if let Err(e) = window.set_focus() {
                    log_error!("STARTUP", "Failed to set window focus: {}", e);
                } else {
                    log_info!("STARTUP", "✅ Window.set_focus() called successfully");
                }
                
                // Set always on top synchronously
                if let Err(e) = window.set_always_on_top(config_for_init.always_on_top) {
                    log_error!("STARTUP", "Failed to set initial always on top: {}", e);
                } else {
                    log_info!("STARTUP", "✅ Window.set_always_on_top({}) called successfully", config_for_init.always_on_top);
                }
                
                // Force opacity to be fully visible on macOS
                #[cfg(target_os = "macos")]
                {
                    match window.ns_window() {
                        Ok(ns_window) => {
                            use cocoa::base::id;
                            use objc::{msg_send, sel, sel_impl};
                            let ns_window = ns_window as id;
                            unsafe {
                                let _: () = msg_send![ns_window, setAlphaValue: 1.0];
                            }
                            log_info!("STARTUP", "✅ Window opacity set to 100% on macOS");
                        },
                        Err(e) => {
                            log_error!("STARTUP", "Failed to get ns_window: {}", e);
                        }
                    }
                }
                
                // Check if window is actually visible
                match window.is_visible() {
                    Ok(visible) => log_info!("STARTUP", "📊 Window visibility status: {}", visible),
                    Err(e) => log_error!("STARTUP", "Failed to check window visibility: {}", e),
                }
                
                // Get window position
                match window.outer_position() {
                    Ok(pos) => log_info!("STARTUP", "📍 Window position: ({}, {})", pos.x, pos.y),
                    Err(e) => log_error!("STARTUP", "Failed to get window position: {}", e),
                }
                
                // Get window size
                match window.inner_size() {
                    Ok(size) => log_info!("STARTUP", "📏 Window size: {}x{}", size.width, size.height),
                    Err(e) => log_error!("STARTUP", "Failed to get window size: {}", e),
                }
                
                log_info!("STARTUP", "🔚 Window setup complete");
            } else {
                log_error!("STARTUP", "❌ Could not find main window!");
            }
            
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}