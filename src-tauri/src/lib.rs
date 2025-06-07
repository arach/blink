use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use tauri::{Manager, State, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_global_shortcut::GlobalShortcutExt;
use tokio::sync::Mutex;
use uuid::Uuid;

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct Note {
    pub id: String,
    pub title: String,
    pub content: String,
    pub created_at: String,
    pub updated_at: String,
    pub tags: Vec<String>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct CreateNoteRequest {
    pub title: String,
    pub content: String,
    pub tags: Vec<String>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct UpdateNoteRequest {
    pub title: Option<String>,
    pub content: Option<String>,
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct AppConfig {
    pub opacity: f64,
    pub always_on_top: bool,
    pub shortcuts: ShortcutConfig,
    pub window: WindowConfig,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct ShortcutConfig {
    pub toggle_visibility: String,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct WindowConfig {
    pub width: f64,
    pub height: f64,
    pub x: Option<f64>,
    pub y: Option<f64>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct DetachedWindow {
    pub note_id: String,
    pub window_label: String,
    pub position: (f64, f64),
    pub size: (f64, f64),
    pub always_on_top: bool,
    pub opacity: f64,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct CreateDetachedWindowRequest {
    pub note_id: String,
    pub x: Option<f64>,
    pub y: Option<f64>,
    pub width: Option<f64>,
    pub height: Option<f64>,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            opacity: 0.9,
            always_on_top: false,
            shortcuts: ShortcutConfig {
                toggle_visibility: "Cmd+Ctrl+Alt+Shift+N".to_string(),
            },
            window: WindowConfig {
                width: 1200.0,
                height: 800.0,
                x: None,
                y: None,
            },
        }
    }
}

type NotesState = Mutex<HashMap<String, Note>>;
type ConfigState = Mutex<AppConfig>;
type DetachedWindowsState = Mutex<HashMap<String, DetachedWindow>>;

#[tauri::command]
async fn get_notes(notes: State<'_, NotesState>) -> Result<Vec<Note>, String> {
    let notes_lock = notes.lock().await;
    let mut notes_vec: Vec<Note> = notes_lock.values().cloned().collect();
    notes_vec.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    Ok(notes_vec)
}

#[tauri::command]
async fn get_note(id: String, notes: State<'_, NotesState>) -> Result<Option<Note>, String> {
    let notes_lock = notes.lock().await;
    Ok(notes_lock.get(&id).cloned())
}

#[tauri::command]
async fn create_note(
    request: CreateNoteRequest,
    notes: State<'_, NotesState>,
) -> Result<Note, String> {
    let mut notes_lock = notes.lock().await;
    
    let now = chrono::Utc::now().to_rfc3339();
    let note = Note {
        id: Uuid::new_v4().to_string(),
        title: request.title,
        content: request.content,
        created_at: now.clone(),
        updated_at: now,
        tags: request.tags,
    };
    
    notes_lock.insert(note.id.clone(), note.clone());
    save_notes_to_disk(&notes_lock).await?;
    
    Ok(note)
}

#[tauri::command]
async fn update_note(
    id: String,
    request: UpdateNoteRequest,
    notes: State<'_, NotesState>,
) -> Result<Option<Note>, String> {
    let mut notes_lock = notes.lock().await;
    
    if let Some(note) = notes_lock.get_mut(&id) {
        if let Some(title) = request.title {
            note.title = title;
        }
        if let Some(content) = request.content {
            note.content = content;
        }
        if let Some(tags) = request.tags {
            note.tags = tags;
        }
        note.updated_at = chrono::Utc::now().to_rfc3339();
        
        let updated_note = note.clone();
        save_notes_to_disk(&notes_lock).await?;
        Ok(Some(updated_note))
    } else {
        Ok(None)
    }
}

#[tauri::command]
async fn delete_note(id: String, notes: State<'_, NotesState>) -> Result<bool, String> {
    let mut notes_lock = notes.lock().await;
    let removed = notes_lock.remove(&id).is_some();
    
    if removed {
        save_notes_to_disk(&notes_lock).await?;
    }
    
    Ok(removed)
}

#[tauri::command]
async fn get_config(config: State<'_, ConfigState>) -> Result<AppConfig, String> {
    let config_lock = config.lock().await;
    Ok(config_lock.clone())
}

#[tauri::command]
async fn update_config(
    new_config: AppConfig,
    config: State<'_, ConfigState>,
) -> Result<AppConfig, String> {
    let mut config_lock = config.lock().await;
    *config_lock = new_config.clone();
    save_config_to_disk(&new_config).await?;
    Ok(new_config)
}

#[tauri::command]
async fn toggle_window_visibility(app: tauri::AppHandle) -> Result<bool, String> {
    let window = app.get_webview_window("main").ok_or("Window not found")?;
    let is_visible = window.is_visible().map_err(|e| e.to_string())?;
    
    if is_visible {
        window.hide().map_err(|e| e.to_string())?;
    } else {
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
    }
    
    Ok(!is_visible)
}

#[tauri::command]
async fn set_window_opacity(app: tauri::AppHandle, opacity: f64) -> Result<(), String> {
    let window = app.get_webview_window("main").ok_or("Window not found")?;
    
    // For Tauri v2, we need to use window effects or a different approach
    // Let's try using the app handle to get the window and use raw window APIs
    use tauri::Manager;
    
    #[cfg(target_os = "macos")]
    {
        // On macOS, we can try using the native window
        use cocoa::base::id;
        use objc::{msg_send, sel, sel_impl};
        
        let ns_window = window.ns_window().map_err(|e| e.to_string())? as id;
        unsafe {
            #[allow(unexpected_cfgs)]
            let _: () = msg_send![ns_window, setAlphaValue: opacity];
        }
    }
    
    #[cfg(not(target_os = "macos"))]
    {
        return Err("Opacity control not implemented for this platform".to_string());
    }
    
    Ok(())
}

#[tauri::command]
async fn set_window_always_on_top(app: tauri::AppHandle, always_on_top: bool) -> Result<(), String> {
    let window = app.get_webview_window("main").ok_or("Window not found")?;
    window.set_always_on_top(always_on_top).map_err(|e| e.to_string())?;
    Ok(())
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
async fn create_detached_window(
    request: CreateDetachedWindowRequest,
    app: tauri::AppHandle,
    detached_windows: State<'_, DetachedWindowsState>,
    notes: State<'_, NotesState>,
) -> Result<DetachedWindow, String> {
    // Check if note exists
    let notes_lock = notes.lock().await;
    if !notes_lock.contains_key(&request.note_id) {
        return Err("Note not found".to_string());
    }
    drop(notes_lock);

    // Check if window already exists for this note
    let mut windows_lock = detached_windows.lock().await;
    if windows_lock.values().any(|w| w.note_id == request.note_id) {
        return Err("Window already exists for this note".to_string());
    }

    let window_label = format!("note-{}", request.note_id);
    let width = request.width.unwrap_or(600.0);
    let height = request.height.unwrap_or(400.0);
    let x = request.x.unwrap_or(100.0);
    let y = request.y.unwrap_or(100.0);

    // Create the window
    let _webview_window = WebviewWindowBuilder::new(
        &app,
        &window_label,
        WebviewUrl::App(format!("index.html?note={}", request.note_id).into()),
    )
    .title(&format!("Note - {}", request.note_id))
    .inner_size(width, height)
    .position(x, y)
    .resizable(true)
    .transparent(true)
    .decorations(false)
    .always_on_top(false)
    .build()
    .map_err(|e| format!("Failed to create window: {}", e))?;

    let detached_window = DetachedWindow {
        note_id: request.note_id.clone(),
        window_label: window_label.clone(),
        position: (x, y),
        size: (width, height),
        always_on_top: false,
        opacity: 0.95,
    };

    windows_lock.insert(window_label, detached_window.clone());
    save_detached_windows_to_disk(&windows_lock).await?;

    Ok(detached_window)
}

#[tauri::command]
async fn close_detached_window(
    note_id: String,
    app: tauri::AppHandle,
    detached_windows: State<'_, DetachedWindowsState>,
) -> Result<bool, String> {
    let mut windows_lock = detached_windows.lock().await;
    
    // Find window by note_id
    let window_label = if let Some((label, _)) = windows_lock.iter().find(|(_, w)| w.note_id == note_id) {
        label.clone()
    } else {
        return Ok(false);
    };

    // Close the actual window
    if let Some(window) = app.get_webview_window(&window_label) {
        window.close().map_err(|e| format!("Failed to close window: {}", e))?;
    }

    // Remove from state
    windows_lock.remove(&window_label);
    save_detached_windows_to_disk(&windows_lock).await?;

    Ok(true)
}

#[tauri::command]
async fn get_detached_windows(
    detached_windows: State<'_, DetachedWindowsState>,
) -> Result<Vec<DetachedWindow>, String> {
    let windows_lock = detached_windows.lock().await;
    Ok(windows_lock.values().cloned().collect())
}

#[tauri::command]
async fn update_detached_window_position(
    window_label: String,
    x: f64,
    y: f64,
    detached_windows: State<'_, DetachedWindowsState>,
) -> Result<(), String> {
    let mut windows_lock = detached_windows.lock().await;
    
    if let Some(window) = windows_lock.get_mut(&window_label) {
        window.position = (x, y);
        save_detached_windows_to_disk(&windows_lock).await?;
    }
    
    Ok(())
}

#[tauri::command]
async fn update_detached_window_size(
    window_label: String,
    width: f64,
    height: f64,
    detached_windows: State<'_, DetachedWindowsState>,
) -> Result<(), String> {
    let mut windows_lock = detached_windows.lock().await;
    
    if let Some(window) = windows_lock.get_mut(&window_label) {
        window.size = (width, height);
        save_detached_windows_to_disk(&windows_lock).await?;
    }
    
    Ok(())
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
    // Use project directory during development
    let current_dir = std::env::current_dir()
        .map_err(|e| format!("Failed to get current directory: {}", e))?;
    Ok(current_dir.join("data"))
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
        let default_config = AppConfig::default();
        save_config_to_disk(&default_config).await?;
        return Ok(default_config);
    }
    
    let config_json = fs::read_to_string(config_file)
        .map_err(|e| format!("Failed to read config from disk: {}", e))?;
    
    let config: AppConfig = serde_json::from_str(&config_json)
        .map_err(|e| format!("Failed to parse config JSON: {}", e))?;
    
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

async fn load_detached_windows_from_disk() -> Result<HashMap<String, DetachedWindow>, String> {
    let notes_dir = get_notes_directory()?;
    let windows_file = notes_dir.join("detached_windows.json");
    
    if !windows_file.exists() {
        return Ok(HashMap::new());
    }
    
    let windows_json = fs::read_to_string(windows_file)
        .map_err(|e| format!("Failed to read windows from disk: {}", e))?;
    
    let windows: HashMap<String, DetachedWindow> = serde_json::from_str(&windows_json)
        .map_err(|e| format!("Failed to parse windows JSON: {}", e))?;
    
    Ok(windows)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let notes_state = match tauri::async_runtime::block_on(load_notes_from_disk()) {
        Ok(notes) => NotesState::new(notes),
        Err(e) => {
            eprintln!("Failed to load notes from disk: {}", e);
            NotesState::new(HashMap::new())
        }
    };

    let config_state = match tauri::async_runtime::block_on(load_config_from_disk()) {
        Ok(config) => ConfigState::new(config),
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
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .manage(notes_state)
        .manage(config_state)
        .manage(detached_windows_state)
        .invoke_handler(tauri::generate_handler![
            get_notes,
            get_note,
            create_note,
            update_note,
            delete_note,
            get_config,
            update_config,
            toggle_window_visibility,
            set_window_opacity,
            set_window_always_on_top,
            open_system_settings,
            create_detached_window,
            close_detached_window,
            get_detached_windows,
            update_detached_window_position,
            update_detached_window_size
        ])
        .setup(|app| {
            let app_handle = app.handle().clone();
            
            // Register global shortcut for toggle visibility (Hyperkey+N)  
            let shortcut_manager = app.global_shortcut();
            match shortcut_manager.register("Cmd+Ctrl+Alt+Shift+N") {
                Ok(_) => {
                    println!("✅ Global shortcut Cmd+Ctrl+Alt+Shift+N registered successfully");
                },
                Err(e) => {
                    eprintln!("❌ Failed to register global shortcut: {}", e);
                    eprintln!("💡 You may need to grant accessibility permissions to this app in System Settings > Privacy & Security > Accessibility");
                }
            }
            
            // Listen to shortcut events
            let _ = shortcut_manager.on_shortcut("Cmd+Ctrl+Alt+Shift+N", move |_app, _shortcut, _event| {
                println!("🎯 Global shortcut triggered!");
                let app_handle_clone = app_handle.clone();
                tauri::async_runtime::spawn(async move {
                    match toggle_window_visibility(app_handle_clone).await {
                        Ok(visible) => println!("🪟 Window visibility toggled: {}", visible),
                        Err(e) => eprintln!("❌ Failed to toggle window: {}", e),
                    }
                });
            });
            
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}