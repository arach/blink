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
pub async fn debug_all_windows_state(
    app: AppHandle,
    detached_windows: State<'_, DetachedWindowsState>,
) -> Result<String, String> {
    let mut debug_info = String::new();
    
    // Get all webview windows from Tauri
    let webview_windows = app.webview_windows();
    debug_info.push_str(&format!("=== ALL WINDOWS DEBUG INFO ===\n"));
    debug_info.push_str(&format!("Total Tauri windows: {}\n\n", webview_windows.len()));
    
    // Check each webview window
    for (label, window) in webview_windows.iter() {
        debug_info.push_str(&format!("--- Window: {} ---\n", label));
        
        // Basic properties
        match window.is_visible() {
            Ok(visible) => debug_info.push_str(&format!("  Visible: {}\n", visible)),
            Err(e) => debug_info.push_str(&format!("  Visible check failed: {}\n", e)),
        }
        
        match window.is_minimized() {
            Ok(minimized) => debug_info.push_str(&format!("  Minimized: {}\n", minimized)),
            Err(e) => debug_info.push_str(&format!("  Minimized check failed: {}\n", e)),
        }
        
        match window.outer_position() {
            Ok(pos) => debug_info.push_str(&format!("  Position: ({}, {})\n", pos.x, pos.y)),
            Err(e) => debug_info.push_str(&format!("  Position check failed: {}\n", e)),
        }
        
        match window.inner_size() {
            Ok(size) => debug_info.push_str(&format!("  Size: {}x{}\n", size.width, size.height)),
            Err(e) => debug_info.push_str(&format!("  Size check failed: {}\n", e)),
        }
        
        // Check for platform-specific opacity (macOS)
        #[cfg(target_os = "macos")]
        {
            match window.ns_window() {
                Ok(ns_window) => {
                    let ns_window = ns_window as id;
                    let alpha_value: f64 = unsafe { msg_send![ns_window, alphaValue] };
                    debug_info.push_str(&format!("  macOS Alpha Value: {}\n", alpha_value));
                },
                Err(e) => debug_info.push_str(&format!("  macOS Alpha check failed: {}\n", e)),
            }
        }
        
        // Try to evaluate JavaScript to check if webview is responsive
        match window.eval("window.location.href") {
            Ok(_) => debug_info.push_str("  JavaScript evaluation: OK\n"),
            Err(e) => debug_info.push_str(&format!("  JavaScript evaluation failed: {}\n", e)),
        }
        
        debug_info.push_str("\n");
    }
    
    // Check detached windows state
    let detached_windows_lock = detached_windows.lock().await;
    debug_info.push_str(&format!("=== DETACHED WINDOWS STATE ===\n"));
    debug_info.push_str(&format!("Total detached windows in state: {}\n\n", detached_windows_lock.len()));
    
    for (label, window_data) in detached_windows_lock.iter() {
        debug_info.push_str(&format!("--- Detached Window: {} ---\n", label));
        debug_info.push_str(&format!("  Note ID: {}\n", window_data.note_id));
        debug_info.push_str(&format!("  Position: ({}, {})\n", window_data.position.0, window_data.position.1));
        debug_info.push_str(&format!("  Size: {}x{}\n", window_data.size.0, window_data.size.1));
        debug_info.push_str(&format!("  Always on top: {}\n", window_data.always_on_top));
        debug_info.push_str(&format!("  Stored opacity: {}\n", window_data.opacity));
        debug_info.push_str(&format!("  Is shaded: {:?}\n", window_data.is_shaded));
        
        // Check if this window actually exists in Tauri
        let exists_in_tauri = webview_windows.contains_key(label);
        debug_info.push_str(&format!("  Exists in Tauri: {}\n", exists_in_tauri));
        
        debug_info.push_str("\n");
    }
    
    log_info!("DEBUG", "All windows state: {}", debug_info);
    Ok(debug_info)
}

#[tauri::command]
pub async fn force_all_windows_opaque(app: AppHandle) -> Result<String, String> {
    let mut result = String::new();
    let webview_windows = app.webview_windows();
    
    result.push_str(&format!("=== FORCING ALL WINDOWS TO BE OPAQUE ===\n"));
    result.push_str(&format!("Found {} windows to process\n\n", webview_windows.len()));
    
    for (label, window) in webview_windows.iter() {
        result.push_str(&format!("Processing window: {}\n", label));
        
        // Show the window if it's hidden
        match window.show() {
            Ok(_) => result.push_str("  ✓ Window shown\n"),
            Err(e) => result.push_str(&format!("  ✗ Failed to show window: {}\n", e)),
        }
        
        // Force full opacity on macOS
        #[cfg(target_os = "macos")]
        {
            match window.ns_window() {
                Ok(ns_window) => {
                    let ns_window = ns_window as id;
                    unsafe {
                        let _: () = msg_send![ns_window, setAlphaValue: 1.0f64];
                    }
                    result.push_str("  ✓ macOS opacity set to 1.0\n");
                },
                Err(e) => result.push_str(&format!("  ✗ Failed to set macOS opacity: {}\n", e)),
            }
        }
        
        // Try to focus the window
        match window.set_focus() {
            Ok(_) => result.push_str("  ✓ Window focused\n"),
            Err(e) => result.push_str(&format!("  ✗ Failed to focus window: {}\n", e)),
        }
        
        // Center the window to make it easier to find
        match window.center() {
            Ok(_) => result.push_str("  ✓ Window centered\n"),
            Err(e) => result.push_str(&format!("  ✗ Failed to center window: {}\n", e)),
        }
        
        result.push_str("\n");
    }
    
    result.push_str("=== OPACITY FORCING COMPLETE ===\n");
    log_info!("DEBUG", "Force opaque result: {}", result);
    Ok(result)
}

#[tauri::command]
pub async fn gather_all_windows_to_main_screen(app: AppHandle) -> Result<String, String> {
    let mut result = String::new();
    let webview_windows = app.webview_windows();
    
    result.push_str(&format!("=== GATHERING ALL WINDOWS TO MAIN SCREEN ===\n"));
    result.push_str(&format!("Found {} windows to process\n\n", webview_windows.len()));
    
    for (label, window) in webview_windows.iter() {
        if label == "main" {
            continue; // Skip main window
        }
        
        result.push_str(&format!("Processing window: {}\n", label));
        
        // Get current position
        match window.outer_position() {
            Ok(current_pos) => {
                result.push_str(&format!("  Current position: ({}, {})\n", current_pos.x, current_pos.y));
            },
            Err(e) => {
                result.push_str(&format!("  Could not get current position: {}\n", e));
            }
        }
        
        // Show the window first
        match window.show() {
            Ok(_) => result.push_str("  ✓ Window shown\n"),
            Err(e) => result.push_str(&format!("  ✗ Failed to show window: {}\n", e)),
        }
        
        // Move to center of main screen (safe coordinates)
        let safe_x = 100; // 100px from left edge
        let safe_y = 100; // 100px from top edge
        
        match window.set_position(tauri::Position::Physical(tauri::PhysicalPosition { 
            x: safe_x, 
            y: safe_y 
        })) {
            Ok(_) => result.push_str(&format!("  ✓ Moved to safe position: ({}, {})\n", safe_x, safe_y)),
            Err(e) => result.push_str(&format!("  ✗ Failed to move window: {}\n", e)),
        }
        
        // Set reasonable size
        match window.set_size(tauri::Size::Physical(tauri::PhysicalSize {
            width: 600,
            height: 400,
        })) {
            Ok(_) => result.push_str("  ✓ Set to reasonable size (600x400)\n"),
            Err(e) => result.push_str(&format!("  ✗ Failed to set size: {}\n", e)),
        }
        
        // Force full opacity
        #[cfg(target_os = "macos")]
        {
            match window.ns_window() {
                Ok(ns_window) => {
                    let ns_window = ns_window as id;
                    unsafe {
                        let _: () = msg_send![ns_window, setAlphaValue: 1.0f64];
                    }
                    result.push_str("  ✓ Set to full opacity\n");
                },
                Err(e) => result.push_str(&format!("  ✗ Failed to set opacity: {}\n", e)),
            }
        }
        
        // Focus the window
        match window.set_focus() {
            Ok(_) => result.push_str("  ✓ Window focused\n"),
            Err(e) => result.push_str(&format!("  ✗ Failed to focus window: {}\n", e)),
        }
        
        result.push_str("\n");
    }
    
    result.push_str("=== GATHERING COMPLETE ===\n");
    log_info!("DEBUG", "Gather windows result: {}", result);
    Ok(result)
}

#[tauri::command]
pub async fn recreate_missing_windows(
    app: AppHandle,
    detached_windows: State<'_, DetachedWindowsState>,
) -> Result<String, String> {
    let mut result = String::new();
    let webview_windows = app.webview_windows();
    
    result.push_str(&format!("=== RECREATING MISSING WINDOWS ===\n"));
    
    let detached_windows_lock = detached_windows.lock().await;
    let windows_to_recreate: Vec<_> = detached_windows_lock.iter()
        .filter(|(label, _)| !label.starts_with("hybrid-drag-")) // Skip hybrid drag windows
        .filter(|(label, _)| !webview_windows.contains_key(*label)) // Only missing windows
        .map(|(label, window_data)| (label.clone(), window_data.clone()))
        .collect();
    
    result.push_str(&format!("Found {} missing windows to recreate\n\n", windows_to_recreate.len()));
    
    for (label, window_data) in windows_to_recreate {
        result.push_str(&format!("Recreating window: {}\n", label));
        result.push_str(&format!("  Note ID: {}\n", window_data.note_id));
        result.push_str(&format!("  Stored position: ({}, {})\n", window_data.position.0, window_data.position.1));
        
        // Create the window URL
        let window_url = format!("/?note={}", window_data.note_id);
        
        // Create the webview window
        match WebviewWindowBuilder::new(
            &app,
            &label,
            WebviewUrl::App(window_url.into()),
        )
        .title(&format!("Note - {}", window_data.note_id))
        .inner_size(window_data.size.0, window_data.size.1)
        .position(100.0, 100.0) // Use safe position instead of stored position
        .visible(true)
        .resizable(true)
        .decorations(false)
        .transparent(true)
        .shadow(true)
        .min_inner_size(400.0, 300.0)
        .build() {
            Ok(window) => {
                result.push_str("  ✓ Window created successfully\n");
                
                // Show and focus the window
                if let Err(e) = window.show() {
                    result.push_str(&format!("  ⚠ Failed to show window: {}\n", e));
                }
                
                if let Err(e) = window.set_focus() {
                    result.push_str(&format!("  ⚠ Failed to focus window: {}\n", e));
                }
                
                // Set full opacity
                #[cfg(target_os = "macos")]
                {
                    match window.ns_window() {
                        Ok(ns_window) => {
                            let ns_window = ns_window as id;
                            unsafe {
                                let _: () = msg_send![ns_window, setAlphaValue: 1.0f64];
                            }
                            result.push_str("  ✓ Set to full opacity\n");
                        },
                        Err(e) => result.push_str(&format!("  ⚠ Failed to set opacity: {}\n", e)),
                    }
                }
                
                result.push_str("  ✓ Window recreated and configured\n");
            },
            Err(e) => {
                result.push_str(&format!("  ✗ Failed to create window: {}\n", e));
            }
        }
        
        result.push_str("\n");
    }
    
    // Clean up hybrid drag windows from state
    let hybrid_windows: Vec<_> = detached_windows_lock.keys()
        .filter(|label| label.starts_with("hybrid-drag-"))
        .cloned()
        .collect();
    
    drop(detached_windows_lock); // Release lock before modification
    
    if !hybrid_windows.is_empty() {
        result.push_str(&format!("Cleaning up {} hybrid drag windows from state\n", hybrid_windows.len()));
        let mut detached_windows_lock = detached_windows.lock().await;
        for label in hybrid_windows {
            detached_windows_lock.remove(&label);
            result.push_str(&format!("  ✓ Removed hybrid window: {}\n", label));
        }
    }
    
    result.push_str("=== RECREATION COMPLETE ===\n");
    log_info!("DEBUG", "Recreate windows result: {}", result);
    Ok(result)
}

#[tauri::command]
pub async fn cleanup_stale_hybrid_windows(
    app: AppHandle,
    detached_windows: State<'_, DetachedWindowsState>,
) -> Result<String, String> {
    let mut result = String::new();
    result.push_str("=== CLEANING UP STALE HYBRID WINDOWS ===\n");
    
    let mut windows_lock = detached_windows.lock().await;
    let hybrid_labels: Vec<String> = windows_lock.keys()
        .filter(|k| k.starts_with("hybrid-drag-"))
        .cloned()
        .collect();
    
    result.push_str(&format!("Found {} hybrid windows to clean up\n", hybrid_labels.len()));
    
    for window_label in hybrid_labels {
        // Close the Tauri window
        if let Some(window) = app.get_webview_window(&window_label) {
            window.close().map_err(|e| format!("Failed to close window: {}", e))?;
            result.push_str(&format!("✓ Closed Tauri window: {}\n", window_label));
        }
        
        // Remove from backend state
        windows_lock.remove(&window_label);
        result.push_str(&format!("✓ Removed from backend state: {}\n", window_label));
    }
    
    // Save state
    save_detached_windows_to_disk(&windows_lock).await?;
    result.push_str("✓ Saved state to disk\n");
    
    result.push_str("=== CLEANUP COMPLETE ===\n");
    Ok(result)
}

#[tauri::command]
pub async fn list_all_windows(app: AppHandle) -> Result<Vec<String>, String> {
    let webview_windows = app.webview_windows();
    let mut window_list = Vec::new();
    
    for (label, window) in webview_windows.iter() {
        let mut info = format!("{}", label);
        
        // Add visibility status
        if let Ok(visible) = window.is_visible() {
            info.push_str(if visible { " (visible)" } else { " (hidden)" });
        }
        
        // Add position if available
        if let Ok(pos) = window.outer_position() {
            info.push_str(&format!(" at ({}, {})", pos.x, pos.y));
        }
        
        // Add size if available
        if let Ok(size) = window.inner_size() {
            info.push_str(&format!(" size {}x{}", size.width, size.height));
        }
        
        window_list.push(info);
    }
    
    log_info!("DEBUG", "Listed {} windows", window_list.len());
    Ok(window_list)
}

#[tauri::command]
pub async fn create_test_window(app: AppHandle) -> Result<(), String> {
    let test_label = "test-window";
    
    // Close existing test window if it exists
    if let Some(existing) = app.get_webview_window(test_label) {
        existing.close().map_err(|e| e.to_string())?;
    }
    
    // Create new test window
    WebviewWindowBuilder::new(
        &app,
        test_label,
        WebviewUrl::App("index.html".into()),
    )
    .title("Test Window")
    .inner_size(400.0, 300.0)
    .position(200.0, 200.0)
    .visible(true)
    .build()
    .map_err(|e| format!("Failed to create test window: {}", e))?;
    
    log_info!("DEBUG", "Test window created");
    Ok(())
}

#[tauri::command]
pub async fn test_window_events(app: AppHandle) -> Result<(), String> {
    log_info!("DEBUG", "Testing window events");
    
    // Emit a test event to all windows
    app.emit("test-event", "Hello from backend!").map_err(|e| e.to_string())?;
    
    // Try to trigger various window events
    if let Some(main_window) = app.get_webview_window("main") {
        main_window.emit("test-window-event", "Direct window event").map_err(|e| e.to_string())?;
    }
    
    Ok(())
}

#[tauri::command]
pub async fn force_create_detached_window(
    app: AppHandle,
    note_id: String,
    detached_windows: State<'_, DetachedWindowsState>,
    notes: State<'_, NotesState>,
) -> Result<(), String> {
    log_info!("DEBUG", "Force creating detached window for note: {}", note_id);
    
    let request = CreateDetachedWindowRequest {
        note_id: note_id.clone(),
        x: Some(300.0),
        y: Some(300.0),
        width: Some(600.0),
        height: Some(400.0),
    };
    
    create_detached_window(request, app, detached_windows, notes).await.map(|_| ())
}

#[tauri::command]
pub async fn cleanup_stale_windows(
    app: AppHandle,
    detached_windows: State<'_, DetachedWindowsState>,
) -> Result<usize, String> {
    let mut count = 0;
    let webview_windows = app.webview_windows();
    let mut windows_lock = detached_windows.lock().await;
    
    // Find windows in state that don't exist in Tauri
    let stale_windows: Vec<String> = windows_lock.keys()
        .filter(|label| !webview_windows.contains_key(*label))
        .cloned()
        .collect();
    
    for label in stale_windows {
        windows_lock.remove(&label);
        count += 1;
        log_info!("DEBUG", "Removed stale window from state: {}", label);
    }
    
    if count > 0 {
        save_detached_windows_to_disk(&windows_lock).await?;
    }
    
    Ok(count)
}

#[tauri::command]
pub async fn force_close_test_window(
    app: AppHandle,
    detached_windows: State<'_, DetachedWindowsState>,
) -> Result<String, String> {
    let mut result = String::new();
    result.push_str("=== FORCE CLOSING TEST WINDOW ===\n");
    
    let window_label = "note-test-note-12345";
    
    // Close the Tauri window
    if let Some(window) = app.get_webview_window(window_label) {
        window.close().map_err(|e| format!("Failed to close window: {}", e))?;
        result.push_str("✓ Closed Tauri window\n");
    } else {
        result.push_str("✗ No Tauri window found\n");
    }
    
    // Clean up backend state
    let mut windows_lock = detached_windows.lock().await;
    if windows_lock.remove(window_label).is_some() {
        result.push_str("✓ Removed from backend state\n");
        save_detached_windows_to_disk(&windows_lock).await?;
        result.push_str("✓ Saved state to disk\n");
    } else {
        result.push_str("✗ Not found in backend state\n");
    }
    
    result.push_str("=== COMPLETE ===\n");
    Ok(result)
}

#[tauri::command]
pub async fn test_detached_window_creation(
    app: AppHandle,
    detached_windows: State<'_, DetachedWindowsState>,
) -> Result<String, String> {
    let mut result = String::new();
    
    result.push_str("=== TESTING DETACHED WINDOW CREATION ===\n");
    
    // Create a test note ID
    let test_note_id = "test-note-12345".to_string();
    let window_label = format!("note-{}", test_note_id);
    
    result.push_str(&format!("Creating test detached window for note: {}\n", test_note_id));
    result.push_str(&format!("Window label: {}\n", window_label));
    
    // Check if window already exists
    let webview_windows = app.webview_windows();
    if webview_windows.contains_key(&window_label) {
        result.push_str("⚠ Test window already exists, closing it first...\n");
        if let Some(window) = webview_windows.get(&window_label) {
            window.close().map_err(|e| format!("Failed to close existing window: {}", e))?;
        }
        
        // Also clean up backend state
        let mut detached_windows_lock = detached_windows.lock().await;
        detached_windows_lock.remove(&window_label);
        drop(detached_windows_lock);
        
        // Wait a bit for the window to fully close
        tokio::time::sleep(tokio::time::Duration::from_millis(200)).await;
        result.push_str("✓ Cleaned up existing window\n");
    }
    
    // Create the window URL
    let window_url = format!("/?note={}", test_note_id);
    
    // Create the webview window
    match WebviewWindowBuilder::new(
        &app,
        &window_label,
        WebviewUrl::App(window_url.into()),
    )
    .title(&format!("Test Note Window - {}", test_note_id))
    .inner_size(600.0, 400.0)
    .position(200.0, 200.0) // Safe, visible position
    .visible(true)
    .resizable(true)
    .decorations(false)
    .transparent(true)
    .shadow(true)
    .min_inner_size(400.0, 300.0)
    .build() {
        Ok(window) => {
            result.push_str("✓ Test detached window created successfully\n");
            
            // Show and focus the window
            if let Err(e) = window.show() {
                result.push_str(&format!("⚠ Failed to show window: {}\n", e));
            } else {
                result.push_str("✓ Window shown\n");
            }
            
            if let Err(e) = window.set_focus() {
                result.push_str(&format!("⚠ Failed to focus window: {}\n", e));
            } else {
                result.push_str("✓ Window focused\n");
            }
            
            // Set full opacity
            #[cfg(target_os = "macos")]
            {
                match window.ns_window() {
                    Ok(ns_window) => {
                        let ns_window = ns_window as id;
                        unsafe {
                            let _: () = msg_send![ns_window, setAlphaValue: 1.0f64];
                        }
                        result.push_str("✓ Set to full opacity\n");
                    },
                    Err(e) => result.push_str(&format!("⚠ Failed to set opacity: {}\n", e)),
                }
            }
            
            // Add to detached windows state
            let test_window = DetachedWindow {
                note_id: test_note_id.clone(),
                window_label: window_label.clone(),
                position: (200.0, 200.0),
                size: (600.0, 400.0),
                always_on_top: false,
                opacity: 1.0,
                is_shaded: false,
                original_height: None,
            };
            
            let mut detached_windows_lock = detached_windows.lock().await;
            detached_windows_lock.insert(window_label.clone(), test_window);
            result.push_str("✓ Added to detached windows state\n");
            
            result.push_str("✓ Test detached window fully configured and visible\n");
        },
        Err(e) => {
            result.push_str(&format!("✗ Failed to create test detached window: {}\n", e));
        }
    }
    
    result.push_str("=== TEST COMPLETE ===\n");
    log_info!("DEBUG", "Test detached window result: {}", result);
    Ok(result)
}

#[tauri::command]
pub async fn get_window_state_truth(
    app: AppHandle,
    detached_windows: State<'_, DetachedWindowsState>,
) -> Result<String, String> {
    let mut truth = String::new();
    
    truth.push_str("=== WINDOW STATE TRUTH ===\n\n");
    
    // 1. Get all Tauri windows
    let tauri_windows = app.webview_windows();
    truth.push_str(&format!("TAURI WINDOWS ({})\n", tauri_windows.len()));
    truth.push_str("─────────────────────\n");
    
    for (label, window) in tauri_windows.iter() {
        truth.push_str(&format!("Label: {}\n", label));
        
        // Get window properties
        match window.is_visible() {
            Ok(v) => truth.push_str(&format!("  Visible: {}\n", v)),
            Err(e) => truth.push_str(&format!("  Visible: ERROR - {}\n", e)),
        }
        
        match window.outer_position() {
            Ok(p) => truth.push_str(&format!("  Position: ({}, {})\n", p.x, p.y)),
            Err(e) => truth.push_str(&format!("  Position: ERROR - {}\n", e)),
        }
        
        match window.inner_size() {
            Ok(s) => truth.push_str(&format!("  Size: {}x{}\n", s.width, s.height)),
            Err(e) => truth.push_str(&format!("  Size: ERROR - {}\n", e)),
        }
        
        match window.is_minimized() {
            Ok(m) => truth.push_str(&format!("  Minimized: {}\n", m)),
            Err(_) => {},
        }
        
        #[cfg(target_os = "macos")]
        {
            match window.ns_window() {
                Ok(ns_window) => {
                    let ns_window = ns_window as id;
                    let alpha: f64 = unsafe { msg_send![ns_window, alphaValue] };
                    truth.push_str(&format!("  Alpha: {}\n", alpha));
                },
                Err(_) => {},
            }
        }
        
        truth.push_str("\n");
    }
    
    // 2. Get backend state
    let backend_windows = detached_windows.lock().await;
    truth.push_str(&format!("BACKEND STATE ({})\n", backend_windows.len()));
    truth.push_str("─────────────────────\n");
    
    for (label, window_data) in backend_windows.iter() {
        truth.push_str(&format!("Label: {}\n", label));
        truth.push_str(&format!("  Note ID: {}\n", window_data.note_id));
        truth.push_str(&format!("  Type: {}\n", 
            if label.starts_with("hybrid-drag-") { "HYBRID" } 
            else if label.starts_with("note-") { "DETACHED" }
            else { "UNKNOWN" }
        ));
        truth.push_str(&format!("  Stored Position: ({}, {})\n", window_data.position.0, window_data.position.1));
        truth.push_str(&format!("  Stored Size: {}x{}\n", window_data.size.0, window_data.size.1));
        truth.push_str(&format!("  Stored Opacity: {}\n", window_data.opacity));
        
        // Check if it exists in Tauri
        let exists_in_tauri = tauri_windows.contains_key(label);
        truth.push_str(&format!("  EXISTS IN TAURI: {}\n", 
            if exists_in_tauri { "✓ YES" } else { "✗ NO (ORPHANED)" }
        ));
        
        truth.push_str("\n");
    }
    
    // 3. Find discrepancies
    truth.push_str("DISCREPANCIES\n");
    truth.push_str("─────────────────────\n");
    
    // Windows in Tauri but not in backend
    let mut tauri_only = Vec::new();
    for label in tauri_windows.keys() {
        if !backend_windows.contains_key(label) && (label.starts_with("note-") || label.starts_with("hybrid-drag-")) {
            tauri_only.push(label);
        }
    }
    
    if !tauri_only.is_empty() {
        truth.push_str("Windows in Tauri but NOT in backend:\n");
        for label in tauri_only {
            truth.push_str(&format!("  - {} (UNTRACKED)\n", label));
        }
        truth.push_str("\n");
    }
    
    // Windows in backend but not in Tauri
    let mut backend_only = Vec::new();
    for label in backend_windows.keys() {
        if !tauri_windows.contains_key(label) {
            backend_only.push(label);
        }
    }
    
    if !backend_only.is_empty() {
        truth.push_str("Windows in backend but NOT in Tauri:\n");
        for label in backend_only {
            truth.push_str(&format!("  - {} (ORPHANED STATE)\n", label));
        }
        truth.push_str("\n");
    }
    
    // Hybrid windows that should be cleaned
    let mut stale_hybrids = Vec::new();
    for label in backend_windows.keys() {
        if label.starts_with("hybrid-drag-") {
            stale_hybrids.push(label);
        }
    }
    
    if !stale_hybrids.is_empty() {
        truth.push_str("Stale hybrid windows in backend:\n");
        for label in stale_hybrids {
            truth.push_str(&format!("  - {} (SHOULD BE CLEANED)\n", label));
        }
    }
    
    truth.push_str("\n=== END WINDOW STATE TRUTH ===\n");
    
    log_info!("STATE_TRUTH", "Generated window state truth report");
    Ok(truth)
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
    let drag_window = WebviewWindowBuilder::new(
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
    
    // Set up lifecycle tracking for hybrid windows
    let window_label_for_events = window_label.clone();
    let app_for_events = app.clone();
    
    drag_window.on_window_event(move |event| {
        match event {
            tauri::WindowEvent::Destroyed => {
                log_info!("WINDOW_LIFECYCLE", "Hybrid window {} destroyed", window_label_for_events);
                let label = window_label_for_events.clone();
                let app = app_for_events.clone();
                
                // Emit event to frontend
                app.emit("hybrid-window-destroyed", &label).unwrap_or_else(|e| {
                    log_error!("WINDOW_LIFECYCLE", "Failed to emit hybrid-window-destroyed event: {}", e);
                });
            },
            _ => {}
        }
    });
    
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
pub async fn restore_detached_windows(
    app: AppHandle,
    detached_windows: State<'_, DetachedWindowsState>,
    _notes: State<'_, NotesState>,
) -> Result<Vec<String>, String> {
    let mut windows_lock = detached_windows.lock().await;
    let mut restored_windows = Vec::new();
    let mut windows_to_remove = Vec::new();
    
    println!("[RESTORE_WINDOWS] Checking {} windows in state", windows_lock.len());
    
    for (window_label, window_data) in windows_lock.iter() {
        if let Some(window) = app.get_webview_window(window_label) {
            // Window exists, check if it's visible
            match window.is_visible() {
                Ok(visible) => {
                    if !visible {
                        println!("[RESTORE_WINDOWS] Showing hidden window: {}", window_label);
                        window.show().map_err(|e| e.to_string())?;
                        window.set_focus().map_err(|e| e.to_string())?;
                        restored_windows.push(window_label.clone());
                    } else {
                        println!("[RESTORE_WINDOWS] Window already visible: {}", window_label);
                    }
                },
                Err(e) => {
                    println!("[RESTORE_WINDOWS] Failed to check visibility for {}: {}", window_label, e);
                }
            }
        } else {
            // Window doesn't exist, recreate it
            println!("[RESTORE_WINDOWS] Recreating missing window: {}", window_label);
            let _request = CreateDetachedWindowRequest {
                note_id: window_data.note_id.clone(),
                x: Some(window_data.position.0),
                y: Some(window_data.position.1),
                width: Some(window_data.size.0),
                height: Some(window_data.size.1),
            };
            
            // Don't recreate windows in restore - just remove them from state
            println!("[RESTORE_WINDOWS] Removing missing window from state: {}", window_label);
            windows_to_remove.push(window_label.clone());
        }
    }
    
    // Remove windows that couldn't be restored
    for window_label in windows_to_remove {
        windows_lock.remove(&window_label);
    }
    
    if !restored_windows.is_empty() {
        save_detached_windows_to_disk(&windows_lock).await?;
    }
    
    println!("[RESTORE_WINDOWS] Restored {} windows", restored_windows.len());
    Ok(restored_windows)
}

#[tauri::command]
pub async fn clear_all_detached_windows(
    app: AppHandle,
    detached_windows: State<'_, DetachedWindowsState>,
) -> Result<i32, String> {
    let mut windows_lock = detached_windows.lock().await;
    let window_count = windows_lock.len() as i32;
    
    println!("[CLEAR_WINDOWS] Clearing {} detached windows", window_count);
    
    // Close all actual Tauri windows
    for (window_label, _) in windows_lock.iter() {
        if let Some(window) = app.get_webview_window(window_label) {
            println!("[CLEAR_WINDOWS] Closing window: {}", window_label);
            let _ = window.close();
        }
    }
    
    // Clear all from state
    windows_lock.clear();
    
    // Save empty state to disk
    save_detached_windows_to_disk(&windows_lock).await?;
    
    println!("[CLEAR_WINDOWS] All {} detached windows cleared", window_count);
    Ok(window_count)
}

#[tauri::command]
pub async fn focus_detached_window(
    note_id: String,
    app: AppHandle,
    detached_windows: State<'_, DetachedWindowsState>,
) -> Result<bool, String> {
    let windows_lock = detached_windows.lock().await;
    println!("[FOCUS_DETACHED_WINDOW] Looking for note: {}", note_id);
    
    // Find window by note_id (only in note-* windows, not hybrid-drag)
    if let Some((window_label, _window_data)) = windows_lock.iter().find(|(label, w)| {
        label.starts_with("note-") && w.note_id == note_id
    }) {
        println!("[FOCUS_DETACHED_WINDOW] Found window in state: {} -> {}", window_label, note_id);
        
        if let Some(window) = app.get_webview_window(window_label) {
            println!("[FOCUS_DETACHED_WINDOW] ✅ Tauri window found, attempting to focus...");
            
            // Show and focus the window
            window.show().map_err(|e| format!("Failed to show window: {}", e))?;
            window.set_focus().map_err(|e| format!("Failed to focus window: {}", e))?;
            
            // If window is minimized, restore it
            if window.is_minimized().unwrap_or(false) {
                window.unminimize().map_err(|e| format!("Failed to unminimize window: {}", e))?;
            }
            
            println!("[FOCUS_DETACHED_WINDOW] ✅ Successfully focused window for note: {}", note_id);
            log_info!("WINDOW", "Focused existing detached window for note: {}", note_id);
            return Ok(true);
        } else {
            println!("[FOCUS_DETACHED_WINDOW] ❌ Window found in state but Tauri window doesn't exist: {}", window_label);
            println!("[FOCUS_DETACHED_WINDOW] ❌ Window may have been closed but not cleaned up from state");
        }
    } else {
        println!("[FOCUS_DETACHED_WINDOW] ❌ No note window found in state for note: {}", note_id);
    }
    
    println!("[FOCUS_DETACHED_WINDOW] ❌ Failed to focus window for note: {}", note_id);
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
    println!("[CREATE_DETACHED_WINDOW] === BACKEND WINDOWS STATE ===");
    for (window_label, window) in windows_lock.iter() {
        println!("[CREATE_DETACHED_WINDOW] Backend window: {} -> note_id: {}, position: ({}, {})", 
            window_label, window.note_id, window.position.0, window.position.1);
    }
    println!("[CREATE_DETACHED_WINDOW] === END BACKEND WINDOWS STATE ===");
    
    // Only check for actual note windows (not hybrid-drag windows)
    let existing_note_window = windows_lock
        .iter()
        .find(|(window_label, window)| {
            window_label.starts_with("note-") && window.note_id == request.note_id
        });
    
    if existing_note_window.is_some() {
        println!("[CREATE_DETACHED_WINDOW] ERROR: Note window already exists for note: {}", request.note_id);
        return Err("Window already exists for this note".to_string());
    }
    println!("[CREATE_DETACHED_WINDOW] No existing note window for this note ✓");

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
    
    // Set focus to ensure it's brought to front
    webview_window.set_focus().map_err(|e| {
        println!("[CREATE_DETACHED_WINDOW] WARNING: Failed to set focus: {:?}", e);
        e.to_string()
    }).unwrap_or_else(|e| {
        println!("[CREATE_DETACHED_WINDOW] Focus warning: {}", e);
    });
    
    // Verify window is actually visible
    match webview_window.is_visible() {
        Ok(visible) => println!("[CREATE_DETACHED_WINDOW] Window visibility check: {}", visible),
        Err(e) => println!("[CREATE_DETACHED_WINDOW] ERROR: Failed to check visibility: {:?}", e),
    }

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
    
    // Set up window event listeners for lifecycle tracking
    let window_label_for_events = window_label.clone();
    let app_handle_for_events = app.clone();
    let note_id_for_events = request.note_id.clone();
    
    webview_window.on_window_event(move |event| {
        match event {
            tauri::WindowEvent::Destroyed => {
                log_info!("WINDOW_LIFECYCLE", "Window {} destroyed via OS", window_label_for_events);
                let note_id = note_id_for_events.clone();
                let app = app_handle_for_events.clone();
                
                // Simply emit the event - let the frontend handle state cleanup
                // This avoids the lifetime issue with accessing state in the closure
                app.emit("window-destroyed", &note_id).unwrap_or_else(|e| {
                    log_error!("WINDOW_LIFECYCLE", "Failed to emit window-destroyed event: {}", e);
                });
                
                log_info!("WINDOW_LIFECYCLE", "Emitted window-destroyed event for note {}", note_id);
            },
            tauri::WindowEvent::CloseRequested { api: _, .. } => {
                log_info!("WINDOW_LIFECYCLE", "Window {} close requested", window_label_for_events);
                // Allow the close - the Destroyed event will handle cleanup
            },
            _ => {}
        }
    });
    
    println!("[CREATE_DETACHED_WINDOW] Window lifecycle listeners attached ✓");
    
    // Note: Window position/size tracking is now handled by the frontend useWindowTracking hook
    // with proper debouncing to avoid excessive file I/O operations
    println!("[CREATE_DETACHED_WINDOW] Window tracking delegated to frontend (debounced) ✓");

    println!("[CREATE_DETACHED_WINDOW] Window creation completed successfully! Returning: {:?}", detached_window);
    Ok(detached_window)
}

#[tauri::command]
pub async fn cleanup_destroyed_window(
    note_id: String,
    detached_windows: State<'_, DetachedWindowsState>,
) -> Result<(), String> {
    let mut windows_lock = detached_windows.lock().await;
    
    // Find and remove window by note_id
    let window_label = format!("note-{}", note_id);
    if windows_lock.remove(&window_label).is_some() {
        log_info!("WINDOW_LIFECYCLE", "Cleaned up destroyed window state for note {}", note_id);
        save_detached_windows_to_disk(&windows_lock).await?;
    }
    
    Ok(())
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
    _app: AppHandle,
    _detached_windows: State<'_, DetachedWindowsState>,
    _notes: State<'_, NotesState>,
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