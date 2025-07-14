use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;
use tauri::{AppHandle, Manager};

use crate::modules::file_storage::FileStorageManager;
use crate::types::{
    workspace::{WindowState, WorkspaceState},
    config::AppConfig,
    window::DetachedWindow,
};
use crate::{log_info, log_error, log_debug};

/// Service for managing window state with persistent storage
pub struct WindowService {
    storage: Arc<Mutex<FileStorageManager>>,
    app_handle: AppHandle,
    active_windows: Arc<Mutex<HashMap<String, DetachedWindow>>>,
}

impl WindowService {
    pub fn new(config: &AppConfig, app_handle: AppHandle) -> Result<Self, String> {
        let storage = FileStorageManager::new(config)?;
        
        Ok(Self {
            storage: Arc::new(Mutex::new(storage)),
            app_handle,
            active_windows: Arc::new(Mutex::new(HashMap::new())),
        })
    }
    
    /// Initialize the service and load window states
    pub async fn initialize(&self) -> Result<(), String> {
        log_info!("WINDOW_SERVICE", "Initializing window service...");
        
        // Load workspace state
        let storage = self.storage.lock().await;
        let workspace = storage.load_workspace_state().await?;
        
        // Restore detached windows
        let mut restored_count = 0;
        for (note_id, window_state) in workspace.window_states {
            if window_state.is_detached {
                match self.restore_window(&note_id, &window_state).await {
                    Ok(true) => restored_count += 1,
                    Ok(false) => log_debug!("WINDOW_SERVICE", "Skipped restoring window for note: {}", note_id),
                    Err(e) => log_error!("WINDOW_SERVICE", "Failed to restore window for note {}: {}", note_id, e),
                }
            }
        }
        
        log_info!("WINDOW_SERVICE", "Window service initialized, restored {} windows", restored_count);
        
        Ok(())
    }
    
    /// Create a detached window
    pub async fn create_detached_window(
        &self,
        note_id: &str,
        x: Option<f64>,
        y: Option<f64>,
        width: Option<f64>,
        height: Option<f64>,
        grid_position: Option<u8>,
    ) -> Result<DetachedWindow, String> {
        log_info!("WINDOW_SERVICE", "Creating detached window for note: {}", note_id);
        
        // Check if window already exists
        let active_windows = self.active_windows.lock().await;
        if active_windows.contains_key(note_id) {
            return Err("Window already exists for this note".to_string());
        }
        drop(active_windows);
        
        // Create window state
        let window_state = WindowState {
            note_id: note_id.to_string(),
            grid_position,
            custom_position: if x.is_some() && y.is_some() {
                Some((x.unwrap(), y.unwrap()))
            } else {
                None
            },
            size: (width.unwrap_or(800.0), height.unwrap_or(600.0)),
            last_focused: chrono::Utc::now().to_rfc3339(),
            is_detached: true,
            always_on_top: false,
            opacity: 1.0,
        };
        
        // Create the actual Tauri window
        let window_label = format!("note-{}", note_id);
        let webview_url = format!("/?note={}", note_id);
        
        let _window = tauri::WebviewWindowBuilder::new(
            &self.app_handle,
            &window_label,
            tauri::WebviewUrl::App(webview_url.parse().unwrap()),
        )
        .title("Blink Note")
        .inner_size(window_state.size.0, window_state.size.1)
        .position(
            window_state.custom_position.unwrap_or((100.0, 100.0)).0,
            window_state.custom_position.unwrap_or((100.0, 100.0)).1,
        )
        .resizable(true)
        .transparent(true)
        .decorations(false)
        .shadow(false)
        .build()
        .map_err(|e| format!("Failed to create window: {}", e))?;
        
        // Create detached window info
        let detached_window = DetachedWindow {
            note_id: note_id.to_string(),
            window_label: window_label.clone(),
            position: window_state.custom_position.unwrap_or((100.0, 100.0)),
            size: window_state.size,
            always_on_top: window_state.always_on_top,
            opacity: window_state.opacity,
            is_shaded: false,
            original_height: Some(window_state.size.1),
        };
        
        // Store in active windows
        let mut active_windows = self.active_windows.lock().await;
        active_windows.insert(note_id.to_string(), detached_window.clone());
        
        // Save window state to disk
        let storage = self.storage.lock().await;
        storage.save_window_state(note_id, &window_state).await?;
        
        log_info!("WINDOW_SERVICE", "Created detached window: {}", window_label);
        
        Ok(detached_window)
    }
    
    /// Close a detached window
    pub async fn close_detached_window(&self, note_id: &str) -> Result<bool, String> {
        log_info!("WINDOW_SERVICE", "Closing detached window for note: {}", note_id);
        
        let window_label = format!("note-{}", note_id);
        
        // Close the Tauri window
        if let Some(window) = self.app_handle.get_webview_window(&window_label) {
            window.close().map_err(|e| format!("Failed to close window: {}", e))?;
        }
        
        // Remove from active windows
        let mut active_windows = self.active_windows.lock().await;
        active_windows.remove(note_id);
        
        // Update window state on disk
        let storage = self.storage.lock().await;
        if let Ok(Some(mut window_state)) = storage.load_window_state(note_id).await {
            window_state.is_detached = false;
            storage.save_window_state(note_id, &window_state).await?;
        }
        
        log_info!("WINDOW_SERVICE", "Closed detached window: {}", window_label);
        
        Ok(true)
    }
    
    /// Focus a detached window
    pub async fn focus_detached_window(&self, note_id: &str) -> Result<bool, String> {
        log_debug!("WINDOW_SERVICE", "Focusing detached window for note: {}", note_id);
        
        let window_label = format!("note-{}", note_id);
        
        if let Some(window) = self.app_handle.get_webview_window(&window_label) {
            window.show().map_err(|e| format!("Failed to show window: {}", e))?;
            window.set_focus().map_err(|e| format!("Failed to focus window: {}", e))?;
            
            // If window is minimized, restore it
            if window.is_minimized().unwrap_or(false) {
                window.unminimize().map_err(|e| format!("Failed to unminimize window: {}", e))?;
            }
            
            // Update last focused time
            let storage = self.storage.lock().await;
            if let Ok(Some(mut window_state)) = storage.load_window_state(note_id).await {
                window_state.last_focused = chrono::Utc::now().to_rfc3339();
                storage.save_window_state(note_id, &window_state).await?;
            }
            
            log_debug!("WINDOW_SERVICE", "Focused detached window: {}", window_label);
            return Ok(true);
        }
        
        log_debug!("WINDOW_SERVICE", "No detached window found for note: {}", note_id);
        Ok(false)
    }
    
    /// Get all active detached windows
    pub async fn get_detached_windows(&self) -> Result<Vec<DetachedWindow>, String> {
        let active_windows = self.active_windows.lock().await;
        Ok(active_windows.values().cloned().collect())
    }
    
    /// Restore a window from saved state
    async fn restore_window(&self, note_id: &str, window_state: &WindowState) -> Result<bool, String> {
        // Only restore if the window should be detached
        if !window_state.is_detached {
            return Ok(false);
        }
        
        // Create the detached window
        self.create_detached_window(
            note_id,
            window_state.custom_position.map(|p| p.0),
            window_state.custom_position.map(|p| p.1),
            Some(window_state.size.0),
            Some(window_state.size.1),
            window_state.grid_position,
        ).await?;
        
        Ok(true)
    }
    
    /// Update window position
    pub async fn update_window_position(&self, note_id: &str, x: f64, y: f64) -> Result<(), String> {
        // Update active windows
        let mut active_windows = self.active_windows.lock().await;
        if let Some(window) = active_windows.get_mut(note_id) {
            window.position = (x, y);
        }
        
        // Update persistent state
        let storage = self.storage.lock().await;
        if let Ok(Some(mut window_state)) = storage.load_window_state(note_id).await {
            window_state.custom_position = Some((x, y));
            storage.save_window_state(note_id, &window_state).await?;
        }
        
        Ok(())
    }
    
    /// Assign a window to a grid position
    pub async fn assign_grid_position(&self, note_id: &str, grid_position: u8) -> Result<(), String> {
        let storage = self.storage.lock().await;
        
        // Load current workspace state
        let mut workspace = storage.load_workspace_state().await?;
        
        // Remove any existing assignment for this grid position
        workspace.grid_assignments.retain(|_, id| id != note_id);
        
        // Add new assignment
        workspace.grid_assignments.insert(grid_position, note_id.to_string());
        
        // Update window state
        if let Some(window_state) = workspace.window_states.get_mut(note_id) {
            window_state.grid_position = Some(grid_position);
        }
        
        // Save workspace state
        storage.save_workspace_state(&workspace).await?;
        
        log_info!("WINDOW_SERVICE", "Assigned note {} to grid position {}", note_id, grid_position);
        
        Ok(())
    }
    
    /// Get note ID assigned to a grid position
    pub async fn get_grid_assignment(&self, grid_position: u8) -> Result<Option<String>, String> {
        let storage = self.storage.lock().await;
        let workspace = storage.load_workspace_state().await?;
        
        Ok(workspace.grid_assignments.get(&grid_position).cloned())
    }
}