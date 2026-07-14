use thiserror::Error;

#[derive(Debug, Error)]
pub enum BlinkError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
    
    #[error("YAML error: {0}")]
    Yaml(#[from] serde_yaml::Error),
    
    #[error("Database error: {0}")]
    Database(String),
    
    #[error("Window error: {0}")]
    Window(String),
    
    #[error("Note not found: {id}")]
    NoteNotFound { id: String },
    
    #[error("Configuration error: {0}")]
    Config(String),
    
    #[error("Storage error: {0}")]
    Storage(String),
    
    #[error("Invalid operation: {0}")]
    InvalidOperation(String),
    
    #[error("Menu error: {0}")]
    Menu(String),
    
    #[error("Global shortcut error: {0}")]
    GlobalShortcut(String),
    
    #[error("Tauri error: {0}")]
    Tauri(#[from] tauri::Error),
}

// Implement conversion from BlinkError to String for Tauri commands
impl From<BlinkError> for String {
    fn from(err: BlinkError) -> Self {
        err.to_string()
    }
}

pub type Result<T> = std::result::Result<T, BlinkError>;
pub type BlinkResult<T> = Result<T>;