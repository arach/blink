# Dirty Tracking System Design

**Branch Name:** `feature/dirty-tracking`  
**Date:** 2025-07-14  
**Status:** Implemented ✅

## Overview

This document outlines the implementation of a dirty tracking system for Blink to ensure we only save notes that have actually changed. This builds upon the recent optimization where we switched from bulk saves to individual note saves.

## Design Principles

1. **Hybrid Approach**: Combine internal dirty flags with file hashing for comprehensive change detection
2. **Performance**: Minimal overhead during normal editing operations
3. **Reliability**: Detect both internal edits and external file changes
4. **Simplicity**: Clear, maintainable implementation

## Implementation Strategy

### 1. Internal Change Tracking (Dirty Flags)

**Purpose**: Track changes made within the application
**Implementation**: HashMap of note IDs to dirty states

```rust
// In NotesState
pub struct NotesState {
    notes: Arc<Mutex<HashMap<String, Note>>>,
    dirty_flags: Arc<Mutex<HashMap<String, bool>>>,
    content_hashes: Arc<Mutex<HashMap<String, String>>>,
}
```

**Benefits**:
- Zero-cost during editing (just set a flag)
- Immediate change detection
- No computational overhead

### 2. External Change Detection (Content Hashing)

**Purpose**: Detect when files are modified outside the application
**Implementation**: SHA-256 hashes stored in the notes index

```rust
pub struct NoteIndexEntry {
    // ... existing fields ...
    file_hash: Option<String>, // SHA-256 hash of file content
    content_hash: Option<String>, // SHA-256 hash of note content only
}
```

**Benefits**:
- Detects external editors/sync conflicts
- Provides data integrity verification
- Enables smart sync in future

## Implementation Plan

### Phase 1: Backend Infrastructure

1. Add dirty tracking to `NotesState`:
   ```rust
   // Track which notes have unsaved changes
   dirty_flags: Arc<Mutex<HashMap<String, bool>>>
   
   // Track content hashes for comparison
   content_hashes: Arc<Mutex<HashMap<String, String>>>
   ```

2. Update `update_note` command:
   - Compare new content with stored hash
   - Only save if content actually changed
   - Update hash after successful save

3. Add hash computation to `FileStorageManager`:
   - Compute SHA-256 hash when saving notes
   - Store in notes index for external change detection

### Phase 2: Frontend Integration

1. Add dirty state to note stores:
   ```typescript
   interface NoteState {
     isDirty: boolean;
     lastSavedContent?: string;
   }
   ```

2. Update save logic:
   - Track content changes in editor
   - Only invoke save command if content differs
   - Show accurate save status

### Phase 3: External Change Detection

1. File watcher integration:
   - Monitor notes directory for external changes
   - Compare file hashes on change events
   - Prompt user for conflict resolution

2. Startup validation:
   - Check file hashes against index
   - Detect notes modified while app was closed
   - Reload changed notes automatically

## Technical Details

### Hash Computation

```rust
use sha2::{Sha256, Digest};

fn compute_content_hash(content: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(content.as_bytes());
    format!("{:x}", hasher.finalize())
}
```

### Dirty Flag Management

```rust
impl NotesState {
    pub fn mark_dirty(&self, note_id: &str) {
        let mut flags = self.dirty_flags.lock().await;
        flags.insert(note_id.to_string(), true);
    }
    
    pub fn clear_dirty(&self, note_id: &str) {
        let mut flags = self.dirty_flags.lock().await;
        flags.remove(note_id);
    }
    
    pub fn is_dirty(&self, note_id: &str) -> bool {
        let flags = self.dirty_flags.lock().await;
        flags.get(note_id).copied().unwrap_or(false)
    }
}
```

## Benefits

1. **Performance**: Only save when necessary
2. **Reliability**: Detect all types of changes
3. **User Experience**: Accurate save indicators
4. **Future-Proof**: Enables advanced sync features

## Testing Strategy

1. Unit tests for hash computation
2. Integration tests for dirty flag lifecycle
3. E2E tests for save optimization
4. Manual testing of external change detection

## Migration Notes

- Existing notes will get hashes on first save
- No breaking changes to current functionality
- Gradual rollout possible with feature flags