use crate::{log_error, log_info};
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;

/// Open system settings (macOS accessibility preferences)
#[tauri::command]
pub async fn open_system_settings() -> Result<(), String> {
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

/// Open a directory in the system file manager
#[tauri::command]
pub async fn open_directory_in_finder(directory_path: String) -> Result<(), String> {
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

/// Open a native directory picker dialog
#[tauri::command]
pub async fn open_directory_dialog(app: AppHandle) -> Result<Option<String>, String> {
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