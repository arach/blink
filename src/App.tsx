import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { DetachedNoteWindow } from './components/DetachedNoteWindow';
import { DragGhost } from './components/DragGhost';
import { SettingsPanel } from './components/SettingsPanel';
import { ResizablePanel } from './components/ResizablePanel';
import { useDetachedWindowsStore } from './stores/detached-windows-store';
import { useConfigStore } from './stores/config-store';
import { useSaveStatus } from './hooks/use-save-status';
import { useWindowTransparency } from './hooks/use-window-transparency';
import { useTypewriterMode } from './hooks/use-typewriter-mode';
import { noteSyncService, useNoteSync } from './services/note-sync';

interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
}

function App() {
  const { config } = useConfigStore();
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [currentContent, setCurrentContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [showPermissionPrompt, setShowPermissionPrompt] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [currentView, setCurrentView] = useState<'notes' | 'settings'>('notes');
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    noteId: string;
  } | null>(null);
  const [dragState, setDragState] = useState<{
    isDragging: boolean;
    noteId: string | null;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    justCompleted: boolean;
    updatePending?: boolean;
  }>({
    isDragging: false,
    noteId: null,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    justCompleted: false,
    updatePending: false,
  });
  

  // Detached window detection
  const [isDetachedWindow, setIsDetachedWindow] = useState(false);
  const [detachedNoteId, setDetachedNoteId] = useState<string | null>(null);
  
  // Drag ghost detection
  const [isDragGhost, setIsDragGhost] = useState(false);
  const [dragGhostTitle, setDragGhostTitle] = useState<string>('');
  
  // Detached windows store
  const { 
    createWindow, 
    closeWindow, 
    isWindowOpen, 
    loadWindows 
  } = useDetachedWindowsStore();

  // Config store
  const { loadConfig, updateConfig } = useConfigStore();

  // Save status tracking
  const saveStatus = useSaveStatus();
  
  // Window transparency hook - handles opacity changes
  useWindowTransparency();
  
  // Typewriter mode hook
  const textareaRef = useTypewriterMode();

  const selectedNote = notes.find(note => note.id === selectedNoteId);
  
  // Debug logging
  console.log('Config loaded:', config);
  console.log('Focus mode:', config.appearance?.focusMode);
  console.log('Current notes count:', notes.length);
  console.log('Selected note ID:', selectedNoteId);

  // Real-time sync for selected note
  useNoteSync(selectedNoteId, (updatedNote) => {
    setNotes(prev => prev.map(note => 
      note.id === updatedNote.id ? updatedNote : note
    ));
    if (selectedNoteId === updatedNote.id) {
      setCurrentContent(updatedNote.content);
    }
  });

  // Detect if this is a detached window or drag ghost
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const noteParam = urlParams.get('note');
    const ghostParam = urlParams.get('ghost');
    const titleParam = urlParams.get('title');
    
    if (noteParam) {
      setIsDetachedWindow(true);
      setDetachedNoteId(noteParam);
    } else if (ghostParam === 'true' && titleParam) {
      setIsDragGhost(true);
      setDragGhostTitle(decodeURIComponent(titleParam));
    }
  }, []);

  // Load notes on startup and check permissions
  useEffect(() => {
    const initializeApp = async () => {
      console.log('[NOTES-APP] [FRONTEND] Initializing app...');
      
      // Load config first and wait for it to complete
      await loadConfig();
      
      // Small delay to ensure window is ready
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Then load other data
      await loadNotes();
      loadWindows();
      
      console.log('[NOTES-APP] [FRONTEND] App initialization complete');
      
      if (!isDetachedWindow) {
        checkGlobalShortcutPermissions();
      }
    };
    
    initializeApp();
  }, [isDetachedWindow, loadConfig, loadWindows]);

  // Define createNewNote function before using it in ref
  const createNewNote = async () => {
    console.log('[NOTES-APP] [FRONTEND] Creating new note...');
    console.log('[NOTES-APP] [FRONTEND] Function called from:', new Error().stack?.split('\n')[2]);
    console.log('[NOTES-APP] [FRONTEND] Current app state:', {
      notesCount: notes.length,
      selectedNoteId,
      isDetachedWindow,
      loading
    });
    
    try {
      console.log('[NOTES-APP] [FRONTEND] Invoking create_note command...');
      const newNote = await invoke<Note>('create_note', {
        request: {
          title: 'Untitled',
          content: '',
          tags: []
        }
      });
      console.log('[NOTES-APP] [FRONTEND] ✅ New note created:', newNote.id);
      console.log('[NOTES-APP] [FRONTEND] Note object:', JSON.stringify(newNote));
      console.log('[NOTES-APP] [FRONTEND] Current notes before update:', notes.length);
      
      setNotes(prev => {
        console.log('[NOTES-APP] [FRONTEND] Updating notes array, previous length:', prev.length);
        const updated = [newNote, ...prev];
        console.log('[NOTES-APP] [FRONTEND] New notes array length:', updated.length);
        return updated;
      });
      
      setSelectedNoteId(newNote.id);
      setCurrentContent('');
      console.log('[NOTES-APP] [FRONTEND] State updates queued');
      
      // Force a re-render by logging the state
      setTimeout(() => {
        console.log('[NOTES-APP] [FRONTEND] After state update - notes count:', notes.length);
      }, 100);
    } catch (error) {
      console.error('[NOTES-APP] [FRONTEND] ❌ Failed to create note:', error);
      console.error('[NOTES-APP] [FRONTEND] Error details:', JSON.stringify(error));
    }
  };

  // Listen for menu events - use a ref to avoid stale closures
  const createNewNoteRef = useRef(createNewNote);
  createNewNoteRef.current = createNewNote;
  
  // Also store in window for debugging
  useEffect(() => {
    (window as any).createNewNoteRef = createNewNoteRef;
    (window as any).directCreateNewNote = createNewNote;
    
    // Add test for window resizing
    (window as any).testWindowResize = async () => {
      console.log('[TEST-RESIZE] Testing window resize functionality...');
      try {
        const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow');
        const { LogicalSize } = await import('@tauri-apps/api/dpi');
        
        const window = getCurrentWebviewWindow();
        console.log('[TEST-RESIZE] Window instance:', window);
        
        const currentSize = await window.innerSize();
        console.log('[TEST-RESIZE] Current size:', currentSize);
        
        console.log('[TEST-RESIZE] Setting size to 400x300...');
        await window.setSize(new LogicalSize(400, 300));
        
        console.log('[TEST-RESIZE] Waiting 2 seconds...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        console.log('[TEST-RESIZE] Restoring original size...');
        await window.setSize(new LogicalSize(currentSize.width, currentSize.height));
        
        console.log('[TEST-RESIZE] Test complete!');
      } catch (error) {
        console.error('[TEST-RESIZE] Error:', error);
      }
    };
    
    // Add test window creation function
    (window as any).testWindowCreation = async () => {
      try {
        console.log('[TEST] Testing window creation...');
        const result = await invoke('test_window_creation');
        console.log('[TEST] Window creation result:', result);
      } catch (error) {
        console.error('[TEST] Window creation error:', error);
      }
    };
    
    // Add test for detached window creation
    (window as any).testDetachedWindow = async (noteId?: string) => {
      try {
        const actualNoteId = noteId || selectedNoteId || notes[0]?.id;
        if (!actualNoteId) {
          console.error('[TEST] No note ID available for testing');
          return;
        }
        console.log('[TEST] Testing detached window creation for note:', actualNoteId);
        const result = await createWindow(actualNoteId);
        console.log('[TEST] Detached window creation result:', result);
      } catch (error) {
        console.error('[TEST] Detached window creation error:', error);
      }
    };
  }, [createNewNote, createWindow, selectedNoteId, notes]);
  
  // Expose createNewNote to window for debugging
  useEffect(() => {
    (window as any).debugCreateNewNote = () => {
      console.log('[NOTES-APP] [DEBUG] Manually triggering createNewNote from window');
      createNewNote();
    };
    
    (window as any).debugEmitEvent = async () => {
      console.log('[NOTES-APP] [DEBUG] Manually emitting menu-new-note event');
      try {
        const result = await invoke('test_emit_new_note');
        console.log('[NOTES-APP] [DEBUG] Emit result:', result);
      } catch (error) {
        console.error('[NOTES-APP] [DEBUG] Emit error:', error);
      }
    };
    
    return () => {
      delete (window as any).debugCreateNewNote;
      delete (window as any).debugEmitEvent;
    };
  }, []);
  
  useEffect(() => {
    console.log('[NOTES-APP] [FRONTEND] Setting up event listeners');
    console.log('[NOTES-APP] [FRONTEND] createNewNote function exists:', typeof createNewNote);
    console.log('[NOTES-APP] [FRONTEND] createNewNoteRef current:', createNewNoteRef.current);
    
    const setupListeners = async () => {
      const unlisteners: (() => void)[] = [];
      
      try {
        // Listen for new note event
        const unlistenNewNote = await listen('menu-new-note', async (event) => {
          console.log('[NOTES-APP] [FRONTEND] 🔥 Received menu-new-note event!', event);
          
          // Simple inline implementation to test
          try {
            console.log('[NOTES-APP] [FRONTEND] Creating note inline...');
            const newNote = await invoke<Note>('create_note', {
              request: {
                title: 'Untitled',
                content: '',
                tags: []
              }
            });
            console.log('[NOTES-APP] [FRONTEND] Note created inline:', newNote);
            
            // Update state directly in the handler
            setNotes(prev => {
              console.log('[NOTES-APP] [FRONTEND] Inline update - prev length:', prev.length);
              const updated = [newNote, ...prev];
              console.log('[NOTES-APP] [FRONTEND] Inline update - new length:', updated.length);
              // Force a re-render by creating a new array
              return [...updated];
            });
            setSelectedNoteId(newNote.id);
            setCurrentContent('');
            
            // Force update check
            setTimeout(() => {
              console.log('[NOTES-APP] [FRONTEND] Post-update check - current DOM state');
            }, 100);
          } catch (error) {
            console.error('[NOTES-APP] [FRONTEND] Inline create failed:', error);
          }
        });
        unlisteners.push(unlistenNewNote);
        
        // Listen for hover mode toggle event
        const unlistenHover = await listen('toggle-hover-mode', async (event) => {
          console.log('[NOTES-APP] [FRONTEND] 🔥 Received toggle-hover-mode event!', event);
          try {
            const hoverState = await invoke<boolean>('toggle_all_windows_hover');
            console.log('[NOTES-APP] [FRONTEND] Hover mode toggled. New state:', hoverState);
          } catch (error) {
            console.error('[NOTES-APP] [FRONTEND] Failed to toggle hover mode:', error);
          }
        });
        unlisteners.push(unlistenHover);
        
        console.log('[NOTES-APP] [FRONTEND] ✅ All listeners setup complete');
        
        return () => {
          unlisteners.forEach(fn => fn());
        };
      } catch (error) {
        console.error('[NOTES-APP] [FRONTEND] ❌ Failed to setup listeners:', error);
        return () => {};
      }
    };
    
    let cleanup: (() => void) | undefined;
    setupListeners().then(fn => {
      cleanup = fn;
    });

    return () => {
      console.log('[NOTES-APP] [FRONTEND] Cleaning up event listeners');
      if (cleanup) {
        cleanup();
      }
    };
  }, []); // Empty dependency array - set up only once

  const checkGlobalShortcutPermissions = async () => {
    // Check if user has already dismissed the prompt
    const dismissed = localStorage.getItem('shortcut-permission-dismissed');
    if (dismissed === 'true') return;
    
    // Show permission prompt after a short delay to let the app settle
    setTimeout(() => {
      setShowPermissionPrompt(true);
    }, 2000);
  };

  // Extract title from markdown content (first header)
  const extractTitleFromContent = (content: string): string => {
    if (!content.trim()) return 'Untitled';
    
    // Always use first non-empty line as title
    const firstLine = content.split('\n').find(line => line.trim());
    if (!firstLine) return 'Untitled';
    
    // Clean up the line and extract title
    let title = firstLine.trim();
    
    // Remove markdown formatting if present
    title = title.replace(/^#+\s*/, ''); // Remove markdown headers
    title = title.replace(/^\*\*(.+)\*\*$/, '$1'); // Remove bold
    title = title.replace(/^\*(.+)\*$/, '$1'); // Remove italic
    title = title.replace(/^[-*+]\s+/, ''); // Remove list markers
    
    // Limit length and ensure we have something
    return title.substring(0, 50).trim() || 'Untitled';
  };

  // Command palette logic
  interface Command {
    id: string;
    title: string;
    description: string;
    action: () => void;
    category: 'note' | 'action' | 'navigation';
  }

  const getCommands = (): Command[] => {
    const commands: Command[] = [
      {
        id: 'new-note',
        title: 'New Note',
        description: 'Create a new note',
        action: () => {
          setShowCommandPalette(false);
          createNewNote();
        },
        category: 'action'
      },
      {
        id: 'toggle-sidebar',
        title: 'Toggle Sidebar',
        description: 'Show or hide the sidebar',
        action: () => {
          setShowCommandPalette(false);
          setSidebarVisible(!sidebarVisible);
        },
        category: 'navigation'
      },
      {
        id: 'toggle-preview',
        title: 'Toggle Markdown Preview',
        description: isPreviewMode ? 'Switch to edit mode' : 'Show markdown preview',
        action: () => {
          setShowCommandPalette(false);
          setIsPreviewMode(!isPreviewMode);
        },
        category: 'action'
      },
      {
        id: 'open-settings',
        title: 'Open Settings',
        description: 'Configure app appearance and behavior',
        action: () => {
          setShowCommandPalette(false);
          setCurrentView('settings');
          setSidebarVisible(true);
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
    if (selectedNote && !isDetachedWindow) {
      commands.push({
        id: 'open-in-window',
        title: 'Open in New Window',
        description: `Open "${extractTitleFromContent(selectedNote.content)}" in a new window`,
        action: async () => {
          setShowCommandPalette(false);
          await createWindow(selectedNote.id);
        },
        category: 'action'
      });
    }

    // Continue with existing note commands
    const noteCommands: Command[] = [];
    notes.forEach(note => {
      noteCommands.push({
        id: `note-${note.id}`,
        title: extractTitleFromContent(note.content),
        description: note.content.substring(0, 60) || 'Empty note',
        action: () => {
          setShowCommandPalette(false);
          selectNote(note.id);
        },
        category: 'note'
      });
    });

    return [...commands, ...noteCommands];
  };

  const fuzzySearch = (query: string, items: Command[]): Command[] => {
    if (!query.trim()) return items;
    
    const lowerQuery = query.toLowerCase();
    return items
      .filter(item => 
        item.title.toLowerCase().includes(lowerQuery) ||
        item.description.toLowerCase().includes(lowerQuery)
      )
      .sort((a, b) => {
        // Prioritize title matches over description matches
        const aTitle = a.title.toLowerCase().indexOf(lowerQuery);
        const bTitle = b.title.toLowerCase().indexOf(lowerQuery);
        
        if (aTitle !== -1 && bTitle !== -1) return aTitle - bTitle;
        if (aTitle !== -1) return -1;
        if (bTitle !== -1) return 1;
        return 0;
      });
  };

  const getFilteredCommands = (): Command[] => {
    return fuzzySearch(commandQuery, getCommands());
  };

  const executeCommand = (command: Command | undefined) => {
    if (command) {
      command.action();
    }
  };

  // Handle keyboard shortcuts
  // Simplified drag handlers
  useEffect(() => {
    const handleGlobalMouseMove = async (e: MouseEvent) => {
      if (!dragState.noteId) return;
      
      const deltaX = Math.abs(e.clientX - dragState.startX);
      const deltaY = Math.abs(e.clientY - dragState.startY);
      const threshold = 15; // Clear threshold
      
      if (!dragState.isDragging && (deltaX > threshold || deltaY > threshold)) {
        // Start dragging
        setDragState(prev => ({ ...prev, isDragging: true }));
        document.body.classList.add('dragging');
        
        const note = notes.find(n => n.id === dragState.noteId);
        if (note) {
          const title = extractTitleFromContent(note.content);
          try {
            await invoke('create_drag_ghost', {
              noteTitle: title,
              x: e.screenX - 50,
              y: e.screenY - 20
            });
          } catch (error) {
            console.error('Failed to create drag ghost:', error);
          }
        }
      } else if (dragState.isDragging) {
        // Update ghost position while dragging
        try {
          await invoke('update_drag_ghost_position', {
            x: e.screenX - 50,
            y: e.screenY - 20
          });
        } catch (error) {
          // Silently ignore
        }
      }
    };

    const handleGlobalMouseUp = async (e: MouseEvent) => {
      if (!dragState.noteId) return;
      
      const wasDragging = dragState.isDragging;
      const noteId = dragState.noteId;
      
      // Clean up ghost window
      if (wasDragging) {
        try {
          await invoke('destroy_drag_ghost');
        } catch (error) {
          console.error('Failed to destroy drag ghost:', error);
        }
        
        // Check if we should create a window
        const sidebarEl = document.querySelector('.sidebar');
        const sidebarRect = sidebarEl?.getBoundingClientRect();
        const isOutsideSidebar = !sidebarRect || e.clientX > sidebarRect.right;
        
        if (isOutsideSidebar && !isWindowOpen(noteId)) {
          // Create window at mouse position
          await createWindow(noteId, e.screenX - 400, e.screenY - 300);
        }
      }
      
      // Reset drag state
      setDragState({
        isDragging: false,
        noteId: null,
        startX: 0,
        startY: 0,
        currentX: 0,
        currentY: 0,
        justCompleted: false,
      });
      
      document.body.classList.remove('dragging');
    };

    if (dragState.noteId) {
      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleGlobalMouseMove);
        document.removeEventListener('mouseup', handleGlobalMouseUp);
      };
    }
  }, [dragState.noteId, dragState.isDragging, dragState.startX, dragState.startY, createWindow, isWindowOpen, notes]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Command Palette - Cmd+K
      if (e.metaKey && e.key === 'k' && !e.shiftKey && !e.altKey && !e.ctrlKey) {
        e.preventDefault();
        setShowCommandPalette(true);
        setCommandQuery('');
        setSelectedCommandIndex(0);
        return;
      }

      // Escape to close command palette or exit focus mode or cancel drag
      if (e.key === 'Escape') {
        if (showCommandPalette) {
          e.preventDefault();
          setShowCommandPalette(false);
          setCommandQuery('');
          return;
        } else if (dragState.isDragging) {
          e.preventDefault();
          // Cancel drag operation
          setDragState({
            isDragging: false,
            noteId: null,
            startX: 0,
            startY: 0,
            currentX: 0,
            currentY: 0,
            justCompleted: false,
          });
          document.body.classList.remove('dragging');
          // Destroy any ghost window
          invoke('destroy_drag_ghost').catch(() => {});
          return;
        } else if (config.appearance?.focusMode) {
          e.preventDefault();
          const newConfig = {
            ...config,
            appearance: {
              ...config.appearance,
              focusMode: false
            }
          };
          updateConfig(newConfig);
          return;
        }
      }

      // Arrow navigation in command palette
      if (showCommandPalette) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedCommandIndex(prev => Math.min(prev + 1, getFilteredCommands().length - 1));
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedCommandIndex(prev => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter') {
          e.preventDefault();
          executeCommand(getFilteredCommands()[selectedCommandIndex]);
        }
        return;
      }

      // Cmd+N to create new note (standard shortcut)
      if (e.metaKey && e.key === 'n' && !e.shiftKey && !e.altKey && !e.ctrlKey) {
        e.preventDefault();
        console.log('[NOTES-APP] [FRONTEND] Cmd+N pressed');
        createNewNote();
        return;
      }

      // Cmd+Shift+N to create new note (alternative shortcut)
      if (e.metaKey && e.shiftKey && e.key.toLowerCase() === 'n' && !e.altKey && !e.ctrlKey) {
        e.preventDefault();
        console.log('[NOTES-APP] [FRONTEND] Cmd+Shift+N pressed');
        createNewNote();
        return;
      }

      // Note: Hyperkey + N (Cmd+Ctrl+Alt+Shift+N) is handled by the global shortcut in Rust

      // Cmd+Shift+P to toggle preview mode
      if (e.metaKey && e.shiftKey && e.key.toLowerCase() === 'p' && selectedNote) {
        e.preventDefault();
        setIsPreviewMode(!isPreviewMode);
      }

      // Cmd+Shift+O to open current note in new window
      if (e.metaKey && e.shiftKey && e.key.toLowerCase() === 'o' && selectedNote) {
        e.preventDefault();
        createWindow(selectedNote.id);
      }

      // Cmd+, to open settings (standard shortcut)
      if (e.metaKey && e.key === ',') {
        e.preventDefault();
        setCurrentView('settings');
        setSidebarVisible(true);
      }

      // Cmd+. to toggle focus mode
      if (e.metaKey && e.key === '.') {
        e.preventDefault();
        const newConfig = {
          ...config,
          appearance: {
            ...config.appearance,
            focusMode: !config.appearance?.focusMode
          }
        };
        updateConfig(newConfig);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showCommandPalette, selectedCommandIndex, commandQuery, config.appearance?.focusMode, updateConfig]);

  const loadNotes = async () => {
    console.log('[NOTES-APP] [FRONTEND] Loading notes...');
    try {
      const loadedNotes = await invoke<Note[]>('get_notes');
      console.log('[NOTES-APP] [FRONTEND] Loaded notes:', loadedNotes.length);
      console.log('[NOTES-APP] [FRONTEND] Notes data:', JSON.stringify(loadedNotes));
      
      setNotes(loadedNotes);
      
      // Verify the state was updated
      setTimeout(() => {
        console.log('[NOTES-APP] [FRONTEND] After setNotes - state check');
      }, 0);
      
      // Select first note if available
      if (loadedNotes.length > 0 && !selectedNoteId) {
        setSelectedNoteId(loadedNotes[0].id);
        setCurrentContent(loadedNotes[0].content);
      }
    } catch (error) {
      console.error('[NOTES-APP] [FRONTEND] Failed to load notes:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateNoteContent = async (content: string) => {
    setCurrentContent(content);
    if (selectedNoteId) {
      try {
        saveStatus.startSaving();
        
        const updatedNote = await invoke<Note>('update_note', {
          id: selectedNoteId,
          request: {
            content: content
          }
        });
        
        if (updatedNote) {
          setNotes(prev => prev.map(note => 
            note.id === selectedNoteId ? updatedNote : note
          ));
          saveStatus.saveSuccess();
          
          // Notify other windows of the update
          noteSyncService.noteUpdated(updatedNote);
        }
      } catch (error) {
        console.error('Failed to update note:', error);
        saveStatus.setSaveError('Failed to save note');
      }
    }
  };


  const selectNote = (noteId: string) => {
    const note = notes.find(n => n.id === noteId);
    if (note) {
      setSelectedNoteId(noteId);
      setCurrentContent(note.content);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, noteId: string) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      noteId,
    });
  };

  const handleCloseNoteWindow = async () => {
    if (contextMenu) {
      await closeWindow(contextMenu.noteId);
      setContextMenu(null);
    }
  };

  const handleOpenInWindow = async () => {
    if (contextMenu && !isWindowOpen(contextMenu.noteId)) {
      await createWindow(contextMenu.noteId);
      setContextMenu(null);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      const success = await invoke<boolean>('delete_note', { id: noteId });
      if (success) {
        setNotes(prev => prev.filter(note => note.id !== noteId));
        
        // If we deleted the currently selected note, clear selection
        if (selectedNoteId === noteId) {
          setSelectedNoteId(null);
          setCurrentContent('');
        }
        
        // Close any detached window for this note
        if (isWindowOpen(noteId)) {
          await closeWindow(noteId);
        }
      }
    } catch (error) {
      console.error('Failed to delete note:', error);
    }
  };

  // Close context menu when clicking elsewhere
  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [contextMenu]);

  // Drag-to-detach handlers
  const handleMouseDown = (e: React.MouseEvent, noteId: string) => {
    // Don't start drag on right click
    if (e.button !== 0) return;
    
    // Don't interfere with double-click
    if (e.detail === 2) return;
    
    // Prevent text selection during potential drag
    e.preventDefault();
    
    setDragState({
      isDragging: false,
      noteId,
      startX: e.clientX,
      startY: e.clientY,
      currentX: e.clientX,
      currentY: e.clientY,
      justCompleted: false,
    });
  };


  // If this is a detached window, render the detached note component
  if (isDetachedWindow && detachedNoteId) {
    return <DetachedNoteWindow noteId={detachedNoteId} />;
  }

  // If this is a drag ghost window, render the drag ghost component
  if (isDragGhost && dragGhostTitle) {
    return <DragGhost noteTitle={dragGhostTitle} distance={100} threshold={60} />;
  }

  return (
    <div 
      className={`w-screen h-screen text-foreground flex flex-col transition-all duration-300 overflow-hidden ${
        dragState.isDragging ? 'bg-blue-500/5' : 'bg-background/95'
      } ${config.appearance?.focusMode ? 'focus-mode' : ''}`}
      style={{ backgroundColor: 'rgba(18, 19, 23, 0.95)' }}
    >
      {/* Custom title bar overlay with native controls visible */}
      <div 
        className="h-8 flex items-center relative select-none"
        style={{ 
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          WebkitUserSelect: 'none',
          userSelect: 'none'
        }}
      >
        {/* Left space for native window controls on macOS */}
        <div className="w-20" />
        
        {/* Center draggable area */}
        <div 
          className="flex-1 h-full flex items-center justify-center cursor-move select-none"
          data-tauri-drag-region
          onMouseDown={async (e) => {
            // Middle click (button 1) to toggle shade
            if (e.button === 1) {
              e.preventDefault();
              try {
                const { DetachedWindowsAPI } = await import('./services/detached-windows-api');
                await DetachedWindowsAPI.toggleMainWindowShade();
              } catch (error) {
                console.error('Failed to toggle shade:', error);
              }
            }
          }}
        >
          <span className="text-[11px] text-soft/40 font-medium select-none pointer-events-none" title="Middle-click to shade">Notes App</span>
        </div>
        
        {/* Right side balance */}
        <div className="w-20 px-3 flex items-center justify-end">
          <span className="text-[11px] text-soft/40 font-medium select-none pointer-events-none">{notes.length} notes</span>
        </div>
      </div>

      {/* Drop zone indicator during drag */}
      {dragState.isDragging && (
        <div className="fixed bottom-4 right-4 pointer-events-none z-50 bg-blue-500/20 border border-blue-500/40 rounded-lg px-3 py-2">
          <div className="text-blue-400 text-xs font-medium">
            Drag outside sidebar to create window
          </div>
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 flex">
        {/* Left sidebar - navigation */}
        <div className="w-8 bg-background flex flex-col items-center justify-between border-r border-border/30">
          <div className="flex flex-col items-center">
            {/* Notes view icon */}
            <button 
              onClick={() => {
                if (currentView === 'notes' && sidebarVisible) {
                  // Toggle sidebar if we're already in notes view
                  setSidebarVisible(false);
                } else {
                  // Otherwise, show notes and sidebar
                  setCurrentView('notes');
                  setSidebarVisible(true);
                }
              }}
              className={`mt-3 w-5 h-5 flex items-center justify-center transition-colors rounded ${
                currentView === 'notes'
                  ? 'text-primary bg-primary/10' 
                  : 'text-primary/60 hover:text-primary hover:bg-primary/10'
              }`}
              title={sidebarVisible && currentView === 'notes' ? 'Hide sidebar' : 'Notes'}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14,2 14,8 20,8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <line x1="10" y1="9" x2="8" y2="9"/>
              </svg>
            </button>
          </div>
          
          <div className="flex flex-col items-center mb-3">
            {/* Settings */}
            <button
              onClick={() => {
                if (currentView === 'settings' && sidebarVisible) {
                  // Toggle settings panel if we're already in settings view
                  setSidebarVisible(false);
                } else {
                  // Otherwise, show settings
                  setCurrentView('settings');
                  setSidebarVisible(true);
                }
              }}
              className={`w-5 h-5 flex items-center justify-center transition-colors rounded ${
                currentView === 'settings'
                  ? 'text-primary bg-primary/10' 
                  : 'text-muted-foreground/60 hover:text-foreground hover:bg-white/10'
              }`}
              title={sidebarVisible && currentView === 'settings' ? 'Hide settings' : 'Settings (⌘,)'}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3"/>
                <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1"/>
              </svg>
            </button>
          </div>
        </div>

      {/* Expandable sidebar with animation */}
      <div className={`overflow-hidden transition-all duration-300 ease-out ${
        sidebarVisible && currentView === 'notes' ? 'w-64' : 'w-0'
      }`}>
        <ResizablePanel
          className="bg-card border-r border-border/30 flex flex-col sidebar"
          defaultWidth={256}
          minWidth={180}
          maxWidth={400}
        >
          <div className="p-4 flex flex-col h-full">
          {/* Clean header */}
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-foreground">Notes</h2>
              <button 
                onClick={createNewNote}
                className="w-6 h-6 flex items-center justify-center text-muted-foreground/60 hover:text-primary hover:bg-primary/10 transition-all duration-200 rounded"
                title="New note (⌘N)"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19"/>
                  <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
              </button>
            </div>
          </div>
          
          {/* Notes list */}
          <div className="space-y-0 flex-1 overflow-y-auto scrollbar-hide">
            {loading ? (
              <div className="text-xs text-soft/40 p-3">Loading...</div>
            ) : notes.length === 0 ? (
              <div className="text-xs text-soft/40 p-3">No notes yet</div>
            ) : (
              notes.map(note => (
                <div 
                  key={note.id}
                  onClick={() => {
                    // Only handle click if not dragging
                    if (!dragState.isDragging && dragState.noteId !== note.id) {
                      selectNote(note.id);
                    }
                  }}
                  onDoubleClick={async () => {
                    if (!isWindowOpen(note.id)) {
                      await createWindow(note.id);
                    }
                  }}
                  onContextMenu={(e) => handleContextMenu(e, note.id)}
                  onMouseDown={(e) => handleMouseDown(e, note.id)}
                  className={`group relative px-3 py-2.5 cursor-pointer transition-all duration-200 rounded-md select-none ${
                    selectedNoteId === note.id 
                      ? 'bg-primary/10 border border-primary/20' 
                      : 'hover:bg-white/5 border border-transparent'
                  } ${dragState.isDragging && dragState.noteId === note.id ? 'opacity-40 scale-95 bg-blue-500/20 border-blue-500/40 transition-all duration-200' : ''}`}
                >
                  <div className="flex items-center gap-2">
                    {/* Note title */}
                    <div className={`text-xs truncate flex-1 transition-all ${
                      selectedNoteId === note.id 
                        ? 'text-foreground font-medium' 
                        : 'text-muted-foreground/80 group-hover:text-foreground'
                    }`}>
                      {extractTitleFromContent(note.content)}
                    </div>
                    
                    {/* Status indicators */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {isWindowOpen(note.id) && (
                        <div className="w-1.5 h-1.5 bg-blue-500/70 rounded-full" title="Open in window"></div>
                      )}
                      
                      {/* Delete button - shows on hover */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteNote(note.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 w-4 h-4 flex items-center justify-center text-red-400/60 hover:text-red-400 transition-all duration-200 rounded hover:bg-red-500/10"
                        title="Delete note"
                      >
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3,6 5,6 21,6"/>
                          <path d="M19,6l-1,14a2,2,0,0,1-2,2H8a2,2,0,0,1-2-2L5,6"/>
                          <path d="M10,11v6"/>
                          <path d="M14,11v6"/>
                        </svg>
                      </button>
                      
                      <div className={`text-xs transition-opacity ${
                        selectedNoteId === note.id 
                          ? 'text-primary/50' 
                          : 'text-muted-foreground/40 group-hover:text-muted-foreground/60'
                      }`}>
                        {note.updatedAt ? new Date(note.updatedAt).toLocaleDateString('en-US', { 
                          month: 'numeric', 
                          day: 'numeric' 
                        }) : ''}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </ResizablePanel>
      </div>
      
      {/* Main content area - Notes or Settings */}
        {currentView === 'notes' ? (
          <div className="flex-1 flex flex-col">
            {/* Header with hacker-style minimal controls */}
            {selectedNote && (
              <div className="px-6 py-2 border-b border-border/15 flex items-center justify-between bg-card/20">
                <div></div> {/* Left spacer */}
                <div 
                  className="text-xs text-muted-foreground/50 font-mono tracking-wide truncate cursor-move hover:text-muted-foreground/70 transition-colors"
                  onMouseDown={(e) => handleMouseDown(e, selectedNote.id)}
                  title="Drag to open in new window"
                  style={{ fontSize: '11px' }}
                >
                  {extractTitleFromContent(selectedNote.content)}
                </div>
                
                {/* Edit/Preview toggle */}
                <div className="flex items-center bg-background/40 border border-border/30 rounded-md">
                  <button
                    onClick={() => setIsPreviewMode(false)}
                    className={`w-6 h-5 flex items-center justify-center rounded-sm transition-all duration-200 ${
                      !isPreviewMode 
                        ? 'bg-primary/25 text-primary shadow-sm' 
                        : 'text-muted-foreground/60 hover:text-foreground hover:bg-white/5'
                    }`}
                    title="Edit mode (⌘⇧P)"
                  >
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </button>
                  <button
                    onClick={() => setIsPreviewMode(true)}
                    className={`w-6 h-5 flex items-center justify-center rounded-sm transition-all duration-200 ${
                      isPreviewMode 
                        ? 'bg-primary/25 text-primary shadow-sm' 
                        : 'text-muted-foreground/60 hover:text-foreground hover:bg-white/5'
                    }`}
                    title="Preview mode (⌘⇧P)"
                  >
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  </button>
                </div>
              </div>
            )}
            
            {/* Editor/Preview area */}
            <div className="flex-1 flex flex-col">
              <div className={`flex-1 p-6 pt-6 relative ${
                config.appearance?.backgroundPattern && config.appearance?.backgroundPattern !== 'none' 
                  ? `bg-pattern-${config.appearance?.backgroundPattern}` 
                  : ''
              }`}>
                {/* Always-available textarea */}
                <textarea 
                  ref={textareaRef}
                  className={`w-full h-full bg-transparent text-foreground resize-none outline-none placeholder-muted-foreground/40 transition-opacity ${
                    isPreviewMode ? 'absolute inset-0 z-10 opacity-0 pointer-events-none' : 'opacity-100'
                  } ${config.appearance?.typewriterMode ? 'typewriter-mode' : ''}`}
                  style={{ 
                    fontSize: `${config.appearance?.fontSize || 15}px`, 
                    fontFamily: config.appearance?.editorFontFamily || 'system-ui',
                    lineHeight: config.appearance?.lineHeight || 1.6,
                    padding: '1rem 0' 
                  }}
                  placeholder={selectedNote ? "Start writing..." : "Create a new note to start writing..."}
                  value={currentContent}
                  onChange={(e) => updateNoteContent(e.target.value)}
                  disabled={!selectedNote}
                  autoFocus={!isPreviewMode}
                />
                
                {/* Preview overlay */}
                {isPreviewMode && selectedNote && (
                  <div 
                    className="w-full h-full overflow-y-auto prose prose-invert prose-sm max-w-none cursor-text"
                    onDoubleClick={() => setIsPreviewMode(false)}
                    title="Double-click to edit"
                    style={{ 
                      fontSize: `${config.appearance?.contentFontSize || config.appearance?.fontSize || 16}px`,
                      fontFamily: config.appearance?.previewFontFamily || 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
                      lineHeight: config.appearance?.lineHeight || 1.6,
                      padding: '1rem 0' 
                    }}
                  >
                    <ReactMarkdown 
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={config.appearance?.syntaxHighlighting ? [rehypeHighlight] : []}
                    >
                      {currentContent || '*Empty note*'}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
              
              {/* Note-specific footer */}
              {selectedNote && (
                <div className="bg-card/20 border-t border-border/15 px-6 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      {saveStatus.isSaving ? (
                        <>
                          <span className="text-xs text-muted-foreground/50" style={{ fontSize: '10px' }}>Saving...</span>
                          <div className="w-1 h-1 bg-yellow-500/60 rounded-full animate-pulse"></div>
                        </>
                      ) : saveStatus.saveError ? (
                        <>
                          <span className="text-xs text-muted-foreground/50" style={{ fontSize: '10px' }}>Error saving</span>
                          <div className="w-1 h-1 bg-red-500/60 rounded-full"></div>
                        </>
                      ) : saveStatus.lastSaved ? (
                        <>
                          <span className="text-xs text-muted-foreground/50" style={{ fontSize: '10px' }}>Saved {saveStatus.getRelativeTime}</span>
                          <div className="w-1 h-1 bg-green-500/60 rounded-full"></div>
                        </>
                      ) : (
                        <>
                          <span className="text-xs text-muted-foreground/50" style={{ fontSize: '10px' }}>Ready</span>
                          <div className="w-1 h-1 bg-gray-500/60 rounded-full"></div>
                        </>
                      )}
                    </div>
                    
                  </div>
                  
                  {currentContent && (
                    <span className="text-xs text-muted-foreground/40 font-light" style={{ fontSize: '10px' }}>
                      {currentContent.split(/\s+/).filter(word => word.length > 0).length} words
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className={`transition-all duration-200 ease-out overflow-hidden flex ${
            sidebarVisible ? 'flex-1' : 'w-0'
          }`}>
            <SettingsPanel />
          </div>
        )}
      </div>

      {/* Global IDE-style footer */}
      <div className="h-5 bg-card/40 border-t border-border/25 px-3 flex items-center justify-between text-muted-foreground/60 font-light" style={{ fontSize: '10px' }}>
        <div className="flex items-center gap-4">
          <span>Notes App</span>
          <div className="w-px h-3 bg-border/30"></div>
          <span>{notes.length} {notes.length === 1 ? 'note' : 'notes'}</span>
        </div>
        <div className="flex items-center gap-2">
          <span>Ready</span>
          <div className="w-1 h-1 bg-green-500/60 rounded-full"></div>
        </div>
      </div>

      {/* Command Palette */}
      {showCommandPalette && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-start justify-center pt-20 z-50">
          <div className="glass-panel w-full max-w-lg mx-4">
            {/* Search input */}
            <div className="p-3 border-b border-border/20">
              <input
                type="text"
                placeholder="Search commands and notes..."
                value={commandQuery}
                onChange={(e) => {
                  setCommandQuery(e.target.value);
                  setSelectedCommandIndex(0);
                }}
                className="w-full bg-transparent text-foreground text-sm outline-none placeholder-muted-foreground/60"
                autoFocus
              />
            </div>
            
            {/* Results */}
            <div className="max-h-80 overflow-y-auto">
              {getFilteredCommands().length === 0 ? (
                <div className="p-4 text-center text-soft/50 text-xs">
                  No commands found
                </div>
              ) : (
                getFilteredCommands().map((command, index) => (
                  <div
                    key={command.id}
                    className={`p-3 cursor-pointer transition-colors border-b border-border/10 last:border-0 ${
                      index === selectedCommandIndex
                        ? 'bg-primary/20 border-primary/30'
                        : 'hover:bg-white/5'
                    }`}
                    onClick={() => executeCommand(command)}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${
                        command.category === 'note' ? 'bg-primary/60' :
                        command.category === 'action' ? 'bg-green-500/60' :
                        'bg-blue-500/60'
                      }`}></div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-foreground truncate">
                          {command.title}
                        </div>
                        <div className="text-xs text-soft/60 truncate">
                          {command.description}
                        </div>
                      </div>
                      <div className="text-xs text-soft/40 capitalize">
                        {command.category}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            
            {/* Footer */}
            <div className="p-2 border-t border-border/20 flex items-center justify-between text-xs text-soft/40">
              <div className="flex items-center gap-4">
                <span>↑↓ Navigate</span>
                <span>⏎ Select</span>
                <span>⎋ Close</span>
              </div>
              <span>{getFilteredCommands().length} results</span>
            </div>
          </div>
        </div>
      )}

      {/* Permission prompt overlay */}
      {showPermissionPrompt && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-40">
          <div className="glass-panel p-6 max-w-md mx-4">
            <div className="text-center">
              <div className="w-3 h-3 bg-primary/60 rounded-full mx-auto mb-3"></div>
              <h3 className="text-sm font-medium mb-2">Enable Global Shortcuts</h3>
              <p className="text-xs text-soft/70 mb-4 leading-relaxed">
                To use Hyperkey+N (⌘⌃⌥⇧N) globally, grant Tauri Notes accessibility permissions:
              </p>
              <div className="text-xs text-soft/60 mb-4 text-left bg-background/30 p-3 rounded border border-border/20">
                <div className="font-medium mb-1">Steps:</div>
                <div>1. Open System Settings</div>
                <div>2. Go to Privacy & Security → Accessibility</div>
                <div>3. Add your Terminal or Tauri Notes App</div>
                <div>4. Restart this app</div>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => {
                    localStorage.setItem('shortcut-permission-dismissed', 'true');
                    setShowPermissionPrompt(false);
                  }}
                  className="flex-1 glass-subtle p-2 text-xs hover:bg-white/10 transition-colors"
                >
                  Skip for now
                </button>
                <button 
                  onClick={() => {
                    localStorage.setItem('shortcut-permission-dismissed', 'true');
                    setShowPermissionPrompt(false);
                    // Open System Settings (macOS command)
                    invoke('open_system_settings').catch(() => {
                      // Fallback - just close the prompt
                    });
                  }}
                  className="flex-1 glass-panel p-2 text-xs hover:bg-white/15 transition-colors"
                >
                  Open Settings
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Context Menu for Detached Notes */}
      {contextMenu && (
        <div 
          className="fixed z-50 bg-card border border-border/40 rounded-lg shadow-lg py-1 min-w-[140px]"
          style={{ 
            left: contextMenu.x, 
            top: contextMenu.y,
            transform: 'translate(-50%, -10px)'
          }}
        >
          {!isWindowOpen(contextMenu.noteId) ? (
            <button
              onClick={handleOpenInWindow}
              className="w-full px-3 py-2 text-xs text-left hover:bg-background/60 transition-colors flex items-center gap-2"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 9V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v2"/>
                <path d="M21 15v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2"/>
                <path d="M9 9h1m4 0h1"/>
              </svg>
              Open in New Window
            </button>
          ) : (
            <button
              onClick={handleCloseNoteWindow}
              className="w-full px-3 py-2 text-xs text-left hover:bg-background/60 transition-colors flex items-center gap-2"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
              Close Window
            </button>
          )}
          
          <div className="border-t border-border/20 my-1"></div>
          
          <button
            onClick={() => {
              if (contextMenu) {
                handleDeleteNote(contextMenu.noteId);
                setContextMenu(null);
              }
            }}
            className="w-full px-3 py-2 text-xs text-left hover:bg-red-500/10 text-red-400/80 hover:text-red-400 transition-colors flex items-center gap-2"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3,6 5,6 21,6"/>
              <path d="M19,6l-1,14a2,2,0,0,1-2,2H8a2,2,0,0,1-2-2L5,6"/>
              <path d="M10,11v6"/>
              <path d="M14,11v6"/>
            </svg>
            Delete Note
          </button>
        </div>
      )}


    </div>
  );
}

export default App;