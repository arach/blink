use tauri::State;
use uuid::Uuid;

use crate::types::{
    note::{Note, CreateNoteRequest, UpdateNoteRequest},
    window::NotesState,
};
use crate::modules::storage::save_notes_to_disk;
use crate::{log_info, log_error};

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
) -> Result<Note, String> {
    let mut notes_lock = notes.lock().await;
    
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
    save_notes_to_disk(&notes_lock).await?;
    
    log_info!("NOTES", "Created note: {} ({})", note.title, note.id);
    Ok(note)
}

/// Update an existing note
#[tauri::command]
pub async fn update_note(
    id: String,
    request: UpdateNoteRequest,
    notes: State<'_, NotesState>,
) -> Result<Option<Note>, String> {
    let mut notes_lock = notes.lock().await;
    
    if let Some(note) = notes_lock.get_mut(&id) {
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
        save_notes_to_disk(&notes_lock).await?;
        
        log_info!("NOTES", "Updated note: {} ({})", updated_note.title, updated_note.id);
        Ok(Some(updated_note))
    } else {
        log_error!("NOTES", "Attempted to update non-existent note: {}", id);
        Ok(None)
    }
}

/// Delete a note
#[tauri::command]
pub async fn delete_note(id: String, notes: State<'_, NotesState>) -> Result<bool, String> {
    let mut notes_lock = notes.lock().await;
    let removed = notes_lock.remove(&id).is_some();
    
    if removed {
        save_notes_to_disk(&notes_lock).await?;
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
) -> Result<(), String> {
    let mut notes_lock = notes.lock().await;
    
    // Update positions based on the order in note_ids
    for (index, note_id) in note_ids.iter().enumerate() {
        if let Some(note) = notes_lock.get_mut(note_id) {
            note.position = Some(index as i32);
        }
    }
    
    save_notes_to_disk(&notes_lock).await?;
    log_info!("NOTES", "Reordered {} notes", note_ids.len());
    
    Ok(())
}