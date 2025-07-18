import { useState, useEffect, useCallback, useRef } from 'react';

interface UseChordShortcutsProps {
  notes: Array<{ id: string; title: string }>;
  onSelectNote: (noteId: string) => void;
  onCreateNewNote: () => void;
  onToggleCommandPalette: () => void;
  onCreateDetachedWindow: (noteId: string) => void;
  onFocusWindow: (noteId: string) => void;
}

type ChordMode = 'none' | 'note' | 'window';

export function useChordShortcuts({
  notes,
  onSelectNote,
  onCreateNewNote,
  onToggleCommandPalette,
  onCreateDetachedWindow,
  onFocusWindow,
}: UseChordShortcutsProps) {
  const [chordMode, setChordMode] = useState<ChordMode>('none');
  const [showChordHint, setShowChordHint] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Use refs to access latest values in stable callback
  const notesRef = useRef(notes);
  const onSelectNoteRef = useRef(onSelectNote);
  const onCreateNewNoteRef = useRef(onCreateNewNote);
  const onToggleCommandPaletteRef = useRef(onToggleCommandPalette);
  const onCreateDetachedWindowRef = useRef(onCreateDetachedWindow);
  const onFocusWindowRef = useRef(onFocusWindow);
  
  // Update refs when props change
  notesRef.current = notes;
  onSelectNoteRef.current = onSelectNote;
  onCreateNewNoteRef.current = onCreateNewNote;
  onToggleCommandPaletteRef.current = onToggleCommandPalette;
  onCreateDetachedWindowRef.current = onCreateDetachedWindow;
  onFocusWindowRef.current = onFocusWindow;

  // Clear chord mode after timeout
  const clearChordMode = useCallback(() => {
    console.log('[CHORD] clearChordMode called');
    setChordMode('none');
    setShowChordHint(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // Start chord mode with timeout
  const startChordMode = useCallback((mode: ChordMode) => {
    console.log('[CHORD] startChordMode called with:', mode);
    console.log('[CHORD] Available notes:', notes.map((n, i) => `${i+1}: ${n.title} (${n.id})`));
    console.log('[CHORD] Total notes count:', notes.length);
    
    // If we're already in the same chord mode, ignore duplicate activation
    if (chordMode === mode) {
      console.log('[CHORD] Already in', mode, 'mode, ignoring duplicate activation');
      return;
    }
    
    if (notes.length === 0) {
      console.log('[CHORD] ⚠️ No notes available! Create some notes first to use chord shortcuts.');
    }
    setChordMode(mode);
    setShowChordHint(true);
    console.log('[CHORD] ✅ Chord mode activated:', mode, 'hint visible:', true);
    
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // Set new timeout (5 seconds to complete chord)
    timeoutRef.current = setTimeout(() => {
      console.log('[CHORD] Timeout reached, clearing chord mode');
      clearChordMode();
    }, 5000);
  }, [clearChordMode, notes]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Log ALL keypresses when in chord mode
    if (chordMode !== 'none') {
      console.log('[CHORD] 🔑 RAW KEYPRESS DETECTED - key:', e.key, 'code:', e.code, 'mode:', chordMode);
    }
    
    const target = e.target as HTMLElement;
    
    // Always handle chord completions (when we're already in chord mode)
    if (chordMode !== 'none') {
      console.log('[CHORD] In chord mode, processing key regardless of input field');
      // Don't return here - let the chord completion logic handle it
    } else {
      // Only block chord initiators when typing in input fields
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true') {
        console.log('[CHORD] Ignoring chord initiator in input field:', target.tagName);
        return;
      }
    }

    console.log('[CHORD] handleKeyDown called - key:', e.key, 'code:', e.code, 'currentMode:', chordMode, 'target:', target.tagName);


    // Handle chord initiators (Hyper+Key combinations)
    if (e.metaKey && e.ctrlKey && e.altKey && e.shiftKey) {
      // Note: Hyper = Cmd+Ctrl+Alt+Shift
      // Hyper+N is reserved for quick new note creation
      console.log('[CHORD] Hyper key detected:', e.key, 'current mode:', chordMode);
      switch (e.key.toLowerCase()) {
        case 'o': // Hyper+O for "Open note mode" 
          e.preventDefault();
          console.log('[CHORD] Starting note mode');
          startChordMode('note');
          return;
        case 'b': // Hyper+B for "Bring/detach window mode"
          e.preventDefault();
          console.log('[CHORD] Starting window mode (via B)');
          startChordMode('window');
          return;
      }
    }

    // Handle ESC to cancel chord mode
    if (chordMode !== 'none' && e.key === 'Escape') {
      e.preventDefault();
      clearChordMode();
      return;
    }

    // Handle chord completions
    if (chordMode !== 'none') {
      console.log('[CHORD] In chord mode:', chordMode, 'key pressed:', e.key, 'code:', e.code);
      
      // Allow common shortcuts to pass through even in chord mode
      if (e.metaKey && (e.key === 'v' || e.key === 'c' || e.key === 'x' || e.key === 'a' || e.key === 'z')) {
        console.log('[CHORD] Allowing system shortcut:', e.key);
        clearChordMode(); // Exit chord mode when using system shortcuts
        return; // Don't prevent default for cut/copy/paste/select all/undo
      }
      
      e.preventDefault();
      
      switch (chordMode) {
        case 'note':
          // Check e.code instead of e.key to handle shifted numbers
          if (e.code >= 'Digit1' && e.code <= 'Digit9') {
            // Select note by number
            const noteIndex = parseInt(e.code.replace('Digit', '')) - 1;
            console.log('[CHORD] Note mode - selecting note:', noteIndex + 1);
            if (notes[noteIndex]) {
              onSelectNote(notes[noteIndex].id);
            }
          } else if (e.key.toLowerCase() === 'n') {
            // Create new note
            console.log('[CHORD] Note mode - creating new note');
            onCreateNewNote();
          } else if (e.key.toLowerCase() === 's') {
            // Open search/command palette
            console.log('[CHORD] Note mode - opening search');
            onToggleCommandPalette();
          }
          break;
          
        case 'window':
          console.log('[CHORD] In window mode, checking key:', e.key, 'code:', e.code);
          console.log('[CHORD] Current notes in window mode:', notes.length, notes.map(n => n.title));
          
          // QWERTY layout mapping for notes (Q=1, W=2, E=3, etc.)
          const qwertyKeys = ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'];
          const keyLower = e.key.toLowerCase();
          const noteIndex = qwertyKeys.indexOf(keyLower);
          
          if (noteIndex !== -1) {
            console.log('[CHORD] ✅ Valid QWERTY key detected:', keyLower, '- noteIndex:', noteIndex, 'total notes:', notes.length);
            if (notes[noteIndex]) {
              const targetNote = notes[noteIndex];
              console.log('[CHORD] ✅ Target note found:', targetNote.title, 'id:', targetNote.id);
              console.log('[CHORD] Calling onFocusWindow with noteId:', targetNote.id);
              onFocusWindow(targetNote.id);
            } else {
              console.log('[CHORD] ❌ No note at index:', noteIndex, 'available notes:', notes.length);
              console.log('[CHORD] ❌ Available note titles:', notes.map(n => n.title));
            }
          } else {
            console.log('[CHORD] ❌ Unhandled key in window mode - key:', e.key, 'code:', e.code);
          }
          break;
      }
      
      console.log('[CHORD] Clearing chord mode after action');
      clearChordMode();
    }
  }, [chordMode, notes, onSelectNote, onCreateNewNote, onToggleCommandPalette, onCreateDetachedWindow, onFocusWindow, startChordMode, clearChordMode]);

  // Store the handler in a ref to avoid recreating it
  const handleKeyDownRef = useRef(handleKeyDown);
  handleKeyDownRef.current = handleKeyDown;

  // Set up event listeners - only once
  useEffect(() => {
    const handler = (e: KeyboardEvent) => handleKeyDownRef.current(e);
    
    // Only log once on mount
    if (process.env.NODE_ENV === 'development') {
      console.log('[CHORD] Setting up event listener (mount)');
    }
    document.addEventListener('keydown', handler);
    return () => {
      // Only log once on unmount
      if (process.env.NODE_ENV === 'development') {
        console.log('[CHORD] Removing event listener (unmount)');
      }
      document.removeEventListener('keydown', handler);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []); // Empty dependency array - only run once

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
    startWindowMode: () => startChordMode('window'),
  };
}