use tauri::State;
use uuid::Uuid;

use crate::types::{
    note::{Note, CreateNoteRequest, UpdateNoteRequest},
    window::{NotesState, ConfigState},
};
use crate::modules::file_notes_storage::FileNotesStorage;
use crate::modules::modified_state_tracker::ModifiedStateTracker;
use crate::{log_info, log_error, log_debug};

/// Helper function to save all notes using FileNotesStorage
async fn save_all_notes_using_file_storage(
    notes: &std::collections::HashMap<String, Note>,
    config: &crate::types::config::AppConfig,
) -> Result<(), String> {
    let file_storage = FileNotesStorage::new(config)?;
    file_storage.save_all_notes(notes).await
}

/// Helper function to save a single note using FileNotesStorage
async fn save_note_using_file_storage(
    note: &Note,
    config: &crate::types::config::AppConfig,
) -> Result<(), String> {
    let file_storage = FileNotesStorage::new(config)?;
    file_storage.save_note(note).await
}

/// Get all notes, sorted by position (manual ordering)
#[tauri::command]
pub async fn get_notes(notes: State<'_, NotesState>) -> Result<Vec<Note>, String> {
    let notes_lock = notes.lock().await;
    let mut notes_vec: Vec<Note> = notes_lock.values().cloned().collect();
    
    // Sort by position (ascending), with None values at the end
    notes_vec.sort_by(|a, b| {
        match (a.position, b.position) {
            (Some(pos_a), Some(pos_b)) => pos_a.cmp(&pos_b),
            (Some(_), None) => std::cmp::Ordering::Less,
            (None, Some(_)) => std::cmp::Ordering::Greater,
            (None, None) => b.created_at.cmp(&a.created_at), // Fallback to newest first
        }
    });
    
    Ok(notes_vec)
}

/// Get a specific note by ID
#[tauri::command]
pub async fn get_note(id: String, notes: State<'_, NotesState>) -> Result<Option<Note>, String> {
    let notes_lock = notes.lock().await;
    Ok(notes_lock.get(&id).cloned())
}

/// Create a new note
#[tauri::command]
pub async fn create_note(
    request: CreateNoteRequest,
    notes: State<'_, NotesState>,
    config: State<'_, ConfigState>,
    modified_tracker: State<'_, ModifiedStateTracker>,
) -> Result<Note, String> {
    let mut notes_lock = notes.lock().await;
    let config_lock = config.lock().await;
    
    // Find the highest position to place new note at the end
    let max_position = notes_lock.values()
        .filter_map(|n| n.position)
        .max()
        .unwrap_or(-1);
    
    let now = chrono::Utc::now().to_rfc3339();
    let note = Note {
        id: Uuid::new_v4().to_string(),
        title: request.title,
        content: request.content,
        created_at: now.clone(),
        updated_at: now,
        tags: request.tags,
        position: Some(max_position + 1),
    };
    
    notes_lock.insert(note.id.clone(), note.clone());
    
    // Save only the new note
    save_note_using_file_storage(&note, &config_lock).await?;
    
    // Initialize tracking for the new note
    modified_tracker.initialize_note(&note).await;
    
    log_info!("NOTES", "Created note: {} ({})", note.title, note.id);
    Ok(note)
}

/// Update an existing note
#[tauri::command]
pub async fn update_note(
    id: String,
    request: UpdateNoteRequest,
    notes: State<'_, NotesState>,
    config: State<'_, ConfigState>,
    modified_tracker: State<'_, ModifiedStateTracker>,
) -> Result<Option<Note>, String> {
    let mut notes_lock = notes.lock().await;
    let config_lock = config.lock().await;
    
    if let Some(note) = notes_lock.get_mut(&id) {
        // Check if content has actually changed
        let content_changed = if let Some(ref new_content) = request.content {
            modified_tracker.has_content_changed(&id, new_content).await
        } else {
            false
        };
        
        // Check if other fields changed
        let title_changed = request.title.as_ref().map_or(false, |t| t != &note.title);
        let tags_changed = request.tags.as_ref().map_or(false, |t| t != &note.tags);
        
        // Only update if something actually changed
        if content_changed || title_changed || tags_changed {
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
            
            let updated_note = note.clone();
            
            // Save only if content changed (title/tags changes are lightweight)
            if content_changed {
                log_info!("NOTES", "📝 Content changed for note: {} ({})", updated_note.title, updated_note.id);
                save_note_using_file_storage(&updated_note, &config_lock).await?;
                // Update the content hash after successful save
                modified_tracker.update_content_hash(&id, &updated_note.content).await;
                modified_tracker.clear_modified(&id).await;
            } else if title_changed || tags_changed {
                // For title/tags only changes, still save but log differently
                log_info!("NOTES", "📝 Metadata changed for note: {} ({})", updated_note.title, updated_note.id);
                save_note_using_file_storage(&updated_note, &config_lock).await?;
            }
            
            Ok(Some(updated_note))
        } else {
            log_debug!("NOTES", "No changes detected for note: {} ({})", note.title, note.id);
            Ok(Some(note.clone()))
        }
    } else {
        log_error!("NOTES", "Attempted to update non-existent note: {}", id);
        Ok(None)
    }
}

/// Delete a note
#[tauri::command]
pub async fn delete_note(
    id: String, 
    notes: State<'_, NotesState>,
    config: State<'_, ConfigState>,
    modified_tracker: State<'_, ModifiedStateTracker>,
) -> Result<bool, String> {
    let mut notes_lock = notes.lock().await;
    let config_lock = config.lock().await;
    let removed = notes_lock.remove(&id).is_some();
    
    if removed {
        // Delete using file storage (this handles everything including index updates)
        let file_storage = FileNotesStorage::new(&config_lock)?;
        file_storage.delete_note(&id).await?;
        
        // Remove from modified tracker
        modified_tracker.remove_note(&id).await;
        
        log_info!("NOTES", "Deleted note: {}", id);
    } else {
        log_error!("NOTES", "Attempted to delete non-existent note: {}", id);
    }
    
    Ok(removed)
}

/// Update note positions for manual reordering
#[tauri::command]
pub async fn reorder_notes(
    note_ids: Vec<String>,
    notes: State<'_, NotesState>,
    config: State<'_, ConfigState>,
) -> Result<(), String> {
    let mut notes_lock = notes.lock().await;
    let config_lock = config.lock().await;
    
    // Update positions based on the order in note_ids
    for (index, note_id) in note_ids.iter().enumerate() {
        if let Some(note) = notes_lock.get_mut(note_id) {
            note.position = Some(index as i32);
        }
    }
    
    // Save all notes since multiple positions changed
    save_all_notes_using_file_storage(&notes_lock, &config_lock).await?;
    log_info!("NOTES", "Reordered {} notes", note_ids.len());
    
    Ok(())
}