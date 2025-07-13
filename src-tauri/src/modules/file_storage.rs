use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::io::Write;

use crate::types::{
    note::{Note, NoteFrontmatter},
    workspace::{WorkspaceState, WindowState, NotesIndex, NoteIndexEntry},
    config::AppConfig,
};
use crate::modules::storage::get_configured_notes_directory;
use crate::{log_debug, log_info, log_error};

/// File-based storage manager for notes and workspace state
pub struct FileStorageManager {
    notes_dir: PathBuf,
    blink_dir: PathBuf,
}

impl FileStorageManager {
    pub fn new(config: &AppConfig) -> Result<Self, String> {
        let notes_dir = get_configured_notes_directory(config)?;
        let blink_dir = notes_dir.join(".blink");
        
        // Create directories if they don't exist
        fs::create_dir_all(&notes_dir)
            .map_err(|e| format!("Failed to create notes directory: {}", e))?;
        fs::create_dir_all(&blink_dir)
            .map_err(|e| format!("Failed to create .blink directory: {}", e))?;
        
        log_info!("FILE_STORAGE", "Initialized file storage at: {:?}", notes_dir);
        
        Ok(Self {
            notes_dir,
            blink_dir,
        })
    }
    
    /// Load all notes from markdown files
    pub async fn load_notes(&self) -> Result<HashMap<String, Note>, String> {
        log_info!("FILE_STORAGE", "Loading notes from file system...");
        
        let mut notes = HashMap::new();
        
        // Read all .md files in the notes directory
        let entries = fs::read_dir(&self.notes_dir)
            .map_err(|e| format!("Failed to read notes directory: {}", e))?;
        
        for entry in entries {
            let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
            let path = entry.path();
            
            // Only process .md files
            if path.is_file() && path.extension().map_or(false, |ext| ext == "md") {
                match self.load_note_from_file(&path).await {
                    Ok(note) => {
                        log_debug!("FILE_STORAGE", "Loaded note: {} from {:?}", note.id, path);
                        notes.insert(note.id.clone(), note);
                    }
                    Err(e) => {
                        log_error!("FILE_STORAGE", "Failed to load note from {:?}: {}", path, e);
                    }
                }
            }
        }
        
        log_info!("FILE_STORAGE", "Loaded {} notes from file system", notes.len());
        
        // Update the index
        self.update_notes_index(&notes).await?;
        
        Ok(notes)
    }
    
    /// Load a single note from a markdown file
    async fn load_note_from_file(&self, path: &Path) -> Result<Note, String> {
        let content = fs::read_to_string(path)
            .map_err(|e| format!("Failed to read note file: {}", e))?;
        
        self.parse_markdown_note(&content, path)
    }
    
    /// Parse markdown content with frontmatter
    fn parse_markdown_note(&self, content: &str, path: &Path) -> Result<Note, String> {
        // Check if file has frontmatter
        if content.starts_with("---\n") {
            let parts: Vec<&str> = content.splitn(3, "---\n").collect();
            if parts.len() >= 3 {
                // Parse frontmatter
                let frontmatter: NoteFrontmatter = serde_yaml::from_str(parts[1])
                    .map_err(|e| format!("Failed to parse frontmatter: {}", e))?;
                
                return Ok(Note {
                    id: frontmatter.id,
                    title: frontmatter.title,
                    content: parts[2].to_string(),
                    created_at: frontmatter.created_at,
                    updated_at: frontmatter.updated_at,
                    tags: frontmatter.tags,
                    position: frontmatter.position,
                });
            }
        }
        
        // No frontmatter - generate from filename and content
        let filename = path.file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("untitled");
        
        let title = if content.lines().next().unwrap_or("").starts_with('#') {
            content.lines().next().unwrap_or("")
                .trim_start_matches('#')
                .trim()
                .to_string()
        } else {
            filename.to_string()
        };
        
        let now = chrono::Utc::now().to_rfc3339();
        let id = uuid::Uuid::new_v4().to_string();
        
        Ok(Note {
            id,
            title,
            content: content.to_string(),
            created_at: now.clone(),
            updated_at: now,
            tags: vec![],
            position: None,
        })
    }
    
    /// Save a note to a markdown file
    pub async fn save_note(&self, note: &Note) -> Result<(), String> {
        let filename = self.sanitize_filename(&note.title);
        let file_path = self.notes_dir.join(format!("{}.md", filename));
        
        let frontmatter = NoteFrontmatter {
            id: note.id.clone(),
            title: note.title.clone(),
            created_at: note.created_at.clone(),
            updated_at: note.updated_at.clone(),
            tags: note.tags.clone(),
            position: note.position,
        };
        
        let frontmatter_yaml = serde_yaml::to_string(&frontmatter)
            .map_err(|e| format!("Failed to serialize frontmatter: {}", e))?;
        
        let file_content = format!("---\n{}---\n{}", frontmatter_yaml, note.content);
        
        fs::write(&file_path, file_content)
            .map_err(|e| format!("Failed to write note file: {}", e))?;
        
        log_debug!("FILE_STORAGE", "Saved note {} to {:?}", note.id, file_path);
        
        Ok(())
    }
    
    /// Delete a note file
    pub async fn delete_note(&self, note_id: &str) -> Result<(), String> {
        // Find the note file by ID
        let index = self.load_notes_index().await?;
        
        if let Some(entry) = index.notes.get(note_id) {
            let file_path = self.notes_dir.join(&entry.file_path);
            
            if file_path.exists() {
                fs::remove_file(&file_path)
                    .map_err(|e| format!("Failed to delete note file: {}", e))?;
                
                log_info!("FILE_STORAGE", "Deleted note file: {:?}", file_path);
            }
        }
        
        Ok(())
    }
    
    /// Load workspace state
    pub async fn load_workspace_state(&self) -> Result<WorkspaceState, String> {
        let workspace_file = self.blink_dir.join("workspace.json");
        
        if !workspace_file.exists() {
            let mut default_state = WorkspaceState::default();
            default_state.notes_directory = self.notes_dir.to_string_lossy().to_string();
            return Ok(default_state);
        }
        
        let content = fs::read_to_string(&workspace_file)
            .map_err(|e| format!("Failed to read workspace file: {}", e))?;
        
        let state: WorkspaceState = serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse workspace file: {}", e))?;
        
        Ok(state)
    }
    
    /// Save workspace state
    pub async fn save_workspace_state(&self, state: &WorkspaceState) -> Result<(), String> {
        let workspace_file = self.blink_dir.join("workspace.json");
        
        let content = serde_json::to_string_pretty(state)
            .map_err(|e| format!("Failed to serialize workspace state: {}", e))?;
        
        fs::write(&workspace_file, content)
            .map_err(|e| format!("Failed to write workspace file: {}", e))?;
        
        log_debug!("FILE_STORAGE", "Saved workspace state to {:?}", workspace_file);
        
        Ok(())
    }
    
    /// Load window state for a specific note
    pub async fn load_window_state(&self, note_id: &str) -> Result<Option<WindowState>, String> {
        let workspace = self.load_workspace_state().await?;
        Ok(workspace.window_states.get(note_id).cloned())
    }
    
    /// Save window state for a specific note
    pub async fn save_window_state(&self, note_id: &str, window_state: &WindowState) -> Result<(), String> {
        let mut workspace = self.load_workspace_state().await?;
        workspace.window_states.insert(note_id.to_string(), window_state.clone());
        workspace.last_accessed = chrono::Utc::now().to_rfc3339();
        
        self.save_workspace_state(&workspace).await?;
        
        Ok(())
    }
    
    /// Update notes index for fast lookups
    pub async fn update_notes_index(&self, notes: &HashMap<String, Note>) -> Result<(), String> {
        let index_file = self.blink_dir.join("index.json");
        
        let mut index = NotesIndex::default();
        
        for (_, note) in notes {
            let filename = self.sanitize_filename(&note.title);
            let file_path = format!("{}.md", filename);
            
            index.notes.insert(note.id.clone(), NoteIndexEntry {
                id: note.id.clone(),
                title: note.title.clone(),
                file_path,
                created_at: note.created_at.clone(),
                updated_at: note.updated_at.clone(),
                tags: note.tags.clone(),
                position: note.position,
                file_hash: None, // TODO: Add file hash for change detection
            });
        }
        
        let content = serde_json::to_string_pretty(&index)
            .map_err(|e| format!("Failed to serialize notes index: {}", e))?;
        
        fs::write(&index_file, content)
            .map_err(|e| format!("Failed to write notes index: {}", e))?;
        
        Ok(())
    }
    
    /// Load notes index
    async fn load_notes_index(&self) -> Result<NotesIndex, String> {
        let index_file = self.blink_dir.join("index.json");
        
        if !index_file.exists() {
            return Ok(NotesIndex::default());
        }
        
        let content = fs::read_to_string(&index_file)
            .map_err(|e| format!("Failed to read notes index: {}", e))?;
        
        let index: NotesIndex = serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse notes index: {}", e))?;
        
        Ok(index)
    }
    
    /// Sanitize filename for safe file system usage
    fn sanitize_filename(&self, title: &str) -> String {
        title
            .chars()
            .map(|c| match c {
                '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '-',
                c if c.is_control() => '-',
                c => c,
            })
            .collect::<String>()
            .trim()
            .to_string()
    }
    
    /// Migrate from legacy notes.json to file-based system
    pub async fn migrate_from_json(&self, json_path: &Path) -> Result<(), String> {
        if !json_path.exists() {
            return Ok(());
        }
        
        log_info!("FILE_STORAGE", "Migrating notes from JSON file: {:?}", json_path);
        
        let content = fs::read_to_string(json_path)
            .map_err(|e| format!("Failed to read notes.json: {}", e))?;
        
        let notes: HashMap<String, Note> = serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse notes.json: {}", e))?;
        
        // Save each note as a markdown file
        for (_, note) in notes {
            self.save_note(&note).await?;
        }
        
        // Backup the original JSON file
        let backup_path = json_path.with_extension("json.backup");
        fs::copy(json_path, &backup_path)
            .map_err(|e| format!("Failed to backup notes.json: {}", e))?;
        
        log_info!("FILE_STORAGE", "Migration complete. Backed up original to {:?}", backup_path);
        
        Ok(())
    }
}