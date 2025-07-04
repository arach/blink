import { useState, useCallback, useMemo } from 'react';
import { useConfigStore } from '../stores/config-store';
import { useDetachedWindowsStore } from '../stores/detached-windows-store';

interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
}

interface Command {
  id: string;
  title: string;
  description: string;
  action: () => void;
  category: 'note' | 'action' | 'navigation';
}

interface UseCommandPaletteProps {
  notes: Note[];
  selectedNoteId: string | null;
  isPreviewMode: boolean;
  sidebarVisible: boolean;
  onCreateNewNote: () => void;
  onSelectNote: (noteId: string) => void;
  onToggleSidebar: () => void;
  onTogglePreview: () => void;
  onOpenSettings: () => void;
}

interface UseCommandPaletteReturn {
  // State
  showCommandPalette: boolean;
  commandQuery: string;
  selectedCommandIndex: number;
  filteredCommands: Command[];

  // Actions
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  setCommandQuery: (query: string) => void;
  setSelectedCommandIndex: (index: number) => void;
  executeSelectedCommand: () => void;
  executeCommand: (command: Command) => void;
  handleCommandKeyDown: (e: React.KeyboardEvent) => void;
}

export function useCommandPalette({
  notes,
  selectedNoteId,
  isPreviewMode,
  sidebarVisible,
  onCreateNewNote,
  onSelectNote,
  onToggleSidebar,
  onTogglePreview,
  onOpenSettings,
}: UseCommandPaletteProps): UseCommandPaletteReturn {
  const { config, updateConfig } = useConfigStore();
  const { createWindow } = useDetachedWindowsStore();
  
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);

  // Generate all available commands
  const getCommands = useCallback((): Command[] => {
    const commands: Command[] = [
      {
        id: 'new-note',
        title: 'New Note',
        description: 'Create a new note',
        action: () => {
          setShowCommandPalette(false);
          onCreateNewNote();
        },
        category: 'action'
      },
      {
        id: 'toggle-sidebar',
        title: 'Toggle Sidebar',
        description: 'Show or hide the sidebar',
        action: () => {
          setShowCommandPalette(false);
          onToggleSidebar();
        },
        category: 'navigation'
      },
      {
        id: 'toggle-preview',
        title: 'Toggle Markdown Preview',
        description: isPreviewMode ? 'Switch to edit mode' : 'Show markdown preview',
        action: () => {
          setShowCommandPalette(false);
          onTogglePreview();
        },
        category: 'action'
      },
      {
        id: 'open-settings',
        title: 'Open Settings',
        description: 'Configure app appearance and behavior',
        action: () => {
          setShowCommandPalette(false);
          onOpenSettings();
        },
        category: 'action'
      },
      {
        id: 'toggle-focus',
        title: 'Toggle Focus Mode',
        description: config.appearance?.focusMode ? 'Exit focus mode' : 'Enter distraction-free writing',
        action: () => {
          setShowCommandPalette(false);
          const newConfig = {
            ...config,
            appearance: {
              ...config.appearance,
              focusMode: !config.appearance?.focusMode
            }
          };
          updateConfig(newConfig);
        },
        category: 'action'
      }
    ];

    // Add detach window command for selected note
    if (selectedNoteId) {
      const selectedNote = notes.find(note => note.id === selectedNoteId);
      if (selectedNote) {
        commands.push({
          id: 'detach-note',
          title: 'Detach Note',
          description: `Open "${selectedNote.title}" in floating window`,
          action: async () => {
            setShowCommandPalette(false);
            try {
              await createWindow(selectedNoteId, window.screen.width / 2, window.screen.height / 2);
            } catch (error) {
              console.error('Failed to detach note:', error);
            }
          },
          category: 'action'
        });
      }
    }

    // Add note navigation commands
    notes.forEach(note => {
      commands.push({
        id: `note-${note.id}`,
        title: note.title || 'Untitled',
        description: `Open note: ${note.title || 'Untitled'}`,
        action: () => {
          setShowCommandPalette(false);
          onSelectNote(note.id);
        },
        category: 'note'
      });
    });

    return commands;
  }, [
    notes,
    selectedNoteId,
    isPreviewMode,
    config,
    updateConfig,
    createWindow,
    onCreateNewNote,
    onSelectNote,
    onToggleSidebar,
    onTogglePreview,
    onOpenSettings
  ]);

  // Filter commands based on search query
  const filteredCommands = useMemo(() => {
    const commands = getCommands();
    
    if (!commandQuery.trim()) {
      return commands;
    }

    const query = commandQuery.toLowerCase();
    return commands.filter(command => 
      command.title.toLowerCase().includes(query) ||
      command.description.toLowerCase().includes(query)
    );
  }, [commandQuery, getCommands]);

  // Open command palette
  const openCommandPalette = useCallback(() => {
    setShowCommandPalette(true);
    setCommandQuery('');
    setSelectedCommandIndex(0);
  }, []);

  // Close command palette
  const closeCommandPalette = useCallback(() => {
    setShowCommandPalette(false);
    setCommandQuery('');
    setSelectedCommandIndex(0);
  }, []);

  // Execute a specific command
  const executeCommand = useCallback((command: Command) => {
    command.action();
  }, []);

  // Execute the currently selected command
  const executeSelectedCommand = useCallback(() => {
    if (filteredCommands.length > 0 && selectedCommandIndex < filteredCommands.length) {
      const command = filteredCommands[selectedCommandIndex];
      executeCommand(command);
    }
  }, [filteredCommands, selectedCommandIndex, executeCommand]);

  // Handle keyboard navigation in command palette
  const handleCommandKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedCommandIndex(prev => 
          prev < filteredCommands.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedCommandIndex(prev => 
          prev > 0 ? prev - 1 : filteredCommands.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        executeSelectedCommand();
        break;
      case 'Escape':
        e.preventDefault();
        closeCommandPalette();
        break;
    }
  }, [filteredCommands.length, executeSelectedCommand, closeCommandPalette]);

  // Reset selected index when filtered commands change
  const resetSelectedIndex = useCallback(() => {
    setSelectedCommandIndex(0);
  }, []);

  // Update selected index when query changes
  useState(() => {
    resetSelectedIndex();
  });

  return {
    // State
    showCommandPalette,
    commandQuery,
    selectedCommandIndex,
    filteredCommands,

    // Actions
    openCommandPalette,
    closeCommandPalette,
    setCommandQuery,
    setSelectedCommandIndex,
    executeSelectedCommand,
    executeCommand,
    handleCommandKeyDown,
  };
}