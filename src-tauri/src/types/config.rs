use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct AppConfig {
    pub opacity: f64,
    #[serde(rename = "alwaysOnTop")]
    pub always_on_top: bool,
    pub shortcuts: ShortcutConfig,
    pub window: WindowConfig,
    #[serde(default = "default_appearance")]
    pub appearance: AppearanceConfig,
    #[serde(default = "default_storage")]
    pub storage: StorageConfig,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct ShortcutConfig {
    #[serde(rename = "toggleVisibility")]
    pub toggle_visibility: String,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct WindowConfig {
    pub width: f64,
    pub height: f64,
    pub x: Option<f64>,
    pub y: Option<f64>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct StorageConfig {
    #[serde(rename = "notesDirectory")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub notes_directory: Option<String>,
    #[serde(rename = "useCustomDirectory")]
    pub use_custom_directory: bool,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct AppearanceConfig {
    #[serde(rename = "fontSize")]
    pub font_size: f64,
    #[serde(rename = "contentFontSize")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content_font_size: Option<f64>,
    pub theme: String,
    #[serde(rename = "editorFontFamily")]
    pub editor_font_family: String,
    #[serde(rename = "previewFontFamily")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub preview_font_family: Option<String>,
    #[serde(rename = "lineHeight")]
    pub line_height: f64,
    #[serde(rename = "accentColor")]
    pub accent_color: String,
    #[serde(rename = "backgroundPattern")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub background_pattern: Option<String>,
    #[serde(rename = "syntaxHighlighting")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub syntax_highlighting: Option<bool>,
    #[serde(rename = "focusMode")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub focus_mode: Option<bool>,
    #[serde(rename = "typewriterMode")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub typewriter_mode: Option<bool>,
    #[serde(rename = "themeId")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub theme_id: Option<String>,
    #[serde(rename = "showNotePreviews")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub show_note_previews: Option<bool>,
    #[serde(rename = "windowOpacity")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub window_opacity: Option<f64>,
    #[serde(rename = "notePaperStyle")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub note_paper_style: Option<String>,
    #[serde(rename = "vimMode")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub vim_mode: Option<bool>,
}

// Default constructors
pub fn default_storage() -> StorageConfig {
    StorageConfig {
        notes_directory: None,
        use_custom_directory: false,
    }
}

pub fn default_appearance() -> AppearanceConfig {
    AppearanceConfig {
        font_size: 15.0,
        content_font_size: Some(16.0),
        theme: "dark".to_string(),
        editor_font_family: "system-ui".to_string(),
        preview_font_family: Some("Inter, -apple-system, BlinkMacSystemFont, sans-serif".to_string()),
        line_height: 1.6,
        accent_color: "#3b82f6".to_string(),
        background_pattern: Some("none".to_string()),
        syntax_highlighting: Some(true),
        focus_mode: Some(false),
        typewriter_mode: Some(false),
        theme_id: Some("midnightInk".to_string()),
        show_note_previews: Some(true),
        window_opacity: None,
        note_paper_style: Some("none".to_string()),
        vim_mode: Some(false),
    }
}

impl Default for AppConfig {
    fn default() -> Self {
        AppConfig {
            opacity: 1.0,
            always_on_top: false,
            shortcuts: ShortcutConfig {
                toggle_visibility: "CommandOrControl+Shift+H".to_string(),
            },
            window: WindowConfig {
                width: 1000.0,
                height: 700.0,
                x: None,
                y: None,
            },
            appearance: default_appearance(),
            storage: default_storage(),
        }
    }
}