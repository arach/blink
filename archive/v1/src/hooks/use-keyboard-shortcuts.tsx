import { useEffect, useCallback } from 'react';

interface UseKeyboardShortcutsProps {
  onNewNote: () => void;
  onToggleCommandPalette: () => void;
  onTogglePreview: () => void;
  onOpenSettings: () => void;
  onToggleFocus: () => void;
  isCommandPaletteOpen: boolean;
  notes: Array<{ id: string; title: string }>;
  onSelectNote: (noteId: string) => void;
}

export function useKeyboardShortcuts({
  onNewNote,
  onToggleCommandPalette,
  onTogglePreview,
  onOpenSettings,
  onToggleFocus,
  isCommandPaletteOpen,
  notes,
  onSelectNote,
}: UseKeyboardShortcutsProps) {
  
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't handle shortcuts when command palette is open (it handles its own)
    if (isCommandPaletteOpen) return;
    
    // Don't handle shortcuts when typing in input fields
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true') {
      return;
    }

    // Hyper key (Cmd+Ctrl+Alt+Shift) + number combinations for quick note access
    if (e.metaKey && e.ctrlKey && e.altKey && e.shiftKey) {
      const numberKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
      if (numberKeys.includes(e.key)) {
        e.preventDefault();
        const noteIndex = parseInt(e.key) - 1;
        if (notes[noteIndex]) {
          onSelectNote(notes[noteIndex].id);
        }
        return;
      }
    }

    // Command/Ctrl key shortcuts
    if (e.metaKey || e.ctrlKey) {
      switch (e.key) {
        case 'n':
          e.preventDefault();
          onNewNote();
          break;
        
        case 'k':
          e.preventDefault();
          onToggleCommandPalette();
          break;
        
        case ',':
          e.preventDefault();
          onOpenSettings();
          break;
        
        case '.':
          e.preventDefault();
          onToggleFocus();
          break;
      }

      // Cmd/Ctrl + Shift combinations
      if (e.shiftKey) {
        switch (e.key) {
          case 'P':
            e.preventDefault();
            onTogglePreview();
            break;
        }
      }
    }

    // Handle Escape key
    if (e.key === 'Escape') {
      // Close command palette if open
      if (isCommandPaletteOpen) {
        // This will be handled by the command palette component
        return;
      }
    }
  }, [
    onNewNote,
    onToggleCommandPalette,
    onTogglePreview,
    onOpenSettings,
    onToggleFocus,
    isCommandPaletteOpen,
    notes,
    onSelectNote
  ]);

  // Set up global keyboard event listeners
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  // Return any utility functions if needed
  return {
    // Could add utilities like checking if a shortcut is pressed, etc.
  };
}