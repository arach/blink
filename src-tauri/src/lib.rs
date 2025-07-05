use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use tauri::{Emitter, Manager, State, WebviewUrl, WebviewWindowBuilder};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri_plugin_global_shortcut::GlobalShortcutExt;
use tokio::sync::Mutex;
use uuid::Uuid;
use chrono::Local;

// Custom logger macro for Blink
macro_rules! notes_log {
    ($level:expr, $category:expr, $($arg:tt)*) => {{
        println!("[BLINK] [{}] [{}] [{}] {}", 
            Local::now().format("%Y-%m-%d %H:%M:%S%.3f"), 
            $level, 
            $category, 
            format!($($arg)*));
    }};
}

macro_rules! log_info {
    ($category:expr, $($arg:tt)*) => {{
        notes_log!("INFO", $category, $($arg)*);
    }};
}

macro_rules! log_error {
    ($category:expr, $($arg:tt)*) => {{
        notes_log!("ERROR", $category, $($arg)*);
    }};
}

macro_rules! log_debug {
    ($category:expr, $($arg:tt)*) => {{
        notes_log!("DEBUG", $category, $($arg)*);
    }};
}

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
        content_font_size: Some(16.0),
        theme: "dark".to_string(),
        editor_font_family: "system-ui".to_string(),
        preview_font_family: Some("Inter, -apple-system, BlinkMacSystemFont, sans-serif".to_string()),
        line_height: 1.6,
        accent_color: "#3b82f6".to_string(),
        background_pattern: Some("none".to_string()),
        syntax_highlighting: Some(true),
        focus_mode: Some(false),
        typewriter_mode: Some(false),
        theme_id: Some("midnightInk".to_string()),
        show_note_previews: Some(true),
        window_opacity: None,
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
    #[serde(rename = "contentFontSize")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content_font_size: Option<f64>,
    pub theme: String,
    #[serde(rename = "editorFontFamily")]
    pub editor_font_family: String,
    #[serde(rename = "previewFontFamily")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub preview_font_family: Option<String>,
    #[serde(rename = "lineHeight")]
    pub line_height: f64,
    #[serde(rename = "accentColor")]
    pub accent_color: String,
    #[serde(rename = "backgroundPattern")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub background_pattern: Option<String>,
    #[serde(rename = "syntaxHighlighting")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub syntax_highlighting: Option<bool>,
    #[serde(rename = "focusMode")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub focus_mode: Option<bool>,
    #[serde(rename = "typewriterMode")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub typewriter_mode: Option<bool>,
    #[serde(rename = "themeId")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub theme_id: Option<String>,
    #[serde(rename = "showNotePreviews")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub show_note_previews: Option<bool>,
    #[serde(rename = "windowOpacity")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub window_opacity: Option<f64>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct DetachedWindow {
    pub note_id: String,
    pub window_label: String,
    pub position: (f64, f64),
    pub size: (f64, f64),
    pub always_on_top: bool,
    pub opacity: f64,
    #[serde(default)]
    pub is_shaded: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub original_height: Option<f64>,
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
            opacity: 0.55,
            always_on_top: false,
            shortcuts: ShortcutConfig {
                toggle_visibility: "Cmd+Ctrl+Alt+Shift+N".to_string(),
            },
            window: WindowConfig {
                width: 1000.0,
                height: 700.0,
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
type ToggleState = Mutex<bool>;

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
    log_debug!("CONFIG", "Returning config: {:?}", config_lock.clone());
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
async fn toggle_all_windows_hover(
    app: tauri::AppHandle,
    detached_windows: State<'_, DetachedWindowsState>,
    notes: State<'_, NotesState>,
    toggle_state: State<'_, ToggleState>,
) -> Result<bool, String> {
    // Check if a toggle is already in progress
    let mut is_toggling = toggle_state.lock().await;
    if *is_toggling {
        log_info!("HOVER", "Toggle already in progress, skipping...");
        return Ok(false);
    }
    *is_toggling = true;
    drop(is_toggling);
    
    // Perform the toggle operation
    let result = {
        log_info!("HOVER", "Toggling visibility for all windows...");
        
        // Add a small delay to debounce rapid toggles
        tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;
        
        // Check if main window is visible
        let main_window = app.get_webview_window("main")
            .ok_or("Main window not found")?;
        let main_visible = main_window.is_visible()
            .map_err(|e| format!("Failed to check main window visibility: {}", e))?;
        
        if main_visible {
            // Hide all windows
            log_info!("HOVER", "Hiding all windows...");
            main_window.hide().map_err(|e| format!("Failed to hide main window: {}", e))?;
            
            // Hide all detached windows
            let windows_lock = detached_windows.lock().await;
            for (window_label, _) in windows_lock.iter() {
                if let Some(window) = app.get_webview_window(window_label) {
                    let _ = window.hide();
                }
            }
            Ok(false)
        } else {
            // Show all windows
            log_info!("HOVER", "Showing all windows...");
            main_window.show().map_err(|e| format!("Failed to show main window: {}", e))?;
            main_window.set_focus().map_err(|e| format!("Failed to focus main window: {}", e))?;
            
            // Show or restore all detached windows
            let windows_lock = detached_windows.lock().await;
            let windows_to_restore: Vec<DetachedWindow> = windows_lock.values().cloned().collect();
            drop(windows_lock);
            
            for window_data in windows_to_restore {
                // Check if window exists
                if let Some(window) = app.get_webview_window(&window_data.window_label) {
                    // Window exists, just show it
                    let _ = window.show();
                } else {
                    // Window doesn't exist, recreate it
                    log_info!("HOVER", "Restoring window for note: {}", window_data.note_id);
                    let request = CreateDetachedWindowRequest {
                        note_id: window_data.note_id.clone(),
                        x: Some(window_data.position.0),
                        y: Some(window_data.position.1),
                        width: Some(window_data.size.0),
                        height: Some(window_data.size.1),
                    };
                    let _ = create_detached_window(request, app.clone(), detached_windows.clone(), notes.clone()).await;
                }
            }
            Ok(true)
        }
    };
    
    // Reset the toggle state
    let mut is_toggling = toggle_state.lock().await;
    *is_toggling = false;
    drop(is_toggling);
    
    result
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
    // Force close any existing ghost windows
    let windows: Vec<String> = app.webview_windows()
        .keys()
        .filter(|k| k.starts_with("drag-ghost"))
        .cloned()
        .collect();
    
    for window_label in windows {
        if let Some(ghost_window) = app.get_webview_window(&window_label) {
            let _ = ghost_window.close();
        }
    }
    
    // Small delay to ensure cleanup
    std::thread::sleep(std::time::Duration::from_millis(100));

    // Create a temporary drag ghost window with unique label
    let ghost_label = format!("drag-ghost-{}", std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis());
    
    let ghost_window = WebviewWindowBuilder::new(
        &app,
        &ghost_label,
        WebviewUrl::App(format!("index.html?ghost=true&title={}", urlencoding::encode(&note_title)).into()),
    )
    .title("Drag Ghost")
    .inner_size(320.0, 240.0)
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
    
    log_debug!("DRAG", "Ghost window created with label {} at position ({}, {})", ghost_label, x, y);
    
    Ok(())
}

#[tauri::command]
async fn update_drag_ghost_position(
    app: tauri::AppHandle,
    x: f64,
    y: f64,
) -> Result<(), String> {
    // Find any ghost window
    let windows: Vec<String> = app.webview_windows()
        .keys()
        .filter(|k| k.starts_with("drag-ghost"))
        .cloned()
        .collect();
    
    for window_label in windows {
        if let Some(ghost_window) = app.get_webview_window(&window_label) {
            ghost_window.set_position(tauri::Position::Physical(tauri::PhysicalPosition { x: x as i32, y: y as i32 }))
                .map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
async fn destroy_drag_ghost(app: tauri::AppHandle) -> Result<(), String> {
    // Find and close all ghost windows
    let windows: Vec<String> = app.webview_windows()
        .keys()
        .filter(|k| k.starts_with("drag-ghost"))
        .cloned()
        .collect();
    
    let count = windows.len();
    for window_label in windows {
        if let Some(ghost_window) = app.get_webview_window(&window_label) {
            ghost_window.close().map_err(|e| e.to_string())?;
        }
    }
    
    if count > 0 {
        log_debug!("DRAG", "Destroyed {} ghost window(s)", count);
    }
    
    Ok(())
}


#[tauri::command]
async fn create_hybrid_drag_window(
    app: tauri::AppHandle,
    note_id: String,
    x: f64,
    y: f64,
    hidden: Option<bool>,
) -> Result<String, String> {
    let window_label = format!("hybrid-drag-{}", note_id);
    
    // Create a window that follows the mouse
    let _drag_window = WebviewWindowBuilder::new(
        &app,
        &window_label,
        WebviewUrl::App(format!("index.html?note={}", note_id).into()),
    )
    .title("Dragging...")
    .inner_size(400.0, 300.0)  // Match HTML preview size
    .position(x, y)
    .resizable(false)
    .transparent(true)
    .decorations(false)
    .always_on_top(true)
    .skip_taskbar(true)
    .visible(!hidden.unwrap_or(false))  // Set initial visibility based on hidden parameter
    .shadow(true)
    .build()
    .map_err(|e| format!("Failed to create hybrid drag window: {}", e))?;
    
    log_info!("DRAG", "Created hybrid drag window '{}' for note '{}' at ({}, {}), hidden={:?}", 
        window_label, note_id, x, y, hidden);
    
    // If showing immediately, ensure it's visible and on top
    if !hidden.unwrap_or(false) {
        if let Some(window) = app.get_webview_window(&window_label) {
            window.show().map_err(|e| format!("Failed to show window: {}", e))?;
            window.set_always_on_top(true).map_err(|e| format!("Failed to set always on top: {}", e))?;
            window.set_focus().map_err(|e| format!("Failed to set focus: {}", e))?;
            log_info!("DRAG", "Window shown and set to always on top");
        }
    } else {
        // For hidden windows, ensure they're actually hidden
        if let Some(window) = app.get_webview_window(&window_label) {
            window.hide().map_err(|e| format!("Failed to hide window: {}", e))?;
            log_info!("DRAG", "Window explicitly hidden");
        }
    }
    
    // Start tracking mouse position
    let window_label_clone = window_label.clone();
    let app_handle = app.clone();
    std::thread::spawn(move || {
        loop {
            // Check if window still exists
            if app_handle.get_webview_window(&window_label_clone).is_none() {
                break;
            }
            
            // Small delay to not overwhelm the system
            std::thread::sleep(std::time::Duration::from_millis(16)); // ~60fps
        }
    });
    
    Ok(window_label)
}

#[tauri::command]
async fn close_hybrid_drag_window(
    app: tauri::AppHandle,
    window_label: String,
) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(&window_label) {
        window.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn show_hybrid_drag_window(
    app: tauri::AppHandle,
    window_label: String,
    x: f64,
    y: f64,
) -> Result<(), String> {
    log_info!("DRAG", "show_hybrid_drag_window called for '{}' at ({}, {})", window_label, x, y);
    
    if let Some(window) = app.get_webview_window(&window_label) {
        log_info!("DRAG", "Window found, updating position and showing");
        
        // Update position
        window.set_position(tauri::Position::Physical(tauri::PhysicalPosition { x: x as i32, y: y as i32 }))
            .map_err(|e| {
                log_error!("DRAG", "Failed to set position: {}", e);
                e.to_string()
            })?;
        
        // Show the window
        window.show().map_err(|e| {
            log_error!("DRAG", "Failed to show window: {}", e);
            e.to_string()
        })?;
        
        // Ensure it's on top
        window.set_always_on_top(true).map_err(|e| {
            log_error!("DRAG", "Failed to set always on top: {}", e);
            e.to_string()
        })?;
        
        // Try to set focus
        window.set_focus().map_err(|e| {
            log_error!("DRAG", "Failed to set focus: {}", e);
            e.to_string()
        })?;
        
        log_info!("DRAG", "Window successfully shown and positioned");
    } else {
        log_error!("DRAG", "Window '{}' not found", window_label);
        return Err(format!("Window '{}' not found", window_label));
    }
    Ok(())
}

#[tauri::command]
async fn update_hybrid_drag_position(
    app: tauri::AppHandle,
    window_label: String,
    x: f64,
    y: f64,
) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(&window_label) {
        window.set_position(tauri::Position::Physical(tauri::PhysicalPosition { x: x as i32, y: y as i32 }))
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn finalize_hybrid_drag_window(
    app: tauri::AppHandle,
    window_label: String,
    note_id: String,
    detached_windows: State<'_, DetachedWindowsState>,
    notes: State<'_, NotesState>,
) -> Result<(), String> {
    log_info!("DRAG", "Finalizing hybrid drag window '{}' for note '{}'", window_label, note_id);
    
    // Instead of closing and recreating, just register this window as a detached window
    if let Some(window) = app.get_webview_window(&window_label) {
        // Get current position and size
        let pos = window.outer_position().map_err(|e| e.to_string())?;
        let size = window.inner_size().map_err(|e| e.to_string())?;
        
        // Change the window label to the standard format
        let _new_label = format!("note-{}", note_id);
        
        // Since we can't rename a window, we'll track it with its current label
        // but treat it as a detached window
        let detached_window = DetachedWindow {
            note_id: note_id.clone(),
            window_label: window_label.clone(), // Keep the hybrid-drag label
            position: (pos.x as f64, pos.y as f64),
            size: (size.width as f64, size.height as f64),
            always_on_top: false,
            opacity: 1.0,
            is_shaded: false,
            original_height: None,
        };
        
        // Update the window to act like a normal detached window
        window.set_title(&format!("Note - {}", note_id)).map_err(|e| e.to_string())?;
        window.set_resizable(true).map_err(|e| e.to_string())?;
        window.set_always_on_top(false).map_err(|e| e.to_string())?;
        
        // Save to state
        let mut windows_lock = detached_windows.lock().await;
        windows_lock.insert(window_label.clone(), detached_window.clone());
        save_detached_windows_to_disk(&windows_lock).await?;
        
        // Update the app menu
        drop(windows_lock);
        update_app_menu(app.clone(), detached_windows.clone(), notes.clone()).await?;
        
        // Note: Window position/size tracking is now handled by the frontend useWindowTracking hook
        // with proper debouncing to avoid excessive file I/O operations
        
        // Emit event to notify frontend
        app.emit("window-created", note_id.clone()).map_err(|e| e.to_string())?;
        
        log_info!("DRAG", "Window finalized in place as detached window");
        Ok(())
    } else {
        Err("Drag window not found".to_string())
    }
}

#[tauri::command]
async fn create_detached_window(
    request: CreateDetachedWindowRequest,
    app: tauri::AppHandle,
    detached_windows: State<'_, DetachedWindowsState>,
    notes: State<'_, NotesState>,
) -> Result<DetachedWindow, String> {
    println!("[CREATE_DETACHED_WINDOW] Starting window creation for note: {}", request.note_id);
    println!("[CREATE_DETACHED_WINDOW] Request params: x={:?}, y={:?}, width={:?}, height={:?}", 
        request.x, request.y, request.width, request.height);
    
    // Clean up any existing drag ghost window first
    if let Some(ghost_window) = app.get_webview_window("drag-ghost") {
        println!("[CREATE_DETACHED_WINDOW] Found existing drag ghost window, closing it...");
        let _ = ghost_window.close();
    }
    
    // Check if note exists
    {
        println!("[CREATE_DETACHED_WINDOW] Checking if note exists...");
        let notes_lock = notes.lock().await;
        if !notes_lock.contains_key(&request.note_id) {
            println!("[CREATE_DETACHED_WINDOW] ERROR: Note not found: {}", request.note_id);
            return Err("Note not found".to_string());
        }
        println!("[CREATE_DETACHED_WINDOW] Note exists ✓");
    }

    // Check if window already exists for this note
    let mut windows_lock = detached_windows.lock().await;
    println!("[CREATE_DETACHED_WINDOW] Current windows count: {}", windows_lock.len());
    if windows_lock.values().any(|w| w.note_id == request.note_id) {
        println!("[CREATE_DETACHED_WINDOW] ERROR: Window already exists for note: {}", request.note_id);
        return Err("Window already exists for this note".to_string());
    }
    println!("[CREATE_DETACHED_WINDOW] No existing window for this note ✓");

    let window_label = format!("note-{}", request.note_id);
    println!("[CREATE_DETACHED_WINDOW] Window label: {}", window_label);
    
    // Check if we have a saved position for this note
    println!("[CREATE_DETACHED_WINDOW] Loading saved spatial data...");
    let saved_window = load_spatial_data(&request.note_id).await;
    
    // Use requested dimensions first, then saved, then defaults
    let width = request.width.unwrap_or_else(|| saved_window.as_ref().map(|w| w.size.0).unwrap_or(800.0));
    let height = request.height.unwrap_or_else(|| saved_window.as_ref().map(|w| w.size.1).unwrap_or(600.0));
    
    // For position: if provided in request, use it; otherwise use saved position or calculate offset
    let (mut x, mut y) = if request.x.is_some() && request.y.is_some() {
        (request.x.unwrap(), request.y.unwrap())
    } else if let Some(saved) = saved_window.as_ref() {
        (saved.position.0, saved.position.1)
    } else {
        // Calculate position to avoid overlapping with existing windows
        let offset = windows_lock.len() as f64 * 30.0;
        (100.0 + offset, 100.0 + offset)
    };
    
    // Check if the position would overlap with existing windows
    let mut needs_offset = false;
    for (_, window) in windows_lock.iter() {
        let dx = (window.position.0 - x).abs();
        let dy = (window.position.1 - y).abs();
        // If windows are too close (within 50 pixels), offset the new window
        if dx < 50.0 && dy < 50.0 {
            needs_offset = true;
            break;
        }
    }
    
    if needs_offset {
        // Offset by 30 pixels from the requested position
        x += 30.0;
        y += 30.0;
        println!("[CREATE_DETACHED_WINDOW] Offsetting window position to avoid overlap");
    }
    
    println!("[CREATE_DETACHED_WINDOW] Window dimensions: {}x{} at ({}, {})", width, height, x, y);

    // Create the window
    println!("[CREATE_DETACHED_WINDOW] Creating WebviewWindow...");
    let window_url = format!("index.html?note={}", request.note_id);
    println!("[CREATE_DETACHED_WINDOW] Window URL: {}", window_url);
    
    // Create window with custom title bar
    println!("[CREATE_DETACHED_WINDOW] Building window...");
    let webview_window = WebviewWindowBuilder::new(
        &app,
        &window_label,
        WebviewUrl::App(window_url.into()),
    )
    .title(&format!("Note - {}", request.note_id))
    .inner_size(width, height)
    .position(x, y)
    .visible(true)
    .resizable(true)     // Enable window resizing
    .decorations(false)  // Disable native decorations for custom title bar
    .transparent(true)   // Enable transparency for custom window styling
    .shadow(true)        // Enable window shadow
    .min_inner_size(400.0, 300.0)  // Minimum size for proper display
    .build()
    .map_err(|e| {
        println!("[CREATE_DETACHED_WINDOW] ERROR: Failed to create window: {:?}", e);
        format!("Failed to create window: {}", e)
    })?;
    
    println!("[CREATE_DETACHED_WINDOW] WebviewWindow created successfully ✓");
    
    // Ensure the window is visible
    println!("[CREATE_DETACHED_WINDOW] Showing window...");
    webview_window.show().map_err(|e| {
        println!("[CREATE_DETACHED_WINDOW] ERROR: Failed to show window: {:?}", e);
        format!("Failed to show window: {}", e)
    })?;
    println!("[CREATE_DETACHED_WINDOW] Window shown ✓");

    let detached_window = DetachedWindow {
        note_id: request.note_id.clone(),
        window_label: window_label.clone(),
        position: (x, y),
        size: (width, height),
        always_on_top: false,
        opacity: 1.0,
        is_shaded: false,
        original_height: None,
    };
    println!("[CREATE_DETACHED_WINDOW] DetachedWindow struct created: {:?}", detached_window);

    println!("[CREATE_DETACHED_WINDOW] Inserting window into state...");
    windows_lock.insert(window_label.clone(), detached_window.clone());
    println!("[CREATE_DETACHED_WINDOW] Window inserted into state ✓");
    
    println!("[CREATE_DETACHED_WINDOW] Saving detached windows to disk...");
    save_detached_windows_to_disk(&windows_lock).await.map_err(|e| {
        println!("[CREATE_DETACHED_WINDOW] ERROR: Failed to save windows to disk: {}", e);
        e
    })?;
    println!("[CREATE_DETACHED_WINDOW] Windows saved to disk ✓");
    
    // Update the app menu to include the new window
    drop(windows_lock);
    println!("[CREATE_DETACHED_WINDOW] Updating app menu...");
    update_app_menu(app.clone(), detached_windows.clone(), notes.clone()).await.map_err(|e| {
        println!("[CREATE_DETACHED_WINDOW] ERROR: Failed to update app menu: {}", e);
        e
    })?;
    println!("[CREATE_DETACHED_WINDOW] App menu updated ✓");
    
    // Note: Window position/size tracking is now handled by the frontend useWindowTracking hook
    // with proper debouncing to avoid excessive file I/O operations
    println!("[CREATE_DETACHED_WINDOW] Window tracking delegated to frontend (debounced) ✓");

    println!("[CREATE_DETACHED_WINDOW] Window creation completed successfully! Returning: {:?}", detached_window);
    Ok(detached_window)
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
    
    // Emit event to all windows to notify frontend
    app.emit("window-closed", note_id.clone()).map_err(|e| e.to_string())?;
    log_info!("WINDOW", "Emitted window-closed event for note: {}", note_id);

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

#[tauri::command]
async fn toggle_window_shade(
    window_label: String,
    app: tauri::AppHandle,
    detached_windows: State<'_, DetachedWindowsState>,
) -> Result<bool, String> {
    let mut windows_lock = detached_windows.lock().await;
    
    if let Some(window_data) = windows_lock.get_mut(&window_label) {
        let window = app.get_webview_window(&window_label)
            .ok_or_else(|| format!("Window {} not found", window_label))?;
        
        let current_size = window.inner_size()
            .map_err(|e| format!("Failed to get window size: {}", e))?;
        
        if window_data.is_shaded {
            // Unshade: restore to original height
            if let Some(original_height) = window_data.original_height {
                window.set_size(tauri::Size::Physical(tauri::PhysicalSize {
                    width: current_size.width,
                    height: original_height as u32,
                }))
                .map_err(|e| format!("Failed to restore window size: {}", e))?;
                
                window_data.is_shaded = false;
                window_data.original_height = None;
                window_data.size.1 = original_height;
            }
        } else {
            // Shade: minimize to title bar height (48px to match h-12)
            window_data.original_height = Some(current_size.height as f64);
            window_data.is_shaded = true;
            
            window.set_size(tauri::Size::Physical(tauri::PhysicalSize {
                width: current_size.width,
                height: 48,
            }))
            .map_err(|e| format!("Failed to shade window: {}", e))?;
        }
        
        let is_shaded = window_data.is_shaded;
        save_detached_windows_to_disk(&windows_lock).await?;
        Ok(is_shaded)
    } else {
        Err(format!("Window data not found for {}", window_label))
    }
}

#[tauri::command]
async fn toggle_main_window_shade(
    app: tauri::AppHandle,
    config: State<'_, ConfigState>,
) -> Result<bool, String> {
    let window = app.get_webview_window("main")
        .ok_or("Main window not found")?;
    
    let current_size = window.inner_size()
        .map_err(|e| format!("Failed to get window size: {}", e))?;
    
    // Check if window is currently shaded (height <= 50 to account for rounding)
    let is_currently_shaded = current_size.height <= 50;
    
    if is_currently_shaded {
        // Unshade: restore to config height
        let config_lock = config.lock().await;
        let restore_height = config_lock.window.height;
        drop(config_lock);
        
        window.set_size(tauri::Size::Physical(tauri::PhysicalSize {
            width: current_size.width,
            height: restore_height as u32,
        }))
        .map_err(|e| format!("Failed to restore window size: {}", e))?;
        
        Ok(false)
    } else {
        // Shade: minimize to title bar height
        // First save current height to config
        let mut config_lock = config.lock().await;
        config_lock.window.height = current_size.height as f64;
        let config_clone = config_lock.clone();
        drop(config_lock);
        save_config_to_disk(&config_clone).await?;
        
        window.set_size(tauri::Size::Physical(tauri::PhysicalSize {
            width: current_size.width,
            height: 48,
        }))
        .map_err(|e| format!("Failed to shade window: {}", e))?;
        
        Ok(true)
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
    // Use app data directory for production builds
    let data_dir = if cfg!(debug_assertions) {
        // Development: use project directory
        let current_dir = std::env::current_dir()
            .map_err(|e| format!("Failed to get current directory: {}", e))?;
        current_dir.join("data")
    } else {
        // Production: use app data directory
        dirs::data_dir()
            .ok_or_else(|| "Failed to get data directory".to_string())?
            .join("com.notesapp.dev")
            .join("data")
    };
    
    log_debug!("STORAGE", "Data directory path: {:?}", data_dir);
    Ok(data_dir)
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
        println!("Config file not found, creating default config");
        let default_config = AppConfig::default();
        save_config_to_disk(&default_config).await?;
        return Ok(default_config);
    }
    
    let config_json = fs::read_to_string(&config_file)
        .map_err(|e| format!("Failed to read config from disk: {}", e))?;
    
    println!("Loaded config JSON from disk: {}", config_json);
    
    let config: AppConfig = serde_json::from_str(&config_json)
        .map_err(|e| format!("Failed to parse config JSON: {}", e))?;
    
    println!("Parsed config: opacity={}, alwaysOnTop={}", config.opacity, config.always_on_top);
    
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
    let notes_state = match tauri::async_runtime::block_on(load_notes_from_disk()) {
        Ok(notes) => NotesState::new(notes),
        Err(e) => {
            eprintln!("Failed to load notes from disk: {}", e);
            NotesState::new(HashMap::new())
        }
    };

    let config_state = match tauri::async_runtime::block_on(load_config_from_disk()) {
        Ok(config) => {
            println!("Loaded config from disk: {:?}", config);
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
        .plugin({
            use tauri_plugin_global_shortcut::{Code, Modifiers, Shortcut, ShortcutState};
            
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    log_info!("SHORTCUT-HANDLER", "🎯 Global shortcut handler invoked - Event: {:?}, Shortcut: {:?}", event.state, shortcut);
                    
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
                        } else if shortcut == &simple_shortcut {
                            log_info!("SHORTCUT-HANDLER", "🔥 CMD+SHIFT+N TRIGGERED! Creating new note...");
                            // Emit event to create new note
                            match app.emit("menu-new-note", ()) {
                                Ok(_) => log_info!("SHORTCUT-HANDLER", "✅ Successfully emitted menu-new-note event"),
                                Err(e) => log_error!("SHORTCUT-HANDLER", "❌ Failed to emit menu-new-note event: {}", e),
                            }
                        } else {
                            log_debug!("SHORTCUT-HANDLER", "Shortcut didn't match any registered patterns");
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
            get_config,
            update_config,
            toggle_window_visibility,
            set_window_opacity,
            set_window_always_on_top,
            toggle_all_windows_hover,
            open_system_settings,
            test_emit_new_note,
            set_window_focus,
            create_detached_window,
            close_detached_window,
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
            toggle_main_window_shade
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
                // Make sure window is visible
                if let Err(e) = window.show() {
                    eprintln!("Failed to show window: {}", e);
                }
                
                // Set always on top synchronously
                if let Err(e) = window.set_always_on_top(config_for_init.always_on_top) {
                    eprintln!("Failed to set initial always on top: {}", e);
                }
                
                // For opacity, we still need to use the async command after window is ready
                // We'll rely on the frontend useWindowTransparency hook to apply it
            }
            
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}