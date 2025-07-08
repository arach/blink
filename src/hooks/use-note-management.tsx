import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
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
  deleteNote: (noteId: string) => Promise<void>;
  extractTitleFromContent: (content: string) => string;

  // Setters for external control
  setCurrentContent: (content: string) => void;
  setSelectedNoteId: (id: string | null) => void;
}

export function useNoteManagement(): UseNoteManagementReturn {
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [currentContent, setCurrentContent] = useState('');
  const [loading, setLoading] = useState(true);

  const selectedNote = notes.find(note => note.id === selectedNoteId);

  // Real-time sync for selected note
  useNoteSync(selectedNoteId, (updatedNote) => {
    if (updatedNote && selectedNoteId === updatedNote.id) {
      setCurrentContent(updatedNote.content);
    }
  });


  // Load notes from backend
  const loadNotes = useCallback(async () => {
    setLoading(true);
    try {
      // Try to load notes from Tauri - if this fails, we'll fall back to demo data
      const loadedNotes = await invoke<Note[]>('get_notes');
      setNotes(loadedNotes);
      
      // If we have notes but no selected note, select the first one
      if (loadedNotes.length > 0 && !selectedNoteId) {
        const firstNote = loadedNotes[0];
        setSelectedNoteId(firstNote.id);
        setCurrentContent(firstNote.content);
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
      if (!selectedNoteId) {
        setSelectedNoteId('demo-1');
        setCurrentContent(demoNotes[0].content);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedNoteId]);

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
      setNotes(prev => [newNote, ...prev]);
      setSelectedNoteId(newNote.id);
      setCurrentContent('');
    } catch (error) {
      console.error('[BLINK] Failed to create note:', error);
    }
  }, []);

  // Select a note
  const selectNote = useCallback((noteId: string) => {
    const note = notes.find(n => n.id === noteId);
    if (note) {
      setSelectedNoteId(noteId);
      setCurrentContent(note.content);
    }
  }, [notes]);

  // Update note content
  const updateNoteContent = useCallback(async (content: string) => {
    if (!selectedNoteId) return;

    console.log('[BLINK] Updating note content for:', selectedNoteId);
    
    // Update local state immediately for responsiveness
    setCurrentContent(content);
    
    // Extract title and update the note in local state
    const title = extractTitleFromContent(content);
    setNotes(prev => prev.map(note => 
      note.id === selectedNoteId 
        ? { ...note, title, content, updatedAt: new Date().toISOString() }
        : note
    ));

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

      console.log('[BLINK] Note updated successfully:', updatedNote.id);
      
      // Notify other windows about the update
      noteSyncService.noteUpdated(updatedNote);
      
    } catch (error) {
      console.error('[BLINK] Failed to update note:', error);
      // Revert local changes on error
      const originalNote = notes.find(n => n.id === selectedNoteId);
      if (originalNote) {
        setCurrentContent(originalNote.content);
        setNotes(prev => prev.map(note => 
          note.id === selectedNoteId ? originalNote : note
        ));
      }
    }
  }, [selectedNoteId, notes]);

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

  // Load notes on mount
  useEffect(() => {
    loadNotes();
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
    deleteNote,
    extractTitleFromContent,

    // Setters for external control
    setCurrentContent,
    setSelectedNoteId,
  };
}