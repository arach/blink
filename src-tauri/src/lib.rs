use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use tauri::{Emitter, Manager, State, WebviewUrl, WebviewWindowBuilder};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
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
    #[serde(rename = "alwaysOnTop")]
    pub always_on_top: bool,
    pub shortcuts: ShortcutConfig,
    pub window: WindowConfig,
    #[serde(default = "default_appearance")]
    pub appearance: AppearanceConfig,
}

fn default_appearance() -> AppearanceConfig {
    AppearanceConfig {
        font_size: 15.0,
        theme: "dark".to_string(),
        editor_font_family: "system-ui".to_string(),
        line_height: 1.6,
        accent_color: "#3b82f6".to_string(),
    }
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct ShortcutConfig {
    #[serde(rename = "toggleVisibility")]
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
pub struct AppearanceConfig {
    #[serde(rename = "fontSize")]
    pub font_size: f64,
    pub theme: String,
    #[serde(rename = "editorFontFamily")]
    pub editor_font_family: String,
    #[serde(rename = "lineHeight")]
    pub line_height: f64,
    #[serde(rename = "accentColor")]
    pub accent_color: String,
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
            appearance: default_appearance(),
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
async fn set_window_focus(app: tauri::AppHandle) -> Result<(), String> {
    let window = app.get_webview_window("main").ok_or("Main window not found")?;
    window.set_focus().map_err(|e| e.to_string())?;
    window.show().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn create_drag_ghost(
    app: tauri::AppHandle,
    note_title: String,
    x: f64,
    y: f64,
) -> Result<(), String> {
    // Close existing ghost window if it exists
    if let Some(ghost_window) = app.get_webview_window("drag-ghost") {
        let _ = ghost_window.close();
    }

    // Create a temporary drag ghost window
    let ghost_window = WebviewWindowBuilder::new(
        &app,
        "drag-ghost",
        WebviewUrl::App(format!("index.html?ghost=true&title={}", urlencoding::encode(&note_title)).into()),
    )
    .title("Drag Ghost")
    .inner_size(300.0, 200.0)
    .position(x, y)
    .resizable(false)
    .transparent(true)
    .decorations(false)
    .always_on_top(true)
    .skip_taskbar(true)
    .visible(false)
    .shadow(false)
    .build()
    .map_err(|e| format!("Failed to create drag ghost window: {}", e))?;

    // Show the window immediately
    ghost_window.show().map_err(|e| e.to_string())?;
    
    Ok(())
}

#[tauri::command]
async fn update_drag_ghost_position(
    app: tauri::AppHandle,
    x: f64,
    y: f64,
) -> Result<(), String> {
    if let Some(ghost_window) = app.get_webview_window("drag-ghost") {
        ghost_window.set_position(tauri::Position::Physical(tauri::PhysicalPosition { x: x as i32, y: y as i32 }))
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn destroy_drag_ghost(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(ghost_window) = app.get_webview_window("drag-ghost") {
        ghost_window.close().map_err(|e| e.to_string())?;
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
    {
        let notes_lock = notes.lock().await;
        if !notes_lock.contains_key(&request.note_id) {
            return Err("Note not found".to_string());
        }
    }

    // Check if window already exists for this note
    let mut windows_lock = detached_windows.lock().await;
    if windows_lock.values().any(|w| w.note_id == request.note_id) {
        return Err("Window already exists for this note".to_string());
    }

    let window_label = format!("note-{}", request.note_id);
    
    // Check if we have a saved position for this note
    let saved_window = load_spatial_data(&request.note_id).await;
    let width = request.width.or(saved_window.as_ref().map(|w| w.size.0)).unwrap_or(800.0);
    let height = request.height.or(saved_window.as_ref().map(|w| w.size.1)).unwrap_or(600.0);
    let x = request.x.or(saved_window.as_ref().map(|w| w.position.0)).unwrap_or(100.0);
    let y = request.y.or(saved_window.as_ref().map(|w| w.position.1)).unwrap_or(100.0);

    // Create the window
    let webview_window = WebviewWindowBuilder::new(
        &app,
        &window_label,
        WebviewUrl::App(format!("index.html?note={}", request.note_id).into()),
    )
    .title(&format!("Note - {}", request.note_id))
    .inner_size(width, height)
    .min_inner_size(300.0, 200.0)
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

    windows_lock.insert(window_label.clone(), detached_window.clone());
    save_detached_windows_to_disk(&windows_lock).await?;
    
    // Update the app menu to include the new window
    drop(windows_lock);
    update_app_menu(app.clone(), detached_windows.clone(), notes.clone()).await?;
    
    // Set up window event listeners for position/size tracking
    let note_id_clone = request.note_id.clone();
    webview_window.on_window_event(move |event| {
        match event {
            tauri::WindowEvent::Moved(position) => {
                let note_id = note_id_clone.clone();
                let x = position.x as f64;
                let y = position.y as f64;
                tauri::async_runtime::spawn(async move {
                    let _ = save_window_position(note_id, x, y).await;
                });
            },
            tauri::WindowEvent::Resized(size) => {
                let note_id = note_id_clone.clone();
                let width = size.width as f64;
                let height = size.height as f64;
                tauri::async_runtime::spawn(async move {
                    let _ = save_window_size(note_id, width, height).await;
                });
            },
            _ => {}
        }
    });

    Ok(detached_window)
}

#[tauri::command]
async fn close_detached_window(
    note_id: String,
    app: tauri::AppHandle,
    detached_windows: State<'_, DetachedWindowsState>,
    notes: State<'_, NotesState>,
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
    
    // Update the app menu to remove the closed window
    drop(windows_lock);
    update_app_menu(app.clone(), detached_windows.clone(), notes.clone()).await?;

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
    let app_menu = Submenu::new(app, "Tauri Notes App", true).map_err(|e| e.to_string())?;
    let about_item = MenuItem::new(app, "About Tauri Notes App", true, None::<&str>).map_err(|e| e.to_string())?;
    let separator = PredefinedMenuItem::separator(app).map_err(|e| e.to_string())?;
    let services_item = MenuItem::new(app, "Services", true, None::<&str>).map_err(|e| e.to_string())?;
    let separator2 = PredefinedMenuItem::separator(app).map_err(|e| e.to_string())?;
    let hide_item = MenuItem::new(app, "Hide Tauri Notes App", true, Some("Cmd+H")).map_err(|e| e.to_string())?;
    let hide_others_item = MenuItem::new(app, "Hide Others", true, Some("Cmd+Alt+H")).map_err(|e| e.to_string())?;
    let show_all_item = MenuItem::new(app, "Show All", true, None::<&str>).map_err(|e| e.to_string())?;
    let separator3 = PredefinedMenuItem::separator(app).map_err(|e| e.to_string())?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit Tauri Notes App", true, Some("Cmd+Q")).map_err(|e| e.to_string())?;
    
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
    let new_note_item = MenuItem::with_id(app, "new-note", "New Note", true, Some("Cmd+N")).map_err(|e| e.to_string())?;
    let separator5 = PredefinedMenuItem::separator(app).map_err(|e| e.to_string())?;
    
    notes_menu.append(&new_note_item).map_err(|e| e.to_string())?;
    notes_menu.append(&separator5).map_err(|e| e.to_string())?;
    
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
            opacity: 0.95,
        };
        save_spatial_data(&note_id, &window_data).await?;
    }
    Ok(())
}

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
            opacity: 0.95,
        };
        save_spatial_data(&note_id, &window_data).await?;
    }
    Ok(())
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
            set_window_focus,
            create_detached_window,
            close_detached_window,
            get_detached_windows,
            update_detached_window_position,
            update_detached_window_size,
            create_drag_ghost,
            update_drag_ghost_position,
            destroy_drag_ghost,
            update_app_menu
        ])
        .on_menu_event(|app, event| {
            let menu_id = event.id();
            
            // Handle quit menu item
            if menu_id.0 == "quit" {
                app.exit(0);
            }
            // Handle minimize menu item
            else if menu_id.0 == "minimize" {
                // In Tauri v2, we'll minimize the main window
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.minimize();
                }
            }
            // Handle new note menu item
            else if menu_id.0 == "new-note" {
                // Emit event to create new note
                let _ = app.emit("menu-new-note", ());
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
            
            // Set up initial menu
            let notes_state = app.state::<NotesState>();
            let detached_windows_state = app.state::<DetachedWindowsState>();
            
            tauri::async_runtime::block_on(async {
                let notes_lock = notes_state.lock().await;
                let windows_lock = detached_windows_state.lock().await;
                if let Ok(menu) = build_app_menu(&app_handle, &*windows_lock, &*notes_lock) {
                    let _ = app_handle.set_menu(menu);
                }
            });
            
            // Register global shortcut for toggle visibility (Hyperkey+N)  
            let shortcut_manager = app.global_shortcut();
            match shortcut_manager.register("Cmd+Ctrl+Alt+Shift+N") {
                Ok(_) => {},
                Err(e) => {
                    eprintln!("Failed to register global shortcut: {}", e);
                    eprintln!("You may need to grant accessibility permissions to this app in System Settings > Privacy & Security > Accessibility");
                }
            }
            
            // Listen to shortcut events
            let _ = shortcut_manager.on_shortcut("Cmd+Ctrl+Alt+Shift+N", move |_app, _shortcut, _event| {
                let app_handle_clone = app_handle.clone();
                tauri::async_runtime::spawn(async move {
                    let _ = toggle_window_visibility(app_handle_clone).await;
                });
            });
            
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}