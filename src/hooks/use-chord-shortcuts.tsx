import { useState, useEffect, useCallback, useRef } from 'react';

interface UseChordShortcutsProps {
  notes: Array<{ id: string; title: string }>;
  onSelectNote: (noteId: string) => void;
  onCreateNewNote: () => void;
  onToggleCommandPalette: () => void;
  onCreateDetachedWindow: (noteId: string) => void;
}

type ChordMode = 'none' | 'note' | 'window';

export function useChordShortcuts({
  notes,
  onSelectNote,
  onCreateNewNote,
  onToggleCommandPalette,
  onCreateDetachedWindow,
}: UseChordShortcutsProps) {
  const [chordMode, setChordMode] = useState<ChordMode>('none');
  const [showChordHint, setShowChordHint] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Clear chord mode after timeout
  const clearChordMode = useCallback(() => {
    setChordMode('none');
    setShowChordHint(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // Start chord mode with timeout
  const startChordMode = useCallback((mode: ChordMode) => {
    setChordMode(mode);
    setShowChordHint(true);
    
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // Set new timeout (3 seconds to complete chord)
    timeoutRef.current = setTimeout(() => {
      clearChordMode();
    }, 3000);
  }, [clearChordMode]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't handle shortcuts when typing in input fields
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true') {
      return;
    }

    // Handle chord initiators (global shortcuts)
    if (e.metaKey && e.ctrlKey && e.altKey && e.shiftKey) {
      switch (e.key.toLowerCase()) {
        case 'n':
          e.preventDefault();
          startChordMode('note');
          console.log('[CHORD] Started note chord mode - press 1-9 for notes, N for new, S for search');
          return;
        case 'w':
          e.preventDefault();
          startChordMode('window');
          console.log('[CHORD] Started window chord mode - press 1-9 to detach notes');
          return;
      }
    }

    // Handle ESC to cancel chord mode
    if (chordMode !== 'none' && e.key === 'Escape') {
      e.preventDefault();
      clearChordMode();
      console.log('[CHORD] Cancelled chord mode');
      return;
    }

    // Handle chord completions
    if (chordMode !== 'none') {
      e.preventDefault();
      
      switch (chordMode) {
        case 'note':
          if (e.key >= '1' && e.key <= '9') {
            // Select note by number
            const noteIndex = parseInt(e.key) - 1;
            if (notes[noteIndex]) {
              onSelectNote(notes[noteIndex].id);
              console.log(`[CHORD] Selected note ${noteIndex + 1}: ${notes[noteIndex].title}`);
            }
          } else if (e.key.toLowerCase() === 'n') {
            // Create new note
            onCreateNewNote();
            console.log('[CHORD] Created new note');
          } else if (e.key.toLowerCase() === 's') {
            // Open search/command palette
            onToggleCommandPalette();
            console.log('[CHORD] Opened command palette');
          }
          break;
          
        case 'window':
          if (e.key >= '1' && e.key <= '9') {
            // Detach note by number
            const noteIndex = parseInt(e.key) - 1;
            if (notes[noteIndex]) {
              onCreateDetachedWindow(notes[noteIndex].id);
              console.log(`[CHORD] Detached note ${noteIndex + 1}: ${notes[noteIndex].title}`);
            }
          }
          break;
      }
      
      clearChordMode();
    }
  }, [chordMode, notes, onSelectNote, onCreateNewNote, onToggleCommandPalette, onCreateDetachedWindow, startChordMode, clearChordMode]);

  // Set up event listeners
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [handleKeyDown]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    chordMode,
    showChordHint,
    clearChordMode,
  };
}