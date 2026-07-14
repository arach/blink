use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::SystemTime;

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct WorkspaceState {
    pub name: String,
    pub created_at: String,
    pub last_accessed: String,
    pub notes_directory: String,
    pub window_states: HashMap<String, WindowState>,
    pub grid_assignments: HashMap<u8, String>, // grid position -> note_id
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct WindowState {
    pub note_id: String,
    pub grid_position: Option<u8>,           // 1-9 for shortcuts
    pub custom_position: Option<(f64, f64)>, // Or custom position
    pub size: (f64, f64),
    pub last_focused: String,
    pub is_detached: bool,
    pub always_on_top: bool,
    pub opacity: f64,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct NotesIndex {
    pub notes: HashMap<String, NoteIndexEntry>,
    pub last_updated: String,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct NoteIndexEntry {
    pub id: String,
    pub title: String,
    pub file_path: String,
    pub created_at: String,
    pub updated_at: String,
    pub tags: Vec<String>,
    pub position: Option<i32>, // For manual ordering
    pub file_hash: Option<String>, // For change detection
}

impl Default for WorkspaceState {
    fn default() -> Self {
        WorkspaceState {
            name: "Default".to_string(),
            created_at: chrono::Utc::now().to_rfc3339(),
            last_accessed: chrono::Utc::now().to_rfc3339(),
            notes_directory: String::new(),
            window_states: HashMap::new(),
            grid_assignments: HashMap::new(),
        }
    }
}

impl Default for WindowState {
    fn default() -> Self {
        WindowState {
            note_id: String::new(),
            grid_position: None,
            custom_position: None,
            size: (800.0, 600.0),
            last_focused: chrono::Utc::now().to_rfc3339(),
            is_detached: false,
            always_on_top: false,
            opacity: 1.0,
        }
    }
}

impl Default for NotesIndex {
    fn default() -> Self {
        NotesIndex {
            notes: HashMap::new(),
            last_updated: chrono::Utc::now().to_rfc3339(),
        }
    }
}