use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::io::Write;
use sha2::{Sha256, Digest};

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
                        // Since ID comes from filename, duplicates shouldn't occur
                        // The filesystem ensures unique filenames
                        if notes.contains_key(&note.id) {
                            log_error!("FILE_STORAGE", "🚨 Unexpected duplicate ID: {} in file {:?}. Skipping file.", 
                                note.id, path);
                            continue;
                        }
                        
                        log_debug!("FILE_STORAGE", "Loaded note: {} from {:?}", note.id, path);
                        notes.insert(note.id.clone(), note);
                    }
                    Err(e) => {
                        log_error!("FILE_STORAGE", "Failed to load note from {:?}: {}", path, e);
                    }
                }
            }
        }
        
        // Fix position conflicts
        let mut position_fixes = Vec::new();
        let mut position_counts = std::collections::HashMap::new();
        let mut next_available_position = 0;
        
        // First pass: count how many notes have each position and find the maximum
        for note in notes.values() {
            if let Some(position) = note.position {
                if position >= 0 {
                    *position_counts.entry(position).or_insert(0) += 1;
                    next_available_position = next_available_position.max(position + 1);
                }
            }
        }
        
        // Second pass: fix conflicts and assign positions
        let mut used_positions = std::collections::HashSet::new();
        
        for (note_id, note) in notes.iter_mut() {
            let needs_fix = match note.position {
                Some(position) if position < 0 => {
                    log_error!("FILE_STORAGE", "🚨 INVALID POSITION: Note {} has negative position {}", note_id, position);
                    true
                }
                Some(position) if position_counts.get(&position).unwrap_or(&0) > &1 => {
                    log_error!("FILE_STORAGE", "🚨 POSITION CONFLICT: Note {} has position {} shared with {} other notes", 
                        note_id, position, position_counts.get(&position).unwrap() - 1);
                    true
                }
                Some(position) if used_positions.contains(&position) => {
                    log_error!("FILE_STORAGE", "🚨 POSITION CONFLICT: Note {} has position {} that's already been processed", note_id, position);
                    true
                }
                None => {
                    // None is a valid state - notes without positions are OK
                    log_debug!("FILE_STORAGE", "Note {} has no position (this is OK)", note_id);
                    false
                }
                _ => false
            };
            
            if needs_fix {
                // Find the next available position
                while used_positions.contains(&next_available_position) {
                    next_available_position += 1;
                }
                
                let old_position = note.position;
                note.position = Some(next_available_position);
                note.updated_at = chrono::Utc::now().to_rfc3339();
                used_positions.insert(next_available_position);
                
                log_info!("FILE_STORAGE", "🔧 Fixed position for note {}: {:?} -> {}", note_id, old_position, next_available_position);
                position_fixes.push(note.clone());
                
                next_available_position += 1;
            } else {
                // Mark this valid position as used
                if let Some(position) = note.position {
                    used_positions.insert(position);
                }
            }
        }
        
        // Save notes with fixed positions back to disk
        for note in position_fixes {
            self.save_note(&note).await?;
            log_info!("FILE_STORAGE", "✅ Saved position fix for note: {}", note.id);
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
    
    /// Parse pure markdown content
    fn parse_markdown_note(&self, content: &str, path: &Path) -> Result<Note, String> {
        // For migration: check if this is an old file with frontmatter
        let (actual_content, frontmatter_data) = if content.starts_with("---\n") {
            // Has frontmatter - extract metadata and content separately
            let parts: Vec<&str> = content.splitn(3, "---\n").collect();
            if parts.len() >= 3 {
                // Parse the YAML frontmatter to get the actual title and metadata
                let frontmatter: Option<NoteFrontmatter> = serde_yaml::from_str(parts[1]).ok();
                (parts[2].to_string(), frontmatter)
            } else {
                (content.to_string(), None)
            }
        } else {
            (content.to_string(), None)
        };
        
        // Use frontmatter data if available, otherwise generate from filename
        let id = if let Some(ref fm) = frontmatter_data {
            // For migration: use the slug from title, not the UUID
            self.sanitize_filename(&fm.title)
        } else {
            // New format: ID is the filename without extension
            path.file_stem()
                .and_then(|s| s.to_str())
                .ok_or("Invalid filename")?  
                .to_string()
        };
        
        // Get title from frontmatter or extract from content
        let title = if let Some(ref fm) = frontmatter_data {
            fm.title.clone()
        } else {
            // Extract from first heading or first line
            if let Some(first_line) = actual_content.lines().next() {
                if first_line.starts_with('#') {
                    first_line.trim_start_matches('#').trim().to_string()
                } else if !first_line.trim().is_empty() {
                    first_line.trim().to_string()
                } else {
                    // Find first non-empty line
                    actual_content.lines()
                        .find(|line| !line.trim().is_empty())
                        .map(|line| line.trim().to_string())
                        .unwrap_or_else(|| id.replace('-', " ").to_string())
                }
            } else {
                id.replace('-', " ").to_string()
            }
        };
        
        // Get timestamps and metadata
        let (created_at, updated_at, tags, position) = if let Some(fm) = frontmatter_data {
            // Use frontmatter data for migration
            (fm.created_at, fm.updated_at, fm.tags, fm.position)
        } else {
            // For new files without frontmatter, use file metadata
            let metadata = fs::metadata(path).ok();
            let modified = metadata
                .and_then(|m| m.modified().ok())
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| chrono::DateTime::from_timestamp(d.as_secs() as i64, 0))
                .flatten()
                .unwrap_or_else(chrono::Utc::now)
                .to_rfc3339();
            (modified.clone(), modified, vec![], None)
        };
        
        Ok(Note {
            id,
            title,
            content: actual_content,
            created_at,
            updated_at,
            tags,
            position,
        })
    }
    
    /// Save a note to a markdown file
    pub async fn save_note(&self, note: &Note) -> Result<(), String> {
        // Use slug ID as filename
        let file_path = self.notes_dir.join(format!("{}.md", note.id));
        
        // Write pure markdown content - no frontmatter
        let file_content = &note.content;
        
        // Compute hash of the content we're about to write
        let content_hash = Self::compute_file_hash(&note.content);
        
        fs::write(&file_path, file_content)
            .map_err(|e| format!("Failed to write note file: {}", e))?;
        
        log_info!("FILE_STORAGE", "💾 Wrote note {} to disk: {:?} ({} bytes, content_hash={})", 
            note.id, file_path, note.content.len(), &content_hash[..8]);
        
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
    
    /// Compute SHA-256 hash of content
    pub fn compute_file_hash(content: &str) -> String {
        let mut hasher = Sha256::new();
        hasher.update(content.as_bytes());
        format!("{:x}", hasher.finalize())
    }
    
    /// Update notes index in database
    pub async fn update_notes_index(&self, notes: &HashMap<String, Note>) -> Result<(), String> {
        use crate::modules::database;
        
        // Initialize database
        let db = database::initialize_database(&self.notes_dir)
            .map_err(|e| format!("Failed to initialize database: {}", e))?;
        
        // Update each note in the database
        for (_, note) in notes {
            let filename = self.sanitize_filename(&note.title);
            let file_path = format!("{}.md", filename);
            
            // Compute hash of the full file content
            let frontmatter = NoteFrontmatter {
                id: note.id.clone(),
                title: note.title.clone(),
                created_at: note.created_at.clone(),
                updated_at: note.updated_at.clone(),
                tags: note.tags.clone(),
                position: note.position,
            };
            
            let frontmatter_yaml = serde_yaml::to_string(&frontmatter)
                .unwrap_or_default();
            let file_content = format!("---\n{}---\n{}", frontmatter_yaml, note.content);
            let file_hash = Self::compute_file_hash(&file_content);
            
            // Create database record
            let note_record = database::NoteRecord {
                id: note.id.clone(),
                title: note.title.clone(),
                file_path,
                created_at: chrono::DateTime::parse_from_rfc3339(&note.created_at)
                    .unwrap_or_else(|_| chrono::Utc::now().into())
                    .with_timezone(&chrono::Utc),
                updated_at: chrono::DateTime::parse_from_rfc3339(&note.updated_at)
                    .unwrap_or_else(|_| chrono::Utc::now().into())
                    .with_timezone(&chrono::Utc),
                tags: note.tags.clone(),
                position: note.position, // Keep Option<i32> as is
                file_hash,
            };
            
            // Upsert to database
            db.upsert_note(&note_record)
                .map_err(|e| format!("Failed to update database: {}", e))?;
        }
        
        Ok(())
    }
    
    /// Load notes index from database
    async fn load_notes_index(&self) -> Result<NotesIndex, String> {
        use crate::modules::database;
        
        // Initialize database
        let db = database::initialize_database(&self.notes_dir)
            .map_err(|e| format!("Failed to initialize database: {}", e))?;
        
        // Get all notes from database
        let note_records = db.get_all_notes()
            .map_err(|e| format!("Failed to load notes from database: {}", e))?;
        
        // Convert to index format
        let mut index = NotesIndex::default();
        for record in note_records {
            index.notes.insert(record.id.clone(), NoteIndexEntry {
                id: record.id.clone(),
                title: record.title.clone(),
                file_path: record.file_path.clone(),
                created_at: record.created_at.to_rfc3339(),
                updated_at: record.updated_at.to_rfc3339(),
                tags: record.tags.clone(),
                position: record.position, // Already Option<i32>
                file_hash: Some(record.file_hash.clone()),
            });
        }
        
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