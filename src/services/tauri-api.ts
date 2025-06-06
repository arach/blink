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
};