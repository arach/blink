import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { noteSyncService, useNoteSync } from '../services/note-sync';
import { Note } from '../types';
import { extractTitleFromContent } from '../lib/utils';

interface UseNoteManagementReturn {
  // State
  notes: Note[];
  selectedNoteId: string | null;
  currentContent: string;
  loading: boolean;
  selectedNote: Note | undefined;

  // Actions
  loadNotes: () => Promise<void>;
  createNewNote: () => Promise<void>;
  selectNote: (noteId: string) => void;
  updateNoteContent: (content: string) => void;
  saveNoteImmediately: () => Promise<void>;
  deleteNote: (noteId: string) => Promise<void>;
  extractTitleFromContent: (content: string) => string;

  // Setters for external control
  setCurrentContent: (content: string) => void;
  setSelectedNoteId: (id: string | null) => void;

}

interface UseNoteManagementOptions {
  onSaveStart?: () => void;
  onSaveComplete?: () => void;
  onSaveError?: (error: any) => void;
}

export function useNoteManagement(options?: UseNoteManagementOptions): UseNoteManagementReturn {
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [currentContent, setCurrentContent] = useState('');
  const [loading, setLoading] = useState(true);
  
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const selectedNoteIdRef = useRef<string | null>(null);

  // Update ref when selectedNoteId changes
  selectedNoteIdRef.current = selectedNoteId;

  const selectedNote = notes.find(note => note.id === selectedNoteId);

  // Real-time sync for selected note
  useNoteSync(selectedNoteId, (updatedNote) => {
    console.log('[BLINK] [SYNC] Received note update:', {
      selectedNoteId,
      updatedNoteId: updatedNote?.id,
      updatedNoteTitle: updatedNote?.title,
      contentLength: updatedNote?.content?.length
    });
    
    if (updatedNote && selectedNoteId === updatedNote.id) {
      console.log('[BLINK] [SYNC] Updating current content for note:', selectedNoteId);
      setCurrentContent(updatedNote.content);
    } else {
      console.log('[BLINK] [SYNC] Ignoring update - note ID mismatch or no update');
    }
  });


  // Load notes from backend
  const loadNotes = useCallback(async () => {
    setLoading(true);
    const startTime = performance.now();
    try {
      // Try to load notes from Tauri - if this fails, we'll fall back to demo data
      const loadedNotes = await invoke<Note[]>('get_notes');
      const loadTime = performance.now() - startTime;
      console.log(`[BLINK] Notes loaded in ${loadTime.toFixed(2)}ms (${loadedNotes.length} notes)`);
      setNotes(loadedNotes);
      
      // If we have notes but no selected note, select the first one by position
      if (loadedNotes.length > 0 && !selectedNoteIdRef.current) {
        // Select the note with the lowest position value, or the first in array if no positions
        const noteWithLowestPosition = loadedNotes.reduce((lowest, current) => {
          // If current has a position and lowest doesn't, use current
          if (current.position !== undefined && current.position !== null && 
              (lowest.position === undefined || lowest.position === null)) {
            return current;
          }
          // If both have positions, use the one with lower position
          if (current.position !== undefined && current.position !== null && 
              lowest.position !== undefined && lowest.position !== null) {
            return current.position < lowest.position ? current : lowest;
          }
          // Otherwise keep lowest
          return lowest;
        }, loadedNotes[0]);
        
        setSelectedNoteId(noteWithLowestPosition.id);
        setCurrentContent(noteWithLowestPosition.content);
      }
    } catch (error) {
      console.warn('[BLINK] Failed to load notes from Tauri, falling back to demo data:', error);
      // Demo data for browser context or when Tauri fails
      const demoNotes: Note[] = [
        { 
          id: 'demo-1', 
          title: 'Welcome to Blink', 
          content: '# Welcome to Blink\n\nThis is a demo note running in browser mode.',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          tags: []
        },
        { 
          id: 'demo-2', 
          title: 'Demo Note 2', 
          content: '# Demo Note\n\nYou can see the interface, but Tauri features require the desktop app.',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          tags: []
        }
      ];
      setNotes(demoNotes);
      if (!selectedNoteIdRef.current) {
        setSelectedNoteId('demo-1');
        setCurrentContent(demoNotes[0].content);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Create new note
  const createNewNote = useCallback(async () => {
    console.log('[BLINK] Creating new note...');
    try {
      const newNote = await invoke<Note>('create_note', {
        request: {
          title: 'Untitled',
          content: '',
          tags: []
        }
      });
      
      console.log('[BLINK] Created note:', newNote.id);
      // Add the new note to the list - backend already handles positioning
      setNotes(prev => {
        const updated = [...prev, newNote];
        // Sort by position (backend-assigned), with None values at the end
        return updated.sort((a, b) => {
          if (a.position !== undefined && b.position !== undefined) {
            return a.position - b.position;
          }
          if (a.position !== undefined) return -1;
          if (b.position !== undefined) return 1;
          // Both have no position - maintain original order (don't sort by updated_at)
          return 0;
        });
      });
      setSelectedNoteId(newNote.id);
      setCurrentContent('');
    } catch (error) {
      console.error('[BLINK] Failed to create note:', error);
    }
  }, []);

  // Select a note
  const selectNote = useCallback((noteId: string) => {
    console.log('[BLINK] [SELECT] Selecting note:', {
      noteId,
      previousSelectedId: selectedNoteId,
      notesCount: notes.length
    });
    
    // DEBUG: Log the note at position 0 before selection
    const noteAtPosition0 = notes.find(n => n.position === 0);
    const noteAtIndex0 = notes[0];
    console.log('[BLINK] [DEBUG] Before selection:', {
      noteAtPosition0: noteAtPosition0 ? { id: noteAtPosition0.id, title: noteAtPosition0.title } : 'none',
      noteAtIndex0: noteAtIndex0 ? { id: noteAtIndex0.id, title: noteAtIndex0.title, position: noteAtIndex0.position } : 'none'
    });
    
    // Clear any pending save for the previous note
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    
    const note = notes.find(n => n.id === noteId);
    if (note) {
      console.log('[BLINK] [SELECT] Found note:', {
        noteId: note.id,
        title: note.title,
        contentLength: note.content.length,
        position: note.position
      });
      setSelectedNoteId(noteId);
      setCurrentContent(note.content);
      
      // DEBUG: Log the note at position 0 after selection
      const noteAtPosition0After = notes.find(n => n.position === 0);
      const noteAtIndex0After = notes[0];
      console.log('[BLINK] [DEBUG] After selection:', {
        noteAtPosition0: noteAtPosition0After ? { id: noteAtPosition0After.id, title: noteAtPosition0After.title } : 'none',
        noteAtIndex0: noteAtIndex0After ? { id: noteAtIndex0After.id, title: noteAtIndex0After.title, position: noteAtIndex0After.position } : 'none'
      });
    } else {
      console.error('[BLINK] [SELECT] Note not found:', noteId);
    }
  }, [notes, selectedNoteId]);

  // Update note content with debouncing
  const updateNoteContent = useCallback((content: string) => {
    if (!selectedNoteId) return;
    
    // Update local state immediately for responsiveness
    setCurrentContent(content);
    
    // Extract title and update the note in local state immediately
    const title = extractTitleFromContent(content);
    setNotes(prev => {
      // Update the note without re-sorting to preserve order
      const updated = prev.map(note => 
        note.id === selectedNoteId 
          ? { ...note, title, content, updated_at: new Date().toISOString() }
          : note
      );
      // Don't re-sort here - preserve the original order from the backend
      return updated;
    });

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new timeout for saving to backend (debounced)
    saveTimeoutRef.current = setTimeout(async () => {
      console.log('[BLINK] Saving note content to backend (debounced):', selectedNoteId);
      
      // Notify save is starting
      options?.onSaveStart?.();
      
      try {
        // Update in backend
        const updatedNote = await invoke<Note>('update_note', {
          id: selectedNoteId,
          request: {
            title,
            content,
            tags: undefined // Keep existing tags
          }
        });

        console.log('[BLINK] Note saved successfully:', updatedNote.id);
        
        // Notify save completed
        options?.onSaveComplete?.();
        
        // Notify other windows about the update
        noteSyncService.noteUpdated(updatedNote);
        
      } catch (error) {
        console.error('[BLINK] Failed to save note:', error);
        options?.onSaveError?.(error);
        // Note: We don't revert local changes here since the user may have continued typing
      }
    }, 30000); // 30 second save interval
  }, [selectedNoteId, options]);

  // Save note immediately (for Cmd+S)
  const saveNoteImmediately = useCallback(async () => {
    if (!selectedNoteId || !currentContent === undefined) return;
    
    // Clear any pending debounced save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    
    console.log('[BLINK] Saving note immediately:', selectedNoteId);
    
    // Notify save is starting
    options?.onSaveStart?.();
    
    try {
      const title = extractTitleFromContent(currentContent);
      
      // Update in backend
      const updatedNote = await invoke<Note>('update_note', {
        id: selectedNoteId,
        request: {
          title,
          content: currentContent,
          tags: undefined // Keep existing tags
        }
      });

      console.log('[BLINK] Note saved immediately:', updatedNote.id);
      
      // Update local state to reflect saved state
      setNotes(prev => {
        const updated = prev.map(note => 
          note.id === selectedNoteId 
            ? { ...note, title, content: currentContent, updated_at: updatedNote.updated_at }
            : note
        );
        // Don't re-sort here - preserve the original order from the backend
        return updated;
      });
      
      // Notify save completed
      options?.onSaveComplete?.();
      
      // Notify other windows about the update
      noteSyncService.noteUpdated(updatedNote);
      
    } catch (error) {
      console.error('[BLINK] Failed to save note immediately:', error);
      options?.onSaveError?.(error);
    }
  }, [selectedNoteId, currentContent, options]);

  // Delete a note
  const deleteNote = useCallback(async (noteId: string) => {
    console.log('[BLINK] Deleting note:', noteId);
    try {
      await invoke('delete_note', { id: noteId });
      
      // Remove from local state
      setNotes(prev => prev.filter(note => note.id !== noteId));
      
      // If this was the selected note, clear selection or select another
      if (selectedNoteId === noteId) {
        const remainingNotes = notes.filter(note => note.id !== noteId);
        if (remainingNotes.length > 0) {
          const nextNote = remainingNotes[0];
          setSelectedNoteId(nextNote.id);
          setCurrentContent(nextNote.content);
        } else {
          setSelectedNoteId(null);
          setCurrentContent('');
        }
      }
      
      console.log('[BLINK] Note deleted successfully');
    } catch (error) {
      console.error('[BLINK] Failed to delete note:', error);
    }
  }, [selectedNoteId, notes]);

  // Load notes on mount and listen for data-loaded event
  useEffect(() => {
    loadNotes();
    
    // Listen for data-loaded event from backend
    const setupListener = async () => {
      const unlisten = await listen('data-loaded', () => {
        console.log('[BLINK] Backend data loaded, reloading notes...');
        loadNotes();
      });
      return unlisten;
    };
    
    let unlisten: (() => void) | undefined;
    setupListener().then(fn => { unlisten = fn; });
    
    return () => {
      if (unlisten) unlisten();
      // Clear any pending save timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [loadNotes]);


  return {
    // State
    notes,
    selectedNoteId,
    currentContent,
    loading,
    selectedNote,

    // Actions
    loadNotes,
    createNewNote,
    selectNote,
    updateNoteContent,
    saveNoteImmediately,
    deleteNote,
    extractTitleFromContent,

    // Setters for external control
    setCurrentContent,
    setSelectedNoteId,
  };
}