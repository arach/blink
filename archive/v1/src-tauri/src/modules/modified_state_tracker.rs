use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;
use sha2::{Sha256, Digest};

use crate::types::note::Note;
use crate::{log_debug, log_info, log_warn};

/// Tracks note modification state and content hashes for change detection
/// 
/// This serves two purposes:
/// 1. Track which notes have been modified in the current session
/// 2. Store content hashes to detect actual changes and external modifications
pub struct ModifiedStateTracker {
    /// Maps note IDs to their dirty state (modified in current session)
    dirty_flags: Arc<Mutex<HashMap<String, bool>>>,
    /// Maps note IDs to their last saved content hash (for drift detection)
    content_hashes: Arc<Mutex<HashMap<String, String>>>,
}

impl ModifiedStateTracker {
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
                    log_warn!("MODIFIED_STATE", "⚠️ Content change detected for note {}: old_hash={}, new_hash={}", 
                        note_id, &existing_hash[..8], &new_hash[..8]);
                    // TODO: In the future, we could check if this change was external
                    // by comparing timestamps or using file system events
                }
                changed
            },
            None => {
                log_debug!("MODIFIED_STATE", "Note {} has no previous hash, marking as changed", note_id);
                true // No previous hash means this is new or first save
            }
        }
    }
    
    /// Update the content hash after a successful save
    pub async fn update_content_hash(&self, note_id: &str, content: &str) {
        let mut hashes = self.content_hashes.lock().await;
        let new_hash = Self::compute_content_hash(content);
        let old_hash = hashes.get(note_id).cloned();
        
        hashes.insert(note_id.to_string(), new_hash.clone());
        
        match old_hash {
            Some(old) => {
                log_info!("MODIFIED_STATE", "📝 Updated hash for note {}: {} → {}", 
                    note_id, &old[..8], &new_hash[..8]);
            },
            None => {
                log_info!("MODIFIED_STATE", "📝 Set initial hash for note {}: {}", 
                    note_id, &new_hash[..8]);
            }
        }
    }
    
    /// Mark a note as modified (has unsaved changes)
    pub async fn mark_modified(&self, note_id: &str) {
        let mut flags = self.dirty_flags.lock().await;
        let was_modified = flags.insert(note_id.to_string(), true).unwrap_or(false);
        
        if !was_modified {
            log_info!("MODIFIED_STATE", "✏️ Marked note {} as modified", note_id);
        }
    }
    
    /// Clear the modified flag after a successful save
    pub async fn clear_modified(&self, note_id: &str) {
        let mut flags = self.dirty_flags.lock().await;
        if flags.remove(note_id).is_some() {
            log_info!("MODIFIED_STATE", "✅ Cleared modified flag for note {} (saved)", note_id);
        }
    }
    
    /// Check if a note is marked as modified
    pub async fn is_modified(&self, note_id: &str) -> bool {
        let flags = self.dirty_flags.lock().await;
        flags.get(note_id).copied().unwrap_or(false)
    }
    
    /// Initialize tracking for a note with its current content
    pub async fn initialize_note(&self, note: &Note) {
        let mut hashes = self.content_hashes.lock().await;
        let hash = Self::compute_content_hash(&note.content);
        hashes.insert(note.id.clone(), hash);
        
        // Clear any existing modified flag
        let mut flags = self.dirty_flags.lock().await;
        flags.remove(&note.id);
        
        log_debug!("MODIFIED_STATE", "Initialized tracking for note {}", note.id);
    }
    
    /// Remove tracking for a deleted note
    pub async fn remove_note(&self, note_id: &str) {
        let mut hashes = self.content_hashes.lock().await;
        hashes.remove(note_id);
        
        let mut flags = self.dirty_flags.lock().await;
        flags.remove(note_id);
        
        log_debug!("MODIFIED_STATE", "Removed tracking for note {}", note_id);
    }
    
    /// Get all modified note IDs
    pub async fn get_modified_notes(&self) -> Vec<String> {
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
        
        log_debug!("MODIFIED_STATE", "Cleared all tracking data");
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
        
        let hash1 = ModifiedStateTracker::compute_content_hash(content1);
        let hash2 = ModifiedStateTracker::compute_content_hash(content2);
        let hash3 = ModifiedStateTracker::compute_content_hash(content3);
        
        assert_eq!(hash1, hash2, "Same content should produce same hash");
        assert_ne!(hash1, hash3, "Different content should produce different hash");
    }
    
    #[tokio::test]
    async fn test_modified_tracking() {
        let tracker = ModifiedStateTracker::new();
        let note_id = "test-note-1";
        
        // Initially not modified
        assert!(!tracker.is_modified(note_id).await);
        
        // Mark as modified
        tracker.mark_modified(note_id).await;
        assert!(tracker.is_modified(note_id).await);
        
        // Clear modified flag
        tracker.clear_modified(note_id).await;
        assert!(!tracker.is_modified(note_id).await);
    }
    
    #[tokio::test]
    async fn test_content_change_detection() {
        let tracker = ModifiedStateTracker::new();
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