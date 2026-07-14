use std::collections::HashMap;
use tauri::{AppHandle, State};
use tokio::sync::Mutex;

use crate::services::note_service::NoteService;
use crate::types::note::{Note, CreateNoteRequest, UpdateNoteRequest};
use crate::{log_info, log_error};

/// Tauri commands for note management using the new file-based system

type NoteServiceState = Mutex<NoteService>;

#[tauri::command]
pub async fn get_notes_v2(
    note_service: State<'_, NoteServiceState>,
) -> Result<HashMap<String, Note>, String> {
    log_info!("NOTE_COMMANDS", "Getting all notes (v2)");
    
    let service = note_service.lock().await;
    service.get_all_notes().await
}

#[tauri::command]
pub async fn get_note_v2(
    note_id: String,
    note_service: State<'_, NoteServiceState>,
) -> Result<Option<Note>, String> {
    log_info!("NOTE_COMMANDS", "Getting note: {}", note_id);
    
    let service = note_service.lock().await;
    service.get_note(&note_id).await
}

#[tauri::command]
pub async fn create_note_v2(
    request: CreateNoteRequest,
    note_service: State<'_, NoteServiceState>,
) -> Result<Note, String> {
    log_info!("NOTE_COMMANDS", "Creating note: {}", request.title);
    
    let service = note_service.lock().await;
    service.create_note(request).await
}

#[tauri::command]
pub async fn update_note_v2(
    note_id: String,
    request: UpdateNoteRequest,
    note_service: State<'_, NoteServiceState>,
) -> Result<Note, String> {
    log_info!("NOTE_COMMANDS", "Updating note: {}", note_id);
    
    let service = note_service.lock().await;
    service.update_note(&note_id, request).await
}

#[tauri::command]
pub async fn delete_note_v2(
    note_id: String,
    note_service: State<'_, NoteServiceState>,
) -> Result<(), String> {
    log_info!("NOTE_COMMANDS", "Deleting note: {}", note_id);
    
    let service = note_service.lock().await;
    service.delete_note(&note_id).await
}

#[tauri::command]
pub async fn reload_notes_v2(
    note_service: State<'_, NoteServiceState>,
) -> Result<(), String> {
    log_info!("NOTE_COMMANDS", "Reloading notes from file system");
    
    let service = note_service.lock().await;
    service.reload_notes().await
}

#[tauri::command]
pub async fn get_notes_stats_v2(
    note_service: State<'_, NoteServiceState>,
) -> Result<crate::services::note_service::NoteStats, String> {
    log_info!("NOTE_COMMANDS", "Getting notes statistics");
    
    let service = note_service.lock().await;
    service.get_stats().await
}