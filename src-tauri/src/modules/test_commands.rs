use crate::{log_error, log_info};
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder, Emitter};

/// Test emitting a new note event
#[tauri::command]
pub async fn test_emit_new_note(app: AppHandle) -> Result<String, String> {
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

/// Test window creation
#[tauri::command]
pub async fn test_window_creation(app: AppHandle) -> Result<String, String> {
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