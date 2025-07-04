import { useEffect, useCallback } from 'react';

interface UseKeyboardShortcutsProps {
  onNewNote: () => void;
  onToggleCommandPalette: () => void;
  onTogglePreview: () => void;
  onOpenSettings: () => void;
  onToggleFocus: () => void;
  isCommandPaletteOpen: boolean;
}

export function useKeyboardShortcuts({
  onNewNote,
  onToggleCommandPalette,
  onTogglePreview,
  onOpenSettings,
  onToggleFocus,
  isCommandPaletteOpen,
}: UseKeyboardShortcutsProps) {
  
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't handle shortcuts when command palette is open (it handles its own)
    if (isCommandPaletteOpen) return;
    
    // Don't handle shortcuts when typing in input fields
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true') {
      return;
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
    isCommandPaletteOpen
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