import { useState, useCallback, useEffect } from 'react';

interface ContextMenuState {
  x: number;
  y: number;
  noteId: string;
}

interface UseContextMenuReturn {
  // State
  contextMenu: ContextMenuState | null;
  
  // Actions
  showContextMenu: (x: number, y: number, noteId: string) => void;
  hideContextMenu: () => void;
  handleContextMenuAction: (action: 'delete' | 'detach', noteId: string) => void;
}

interface UseContextMenuProps {
  onDeleteNote: (noteId: string) => Promise<void>;
  onDetachNote: (noteId: string) => Promise<void>;
}

export function useContextMenu({
  onDeleteNote,
  onDetachNote,
}: UseContextMenuProps): UseContextMenuReturn {
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  // Show context menu at specific coordinates
  const showContextMenu = useCallback((x: number, y: number, noteId: string) => {
    setContextMenu({ x, y, noteId });
  }, []);

  // Hide context menu
  const hideContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // Handle context menu actions
  const handleContextMenuAction = useCallback(async (action: 'delete' | 'detach', noteId: string) => {
    hideContextMenu();
    
    switch (action) {
      case 'delete':
        await onDeleteNote(noteId);
        break;
      case 'detach':
        await onDetachNote(noteId);
        break;
    }
  }, [onDeleteNote, onDetachNote, hideContextMenu]);

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return;

    const handleClickOutside = (e: MouseEvent) => {
      // Check if the click is outside the context menu
      const target = e.target as HTMLElement;
      const contextMenuElement = document.querySelector('[data-context-menu]');
      
      if (contextMenuElement && !contextMenuElement.contains(target)) {
        hideContextMenu();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        hideContextMenu();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [contextMenu, hideContextMenu]);

  return {
    // State
    contextMenu,
    
    // Actions
    showContextMenu,
    hideContextMenu,
    handleContextMenuAction,
  };
}