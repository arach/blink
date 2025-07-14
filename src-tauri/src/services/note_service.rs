use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;

use crate::modules::file_storage::FileStorageManager;
use crate::types::{
    note::{Note, CreateNoteRequest, UpdateNoteRequest},
    config::AppConfig,
};
use crate::{log_info, log_error};

/// Service for managing notes with file-based storage
pub struct NoteService {
    storage: Arc<Mutex<FileStorageManager>>,
    notes_cache: Arc<Mutex<HashMap<String, Note>>>,
}

impl NoteService {
    pub fn new(config: &AppConfig) -> Result<Self, String> {
        let storage = FileStorageManager::new(config)?;
        
        Ok(Self {
            storage: Arc::new(Mutex::new(storage)),
            notes_cache: Arc::new(Mutex::new(HashMap::new())),
        })
    }
    
    /// Initialize the service and load notes from disk
    pub async fn initialize(&self) -> Result<(), String> {
        log_info!("NOTE_SERVICE", "Initializing note service...");
        
        // Check for migration from legacy notes.json
        let storage = self.storage.lock().await;
        
        // Try to find and migrate legacy notes.json
        if let Ok(legacy_path) = crate::modules::storage::get_default_notes_directory() {
            let json_path = legacy_path.join("notes.json");
            if json_path.exists() {
                log_info!("NOTE_SERVICE", "Found legacy notes.json, migrating...");
                storage.migrate_from_json(&json_path).await?;
            }
        }
        
        // Load all notes from file system
        let notes = storage.load_notes().await?;
        
        // Update cache
        let mut cache = self.notes_cache.lock().await;
        *cache = notes;
        
        log_info!("NOTE_SERVICE", "Note service initialized with {} notes", cache.len());
        
        Ok(())
    }
    
    /// Get all notes
    pub async fn get_all_notes(&self) -> Result<HashMap<String, Note>, String> {
        let cache = self.notes_cache.lock().await;
        Ok(cache.clone())
    }
    
    /// Get a specific note by ID
    pub async fn get_note(&self, note_id: &str) -> Result<Option<Note>, String> {
        let cache = self.notes_cache.lock().await;
        Ok(cache.get(note_id).cloned())
    }
    
    /// Create a new note
    pub async fn create_note(&self, request: CreateNoteRequest) -> Result<Note, String> {
        let note = Note {
            id: uuid::Uuid::new_v4().to_string(),
            title: request.title,
            content: request.content,
            created_at: chrono::Utc::now().to_rfc3339(),
            updated_at: chrono::Utc::now().to_rfc3339(),
            tags: request.tags,
            position: None,
        };
        
        // Save to file system
        let storage = self.storage.lock().await;
        storage.save_note(&note).await?;
        
        // Update cache
        let mut cache = self.notes_cache.lock().await;
        cache.insert(note.id.clone(), note.clone());
        
        log_info!("NOTE_SERVICE", "Created new note: {}", note.id);
        
        Ok(note)
    }
    
    /// Update an existing note
    pub async fn update_note(&self, note_id: &str, request: UpdateNoteRequest) -> Result<Note, String> {
        let mut cache = self.notes_cache.lock().await;
        
        let mut note = cache.get(note_id)
            .ok_or_else(|| format!("Note not found: {}", note_id))?
            .clone();
        
        // Update fields
        if let Some(title) = request.title {
            note.title = title;
        }
        if let Some(content) = request.content {
            note.content = content;
        }
        if let Some(tags) = request.tags {
            note.tags = tags;
        }
        note.updated_at = chrono::Utc::now().to_rfc3339();
        
        // Save to file system
        let storage = self.storage.lock().await;
        storage.save_note(&note).await?;
        
        // Update cache
        cache.insert(note.id.clone(), note.clone());
        
        log_info!("NOTE_SERVICE", "Updated note: {}", note.id);
        
        Ok(note)
    }
    
    /// Delete a note
    pub async fn delete_note(&self, note_id: &str) -> Result<(), String> {
        let storage = self.storage.lock().await;
        storage.delete_note(note_id).await?;
        
        // Update cache
        let mut cache = self.notes_cache.lock().await;
        cache.remove(note_id);
        
        log_info!("NOTE_SERVICE", "Deleted note: {}", note_id);
        
        Ok(())
    }
    
    /// Reload notes from file system (for external changes)
    pub async fn reload_notes(&self) -> Result<(), String> {
        log_info!("NOTE_SERVICE", "Reloading notes from file system...");
        
        let storage = self.storage.lock().await;
        let notes = storage.load_notes().await?;
        
        // Update cache
        let mut cache = self.notes_cache.lock().await;
        *cache = notes;
        
        log_info!("NOTE_SERVICE", "Reloaded {} notes", cache.len());
        
        Ok(())
    }
    
    /// Get notes statistics
    pub async fn get_stats(&self) -> Result<NoteStats, String> {
        let cache = self.notes_cache.lock().await;
        
        let total_notes = cache.len();
        let total_words = cache.values()
            .map(|note| note.content.split_whitespace().count())
            .sum();
        
        let all_tags: Vec<String> = cache.values()
            .flat_map(|note| note.tags.iter().cloned())
            .collect();
        
        let unique_tags = all_tags.iter().collect::<std::collections::HashSet<_>>().len();
        
        Ok(NoteStats {
            total_notes,
            total_words,
            unique_tags,
        })
    }
}

#[derive(Debug)]
pub struct NoteStats {
    pub total_notes: usize,
    pub total_words: usize,
    pub unique_tags: usize,
}