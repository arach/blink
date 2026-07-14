use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::Mutex;

use crate::types::{
    note::Note,
    config::AppConfig,
};
use crate::modules::file_storage::FileStorageManager;
use crate::{log_info, log_error};

/// File-based notes storage that maintains compatibility with existing interfaces
pub struct FileNotesStorage {
    storage: FileStorageManager,
    cache: Arc<Mutex<HashMap<String, Note>>>,
}

impl FileNotesStorage {
    pub fn new(config: &AppConfig) -> Result<Self, String> {
        let storage = FileStorageManager::new(config)?;
        Ok(Self {
            storage,
            cache: Arc::new(Mutex::new(HashMap::new())),
        })
    }
    
    /// Load all notes from disk and populate cache
    pub async fn load_notes(&self) -> Result<HashMap<String, Note>, String> {
        log_info!("FILE_NOTES_STORAGE", "Loading notes from markdown files...");
        let notes = self.storage.load_notes().await?;
        
        // Update cache
        let mut cache = self.cache.lock().await;
        *cache = notes.clone();
        
        log_info!("FILE_NOTES_STORAGE", "Loaded {} notes", notes.len());
        Ok(notes)
    }
    
    /// Save a single note to disk and update cache
    pub async fn save_note(&self, note: &Note) -> Result<(), String> {
        // Save to disk
        self.storage.save_note(note).await?;
        
        // Update cache
        let mut cache = self.cache.lock().await;
        cache.insert(note.id.clone(), note.clone());
        
        // Update the index
        self.storage.update_notes_index(&cache).await?;
        
        Ok(())
    }
    
    /// Delete a note from disk and cache
    pub async fn delete_note(&self, note_id: &str) -> Result<(), String> {
        // Delete from disk
        self.storage.delete_note(note_id).await?;
        
        // Remove from cache
        let mut cache = self.cache.lock().await;
        cache.remove(note_id);
        
        // Update the index
        self.storage.update_notes_index(&cache).await?;
        
        Ok(())
    }
    
    /// Get all notes from cache
    pub async fn get_all_notes(&self) -> HashMap<String, Note> {
        let cache = self.cache.lock().await;
        cache.clone()
    }
    
    /// Save all notes from cache to disk (used for bulk operations)
    pub async fn save_all_notes(&self, notes: &HashMap<String, Note>) -> Result<(), String> {
        log_info!("FILE_NOTES_STORAGE", "Saving all {} notes to disk", notes.len());
        
        // Update cache first
        let mut cache = self.cache.lock().await;
        *cache = notes.clone();
        
        // Save each note to disk
        for (_, note) in notes.iter() {
            self.storage.save_note(note).await?;
        }
        
        // Update the index
        self.storage.update_notes_index(notes).await?;
        
        Ok(())
    }
    
    /// Run migration from old JSON format if needed
    pub async fn migrate_if_needed(&self, json_path: PathBuf) -> Result<(), String> {
        if json_path.exists() && !json_path.with_extension("json.backup").exists() {
            log_info!("FILE_NOTES_STORAGE", "Detected old notes.json, running migration...");
            self.storage.migrate_from_json(&json_path).await?;
            
            // Remove the original JSON file after successful migration
            std::fs::remove_file(&json_path)
                .map_err(|e| format!("Failed to remove old notes.json: {}", e))?;
        }
        Ok(())
    }
}

