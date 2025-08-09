use crate::modules::modified_state_tracker::ModifiedStateTracker;
use crate::types::config::AppConfig;
use crate::types::note::Note;
use crate::types::window::DetachedWindow;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Consolidated application state using RwLock for better concurrent access
pub struct AppState {
    pub notes: Arc<RwLock<HashMap<String, Note>>>,
    pub config: Arc<RwLock<AppConfig>>,
    pub detached_windows: Arc<RwLock<HashMap<String, DetachedWindow>>>,
    pub hover_toggle: Arc<RwLock<bool>>,
    pub modified_tracker: Arc<ModifiedStateTracker>,
}

impl AppState {
    /// Create a new AppState with default values
    pub fn new() -> Self {
        Self {
            notes: Arc::new(RwLock::new(HashMap::new())),
            config: Arc::new(RwLock::new(AppConfig::default())),
            detached_windows: Arc::new(RwLock::new(HashMap::new())),
            hover_toggle: Arc::new(RwLock::new(false)),
            modified_tracker: Arc::new(ModifiedStateTracker::new()),
        }
    }

    /// Create AppState with initial values
    pub fn with_values(
        notes: HashMap<String, Note>,
        config: AppConfig,
        detached_windows: HashMap<String, DetachedWindow>,
    ) -> Self {
        Self {
            notes: Arc::new(RwLock::new(notes)),
            config: Arc::new(RwLock::new(config)),
            detached_windows: Arc::new(RwLock::new(detached_windows)),
            hover_toggle: Arc::new(RwLock::new(false)),
            modified_tracker: Arc::new(ModifiedStateTracker::new()),
        }
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}

// Helper type aliases for backward compatibility
pub type NotesState = tokio::sync::Mutex<HashMap<String, Note>>;
pub type ConfigState = tokio::sync::Mutex<AppConfig>;
pub type DetachedWindowsState = tokio::sync::Mutex<HashMap<String, DetachedWindow>>;
pub type ToggleState = tokio::sync::Mutex<bool>;
pub type ModifiedStateTrackerState = ModifiedStateTracker;