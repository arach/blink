use std::fs;
use tauri::{AppHandle, Manager, State, WebviewUrl, WebviewWindowBuilder, Emitter};

use crate::types::{
    window::{DetachedWindow, DetachedWindowsState, NotesState, ConfigState, ToggleState, CreateDetachedWindowRequest},
};
use crate::modules::storage::{get_configured_notes_directory, save_config_to_disk, save_detached_windows_to_disk, load_detached_windows_from_disk, get_default_notes_directory};
use crate::{log_info, log_error, log_debug};

#[cfg(target_os = "macos")]
use cocoa::base::id;
#[cfg(target_os = "macos")]
use objc::{msg_send, sel, sel_impl};

// ============================================================================
// CORE WINDOW CONTROL FUNCTIONS
// ============================================================================

#[tauri::command]
pub async fn toggle_window_visibility(app: AppHandle) -> Result<bool, String> {
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
pub async fn set_window_opacity(app: AppHandle, opacity: f64) -> Result<(), String> {
    let window = app.get_webview_window("main").ok_or("Window not found")?;
    
    #[cfg(target_os = "macos")]
    {
        use tauri::Manager;
        let ns_window = window.ns_window().map_err(|e| e.to_string())? as id;
        unsafe {
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
pub async fn set_window_always_on_top(app: AppHandle, always_on_top: bool) -> Result<(), String> {
    let window = app.get_webview_window("main").ok_or("Window not found")?;
    window.set_always_on_top(always_on_top).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn set_window_focus(app: AppHandle) -> Result<(), String> {
    let window = app.get_webview_window("main").ok_or("Main window not found")?;
    window.set_focus().map_err(|e| e.to_string())?;
    window.show().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn force_main_window_visible(app: AppHandle) -> Result<(), String> {
    let window = app.get_webview_window("main").ok_or("Main window not found")?;
    
    log_info!("DEBUG", "Forcing main window to be visible and properly positioned");
    
    // Show the window
    window.show().map_err(|e| {
        log_error!("DEBUG", "Failed to show window: {}", e);
        e.to_string()
    })?;
    
    // Center the window
    window.center().map_err(|e| {
        log_error!("DEBUG", "Failed to center window: {}", e);
        e.to_string()
    })?;
    
    // Set proper size (match tauri.conf.json defaults)
    window.set_size(tauri::Size::Physical(tauri::PhysicalSize {
        width: 1000,
        height: 700,
    })).map_err(|e| {
        log_error!("DEBUG", "Failed to set window size: {}", e);
        e.to_string()
    })?;
    
    // Ensure it's not minimized
    if window.is_minimized().unwrap_or(false) {
        window.unminimize().map_err(|e| {
            log_error!("DEBUG", "Failed to unminimize window: {}", e);
            e.to_string()
        })?;
    }
    
    // Set focus
    window.set_focus().map_err(|e| {
        log_error!("DEBUG", "Failed to set focus: {}", e);
        e.to_string()
    })?;
    
    // Force opacity to be fully visible on macOS
    #[cfg(target_os = "macos")]
    {
        use tauri::Manager;
        let ns_window = window.ns_window().map_err(|e| e.to_string())? as id;
        unsafe {
            let _: () = msg_send![ns_window, setAlphaValue: 1.0];
        }
    }
    
    log_info!("DEBUG", "Main window forced to visible state");
    Ok(())
}

#[tauri::command]
pub async fn debug_webview_state(app: AppHandle) -> Result<String, String> {
    let window = app.get_webview_window("main").ok_or("Main window not found")?;
    
    let mut debug_info = String::new();
    
    // Check basic window properties
    match window.is_visible() {
        Ok(visible) => debug_info.push_str(&format!("Visible: {}\n", visible)),
        Err(e) => debug_info.push_str(&format!("Visible check failed: {}\n", e)),
    }
    
    match window.is_minimized() {
        Ok(minimized) => debug_info.push_str(&format!("Minimized: {}\n", minimized)),
        Err(e) => debug_info.push_str(&format!("Minimized check failed: {}\n", e)),
    }
    
    match window.outer_position() {
        Ok(pos) => debug_info.push_str(&format!("Position: ({}, {})\n", pos.x, pos.y)),
        Err(e) => debug_info.push_str(&format!("Position check failed: {}\n", e)),
    }
    
    match window.inner_size() {
        Ok(size) => debug_info.push_str(&format!("Size: {}x{}\n", size.width, size.height)),
        Err(e) => debug_info.push_str(&format!("Size check failed: {}\n", e)),
    }
    
    // Try to evaluate JavaScript to check if webview is responsive
    match window.eval("window.location.href") {
        Ok(_) => debug_info.push_str("JavaScript evaluation: OK\n"),
        Err(e) => debug_info.push_str(&format!("JavaScript evaluation failed: {}\n", e)),
    }
    
    log_info!("DEBUG", "Webview state: {}", debug_info);
    Ok(debug_info)
}

#[tauri::command]
pub async fn reload_main_window(app: AppHandle) -> Result<(), String> {
    let window = app.get_webview_window("main").ok_or("Main window not found")?;
    
    log_info!("DEBUG", "Reloading main window webview...");
    
    // Force window to reload its content
    window.eval("window.location.reload()").map_err(|e| {
        log_error!("DEBUG", "Failed to reload window: {}", e);
        e.to_string()
    })?;
    
    // Also try showing and focusing after reload
    window.show().map_err(|e| e.to_string())?;
    window.set_focus().map_err(|e| e.to_string())?;
    
    log_info!("DEBUG", "Window reload completed");
    Ok(())
}

// ============================================================================
// MULTI-WINDOW MANAGEMENT
// ============================================================================

#[tauri::command]
pub async fn toggle_all_windows_hover(
    app: AppHandle,
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

// ============================================================================
// DRAG GHOST WINDOW OPERATIONS
// ============================================================================

#[tauri::command]
pub async fn create_drag_ghost(
    app: AppHandle,
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
pub async fn update_drag_ghost_position(
    app: AppHandle,
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
pub async fn destroy_drag_ghost(app: AppHandle) -> Result<(), String> {
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

// ============================================================================
// HYBRID DRAG WINDOW OPERATIONS
// ============================================================================

#[tauri::command]
pub async fn create_hybrid_drag_window(
    app: AppHandle,
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
    
    Ok(window_label)
}

// ============================================================================
// HYBRID DRAG WINDOW OPERATIONS (CONTINUED)
// ============================================================================

#[tauri::command]
pub async fn show_hybrid_drag_window(
    app: AppHandle,
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
pub async fn update_hybrid_drag_position(
    app: AppHandle,
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
pub async fn finalize_hybrid_drag_window(
    app: AppHandle,
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
pub async fn close_hybrid_drag_window(
    app: AppHandle,
    window_label: String,
) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(&window_label) {
        window.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

// ============================================================================
// DETACHED WINDOW MANAGEMENT
// ============================================================================

#[tauri::command]
pub async fn focus_detached_window(
    note_id: String,
    app: AppHandle,
    detached_windows: State<'_, DetachedWindowsState>,
) -> Result<bool, String> {
    let windows_lock = detached_windows.lock().await;
    
    // Find window by note_id
    if let Some((window_label, _)) = windows_lock.iter().find(|(_, w)| w.note_id == note_id) {
        if let Some(window) = app.get_webview_window(window_label) {
            // Show and focus the window
            window.show().map_err(|e| format!("Failed to show window: {}", e))?;
            window.set_focus().map_err(|e| format!("Failed to focus window: {}", e))?;
            
            // If window is minimized, restore it
            if window.is_minimized().unwrap_or(false) {
                window.unminimize().map_err(|e| format!("Failed to unminimize window: {}", e))?;
            }
            
            log_info!("WINDOW", "Focused existing detached window for note: {}", note_id);
            return Ok(true);
        }
    }
    
    log_info!("WINDOW", "No existing detached window found for note: {}", note_id);
    Ok(false)
}

#[tauri::command]
pub async fn create_detached_window(
    request: CreateDetachedWindowRequest,
    app: AppHandle,
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
pub async fn close_detached_window(
    note_id: String,
    app: AppHandle,
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
pub async fn update_detached_window_position(
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
pub async fn update_detached_window_size(
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

// ============================================================================
// WINDOW SHADING FUNCTIONALITY
// ============================================================================

#[tauri::command]
pub async fn toggle_window_shade(
    window_label: String,
    app: AppHandle,
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
pub async fn toggle_main_window_shade(
    app: AppHandle,
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

// ============================================================================
// SPATIAL DATA FUNCTIONS
// ============================================================================

/// Load spatial data for a specific note
async fn load_spatial_data(note_id: &str) -> Option<DetachedWindow> {
    let notes_dir = get_default_notes_directory().ok()?;
    let spatial_file = notes_dir.join(format!("spatial_{}.json", note_id));
    
    if !spatial_file.exists() {
        return None;
    }
    
    let spatial_json = fs::read_to_string(spatial_file).ok()?;
    serde_json::from_str(&spatial_json).ok()
}

/// Save spatial data for a specific note
async fn save_spatial_data(note_id: &str, window_data: &DetachedWindow) -> Result<(), String> {
    let notes_dir = get_default_notes_directory()?;
    fs::create_dir_all(&notes_dir).map_err(|e| format!("Failed to create notes directory: {}", e))?;
    
    let spatial_file = notes_dir.join(format!("spatial_{}.json", note_id));
    let spatial_json = serde_json::to_string_pretty(window_data)
        .map_err(|e| format!("Failed to serialize spatial data: {}", e))?;
    
    fs::write(spatial_file, spatial_json)
        .map_err(|e| format!("Failed to write spatial data to disk: {}", e))?;
    
    Ok(())
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/// Update the app menu to include detached windows
async fn update_app_menu(
    app: AppHandle,
    detached_windows: State<'_, DetachedWindowsState>,
    notes: State<'_, NotesState>,
) -> Result<(), String> {
    // For now, just return Ok - menu functionality would be implemented here
    // This is a placeholder to satisfy the function calls
    Ok(())
}

// ============================================================================
// DEPRECATED FUNCTIONS (KEPT FOR COMPATIBILITY)
// ============================================================================

/// Currently unused - position tracking handled by frontend with debouncing
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

/// Currently unused - size tracking handled by frontend with debouncing
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