import { invoke } from '@tauri-apps/api/core';
import { Note, CreateNoteRequest, UpdateNoteRequest } from '../types/note';

export const notesApi = {
  async getNotes(): Promise<Note[]> {
    return await invoke('get_notes');
  },

  async getNote(id: string): Promise<Note | null> {
    return await invoke('get_note', { id });
  },

  async createNote(request: CreateNoteRequest): Promise<Note> {
    return await invoke('create_note', { request });
  },

  async updateNote(
    id: string,
    request: UpdateNoteRequest
  ): Promise<Note | null> {
    return await invoke('update_note', { id, request });
  },

  async deleteNote(id: string): Promise<boolean> {
    return await invoke('delete_note', { id });
  },

  // File import/export operations
  async importNotesFromDirectory(directoryPath: string): Promise<Note[]> {
    return await invoke('import_notes_from_directory', { directoryPath });
  },

  async importSingleFile(filePath: string): Promise<Note> {
    return await invoke('import_single_file', { filePath });
  },

  async exportNoteToFile(noteId: string, filePath: string): Promise<void> {
    return await invoke('export_note_to_file', { noteId, filePath });
  },

  async exportAllNotesToDirectory(directoryPath: string): Promise<string[]> {
    return await invoke('export_all_notes_to_directory', { directoryPath });
  },

  // Notes directory management
  async setNotesDirectory(directoryPath: string): Promise<void> {
    return await invoke('set_notes_directory', { directoryPath });
  },

  async reloadNotesFromDirectory(): Promise<Note[]> {
    return await invoke('reload_notes_from_directory');
  },

  async getCurrentNotesDirectory(): Promise<string> {
    return await invoke('get_current_notes_directory');
  },

  // Directory dialog
  async openDirectoryDialog(): Promise<string | null> {
    return await invoke('open_directory_dialog');
  },

  // Open directory in Finder/Explorer
  async openDirectoryInFinder(directoryPath: string): Promise<void> {
    return await invoke('open_directory_in_finder', { directoryPath });
  },
};