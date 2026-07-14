use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tokio::sync::Mutex;
use super::{config::AppConfig, note::Note};

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

// State type aliases for cleaner code
pub type NotesState = Mutex<HashMap<String, Note>>;
pub type ConfigState = Mutex<AppConfig>;
pub type DetachedWindowsState = Mutex<HashMap<String, DetachedWindow>>;
pub type ToggleState = Mutex<bool>;