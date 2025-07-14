use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;
use sha2::{Sha256, Digest};

use crate::types::note::Note;
use crate::log_debug;

/// Tracks which notes have unsaved changes and their content hashes
pub struct DirtyTracker {
    /// Maps note IDs to their dirty state
    dirty_flags: Arc<Mutex<HashMap<String, bool>>>,
    /// Maps note IDs to their last saved content hash
    content_hashes: Arc<Mutex<HashMap<String, String>>>,
}

impl DirtyTracker {
    pub fn new() -> Self {
        Self {
            dirty_flags: Arc::new(Mutex::new(HashMap::new())),
            content_hashes: Arc::new(Mutex::new(HashMap::new())),
        }
    }
    
    /// Compute SHA-256 hash of content
    pub fn compute_content_hash(content: &str) -> String {
        let mut hasher = Sha256::new();
        hasher.update(content.as_bytes());
        format!("{:x}", hasher.finalize())
    }
    
    /// Check if a note's content has changed by comparing hashes
    pub async fn has_content_changed(&self, note_id: &str, new_content: &str) -> bool {
        let hashes = self.content_hashes.lock().await;
        let new_hash = Self::compute_content_hash(new_content);
        
        match hashes.get(note_id) {
            Some(existing_hash) => {
                let changed = existing_hash != &new_hash;
                if changed {
                    log_debug!("DIRTY_TRACKER", "Note {} content changed. Old hash: {}, New hash: {}", 
                        note_id, &existing_hash[..8], &new_hash[..8]);
                }
                changed
            },
            None => {
                log_debug!("DIRTY_TRACKER", "Note {} has no previous hash, marking as changed", note_id);
                true // No previous hash means this is new or first save
            }
        }
    }
    
    /// Update the content hash after a successful save
    pub async fn update_content_hash(&self, note_id: &str, content: &str) {
        let mut hashes = self.content_hashes.lock().await;
        let hash = Self::compute_content_hash(content);
        hashes.insert(note_id.to_string(), hash);
        log_debug!("DIRTY_TRACKER", "Updated content hash for note {}", note_id);
    }
    
    /// Mark a note as dirty (has unsaved changes)
    pub async fn mark_dirty(&self, note_id: &str) {
        let mut flags = self.dirty_flags.lock().await;
        flags.insert(note_id.to_string(), true);
        log_debug!("DIRTY_TRACKER", "Marked note {} as dirty", note_id);
    }
    
    /// Clear the dirty flag after a successful save
    pub async fn clear_dirty(&self, note_id: &str) {
        let mut flags = self.dirty_flags.lock().await;
        flags.remove(note_id);
        log_debug!("DIRTY_TRACKER", "Cleared dirty flag for note {}", note_id);
    }
    
    /// Check if a note is marked as dirty
    pub async fn is_dirty(&self, note_id: &str) -> bool {
        let flags = self.dirty_flags.lock().await;
        flags.get(note_id).copied().unwrap_or(false)
    }
    
    /// Initialize tracking for a note with its current content
    pub async fn initialize_note(&self, note: &Note) {
        let mut hashes = self.content_hashes.lock().await;
        let hash = Self::compute_content_hash(&note.content);
        hashes.insert(note.id.clone(), hash);
        
        // Clear any existing dirty flag
        let mut flags = self.dirty_flags.lock().await;
        flags.remove(&note.id);
        
        log_debug!("DIRTY_TRACKER", "Initialized tracking for note {}", note.id);
    }
    
    /// Remove tracking for a deleted note
    pub async fn remove_note(&self, note_id: &str) {
        let mut hashes = self.content_hashes.lock().await;
        hashes.remove(note_id);
        
        let mut flags = self.dirty_flags.lock().await;
        flags.remove(note_id);
        
        log_debug!("DIRTY_TRACKER", "Removed tracking for note {}", note_id);
    }
    
    /// Get all dirty note IDs
    pub async fn get_dirty_notes(&self) -> Vec<String> {
        let flags = self.dirty_flags.lock().await;
        flags.iter()
            .filter_map(|(id, &is_dirty)| if is_dirty { Some(id.clone()) } else { None })
            .collect()
    }
    
    /// Clear all tracking data (useful for testing or reset)
    pub async fn clear_all(&self) {
        let mut flags = self.dirty_flags.lock().await;
        flags.clear();
        
        let mut hashes = self.content_hashes.lock().await;
        hashes.clear();
        
        log_debug!("DIRTY_TRACKER", "Cleared all tracking data");
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_content_hash() {
        let content1 = "Hello, world!";
        let content2 = "Hello, world!";
        let content3 = "Hello, world!!";
        
        let hash1 = DirtyTracker::compute_content_hash(content1);
        let hash2 = DirtyTracker::compute_content_hash(content2);
        let hash3 = DirtyTracker::compute_content_hash(content3);
        
        assert_eq!(hash1, hash2, "Same content should produce same hash");
        assert_ne!(hash1, hash3, "Different content should produce different hash");
    }
    
    #[tokio::test]
    async fn test_dirty_tracking() {
        let tracker = DirtyTracker::new();
        let note_id = "test-note-1";
        
        // Initially not dirty
        assert!(!tracker.is_dirty(note_id).await);
        
        // Mark as dirty
        tracker.mark_dirty(note_id).await;
        assert!(tracker.is_dirty(note_id).await);
        
        // Clear dirty flag
        tracker.clear_dirty(note_id).await;
        assert!(!tracker.is_dirty(note_id).await);
    }
    
    #[tokio::test]
    async fn test_content_change_detection() {
        let tracker = DirtyTracker::new();
        let note_id = "test-note-1";
        let content1 = "Initial content";
        let content2 = "Modified content";
        
        // First check should return true (no previous hash)
        assert!(tracker.has_content_changed(note_id, content1).await);
        
        // Update hash
        tracker.update_content_hash(note_id, content1).await;
        
        // Same content should not be changed
        assert!(!tracker.has_content_changed(note_id, content1).await);
        
        // Different content should be changed
        assert!(tracker.has_content_changed(note_id, content2).await);
    }
}