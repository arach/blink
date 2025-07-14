import { useEffect } from 'react';

import { Note } from '../types';

interface SyncEvent {
  type: 'note-updated' | 'note-created' | 'note-deleted';
  noteId: string;
  note?: Note;
}

type SyncListener = (event: SyncEvent) => void;

class NoteSyncService {
  private listeners: Set<SyncListener> = new Set();

  // Subscribe to sync events
  subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // Emit sync events to all listeners
  private emit(event: SyncEvent) {
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in sync listener:', error);
      }
    });
  }

  // Notify that a note was updated
  noteUpdated(note: Note) {
    this.emit({
      type: 'note-updated',
      noteId: note.id,
      note,
    });
  }

  // Notify that a note was created
  noteCreated(note: Note) {
    this.emit({
      type: 'note-created',
      noteId: note.id,
      note,
    });
  }

  // Notify that a note was deleted
  noteDeleted(noteId: string) {
    this.emit({
      type: 'note-deleted',
      noteId,
    });
  }
}

// Global singleton instance
export const noteSyncService = new NoteSyncService();

// Hook for using sync in React components
export function useNoteSync(noteId: string | null, onNoteUpdate: (note: Note) => void) {
  const subscribe = (listener: SyncListener) => noteSyncService.subscribe(listener);

  // Set up listener for this specific note
  useEffect(() => {
    if (!noteId) return;

    const unsubscribe = subscribe((event) => {
      if (event.noteId === noteId && event.type === 'note-updated' && event.note) {
        onNoteUpdate(event.note);
      }
    });

    return unsubscribe;
  }, [noteId, onNoteUpdate]);

  return noteSyncService;
}