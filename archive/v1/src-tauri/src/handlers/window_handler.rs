use crate::error::{BlinkError, BlinkResult};
use crate::types::window::DetachedWindow;
use crate::{log_error, log_info};
use std::collections::HashMap;
use std::path::Path;
use tauri::{AppHandle, Manager};

/// Load spatial positioning data for a specific note
pub async fn load_spatial_data(note_id: &str) -> Option<DetachedWindow> {
    use crate::modules::storage::get_default_notes_directory;
    
    let notes_dir = get_default_notes_directory().ok()?;
    let spatial_file = notes_dir.join("spatial_positions.json");
    
    if !spatial_file.exists() {
        return None;
    }
    
    let spatial_json = std::fs::read_to_string(spatial_file).ok()?;
    let spatial_data: HashMap<String, DetachedWindow> = serde_json::from_str(&spatial_json).ok()?;
    
    spatial_data.get(note_id).cloned()
}

/// Save spatial positioning data for a specific note
#[allow(dead_code)]
pub async fn save_spatial_data(note_id: &str, window: &DetachedWindow) -> BlinkResult<()> {
    use crate::modules::storage::get_default_notes_directory;
    
    let notes_dir = get_default_notes_directory()
        .map_err(|e| BlinkError::Storage(format!("Failed to get notes directory: {}", e)))?;
    let spatial_file = notes_dir.join("spatial_positions.json");
    
    // Load existing spatial data
    let mut spatial_data: HashMap<String, DetachedWindow> = if spatial_file.exists() {
        let spatial_json = std::fs::read_to_string(&spatial_file)
            .map_err(|e| BlinkError::Io(e))?;
        serde_json::from_str(&spatial_json)
            .map_err(|e| BlinkError::Serialization(e))?
    } else {
        HashMap::new()
    };
    
    // Update with new data
    spatial_data.insert(note_id.to_string(), window.clone());
    
    // Save back to disk
    let spatial_json = serde_json::to_string_pretty(&spatial_data)
        .map_err(|e| BlinkError::Serialization(e))?;
    
    std::fs::write(spatial_file, spatial_json)
        .map_err(|e| BlinkError::Io(e))?;
    
    Ok(())
}

/// Save window position (currently unused - handled by frontend with debouncing)
#[allow(dead_code)]
pub async fn save_window_position(note_id: String, x: f64, y: f64) -> BlinkResult<()> {
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

/// Save window size (currently unused - handled by frontend with debouncing)
#[allow(dead_code)]
pub async fn save_window_size(note_id: String, width: f64, height: f64) -> BlinkResult<()> {
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

/// Apply initial window settings on startup
pub fn apply_initial_window_settings(app: &AppHandle, config: &crate::types::config::AppConfig) {
    log_info!(
        "STARTUP",
        "Applying initial config settings: opacity={}, alwaysOnTop={}",
        config.opacity,
        config.always_on_top
    );

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

        // Set always on top
        if let Err(e) = window.set_always_on_top(config.always_on_top) {
            log_error!("STARTUP", "Failed to set initial always on top: {}", e);
        } else {
            log_info!(
                "STARTUP",
                "✅ Window.set_always_on_top({}) called successfully",
                config.always_on_top
            );
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
                }
                Err(e) => {
                    log_error!("STARTUP", "Failed to get ns_window: {}", e);
                }
            }
        }

        // Log window status
        match window.is_visible() {
            Ok(visible) => log_info!("STARTUP", "📊 Window visibility status: {}", visible),
            Err(e) => log_error!("STARTUP", "Failed to check window visibility: {}", e),
        }

        match window.outer_position() {
            Ok(pos) => log_info!("STARTUP", "📍 Window position: ({}, {})", pos.x, pos.y),
            Err(e) => log_error!("STARTUP", "Failed to get window position: {}", e),
        }

        match window.inner_size() {
            Ok(size) => log_info!("STARTUP", "📏 Window size: {}x{}", size.width, size.height),
            Err(e) => log_error!("STARTUP", "Failed to get window size: {}", e),
        }

        log_info!("STARTUP", "🔚 Window setup complete");
    } else {
        log_error!("STARTUP", "❌ Could not find main window!");
    }
}