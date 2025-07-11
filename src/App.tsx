import { listen } from '@tauri-apps/api/event';
import { useState, useEffect, useRef } from 'react';
import { 
  DetachedNoteWindow, 
  DragGhost 
} from './components/windows';
import { 
  SettingsPanel, 
  SettingsNavigation 
} from './components/settings';
import { DevToolbar } from './components/dev/DevToolbar';
import { 
  CustomTitleBar, 
  WindowWrapper, 
  NavigationSidebar, 
  AppFooter 
} from './components/layout';
import { 
  NotesPanel, 
  EditorArea 
} from './components/notes';
import { 
  ChordHint 
} from './components/common';
import { 
  useDetachedWindowsStore, 
  useConfigStore 
} from './stores';
import { 
  useSaveStatus,
  useWindowTransparency,
  useTypewriterMode,
  useDragToDetach,
  useWindowShade,
  useNoteManagement,
  useCommandPalette,
  useKeyboardShortcuts,
  useContextMenu,
  useChordShortcuts
} from './hooks';
import { applyTheme, getThemeById } from './types';
import { getWordCount } from './lib/utils';


function App() {
  const { config, updateConfig, loadConfig, isLoading } = useConfigStore();
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [isPreviewMode, setIsPreviewMode] = useState(false); // Start in edit mode
  const [currentView, setCurrentView] = useState<'notes' | 'settings'>('notes');
  const [selectedSettingsSection, setSelectedSettingsSection] = useState<'general' | 'appearance' | 'shortcuts' | 'editor' | 'advanced'>('appearance');

  // Window detection states
  const [isDetachedWindow, setIsDetachedWindow] = useState(false);
  const [detachedNoteId, setDetachedNoteId] = useState<string | null>(null);
  const [isDragGhost, setIsDragGhost] = useState(false);
  const [dragGhostTitle, setDragGhostTitle] = useState<string>('');

  // Detached windows store
  const { 
    createWindow, 
    isWindowOpen, 
    loadWindows,
    refreshWindows,
    focusWindow 
  } = useDetachedWindowsStore();

  // Drag-to-detach functionality
  const { startDrag, isDragging } = useDragToDetach({
    onDrop: async (noteId: string, x: number, y: number) => {
      if (!isWindowOpen(noteId)) {
        try {
          await createWindow(noteId, x, y);
        } catch (error) {
          console.error('Window creation error:', error);
        }
      }
    }
  });

  // Save status tracking
  const saveStatus = useSaveStatus();
  
  // Window transparency hook - handles opacity changes
  useWindowTransparency();
  
  // Typewriter mode hook
  const textareaRef = useTypewriterMode();
  
  // Window shade hook - tracks if window is shaded
  const isShaded = useWindowShade();

  // Note management hook
  const {
    notes,
    selectedNoteId,
    currentContent,
    loading,
    selectedNote,
    createNewNote,
    selectNote,
    updateNoteContent,
    deleteNote,
    setCurrentContent,
  } = useNoteManagement();

  // Keep a stable reference to current notes for event listeners
  const notesRef = useRef(notes);
  notesRef.current = notes;

  // Permissions resolved - no longer needed

  // Command palette hook
  const {
    showCommandPalette,
    openCommandPalette,
  } = useCommandPalette({
    notes,
    selectedNoteId,
    isPreviewMode,
    sidebarVisible,
    onCreateNewNote: createNewNote,
    onSelectNote: selectNote,
    onToggleSidebar: () => setSidebarVisible(!sidebarVisible),
    onTogglePreview: () => setIsPreviewMode(!isPreviewMode),
    onOpenSettings: () => {
      setCurrentView('settings');
      setSidebarVisible(true);
    },
  });

  // Context menu hook
  const {
    showContextMenu,
  } = useContextMenu({
    onDeleteNote: deleteNote,
    onDetachNote: async (noteId: string) => {
      try {
        await createWindow(noteId, window.screen.width / 2, window.screen.height / 2);
      } catch (error) {
        console.error('Failed to detach note:', error);
      }
    },
  });

  // Keyboard shortcuts hook
  useKeyboardShortcuts({
    onNewNote: createNewNote,
    onToggleCommandPalette: openCommandPalette,
    onTogglePreview: () => setIsPreviewMode(!isPreviewMode),
    onOpenSettings: () => {
      setCurrentView('settings');
      setSidebarVisible(true);
    },
    onToggleFocus: () => {
      const newConfig = {
        ...config,
        appearance: {
          ...config?.appearance,
          focusMode: !config?.appearance?.focusMode
        }
      };
      updateConfig(newConfig);
    },
    isCommandPaletteOpen: showCommandPalette,
    notes: notes,
    onSelectNote: selectNote,
  });

  // Chord shortcuts hook for advanced keyboard combinations
  const { chordMode, showChordHint, startWindowMode } = useChordShortcuts({
    notes: notes.map(note => ({ id: note.id, title: note.title })),
    onSelectNote: selectNote,
    onCreateNewNote: createNewNote,
    onToggleCommandPalette: openCommandPalette,
    onCreateDetachedWindow: async (noteId: string) => {
      try {
        await createWindow(noteId, window.screen.width / 2, window.screen.height / 2);
      } catch (error) {
        console.error('Failed to create detached window via chord:', error);
      }
    },
    onFocusWindow: async (noteId: string) => {
      console.log('[CHORD] onFocusWindow called with noteId:', noteId);
      try {
        console.log('[CHORD] Checking if window exists for note:', noteId);
        // First refresh windows to get latest state
        await refreshWindows();
        
        // Check if window already exists in our state
        if (isWindowOpen(noteId)) {
          console.log('[CHORD] ✅ Window exists in state, attempting to focus');
          const focused = await focusWindow(noteId);
          console.log('[CHORD] Focus result:', focused);
          if (focused) {
            console.log('[CHORD] ✅ Successfully focused existing window');
            return;
          } else {
            console.log('[CHORD] ❌ Focus failed but window exists - refreshing and trying again');
            await refreshWindows();
            const focused2 = await focusWindow(noteId);
            console.log('[CHORD] Second focus attempt result:', focused2);
            return; // Don't create a new one if it exists
          }
        } else {
          // No existing window, create a new one
          console.log('[CHORD] ❌ No existing window found, creating new one for note:', noteId);
          const result = await createWindow(noteId, window.screen.width / 2, window.screen.height / 2);
          console.log('[CHORD] Create window result:', result);
        }
      } catch (error) {
        console.error('[CHORD] ❌ Error in onFocusWindow:', error);
      }
    },
  });
  
  // Debug logging
  // console.log('Config loaded:', config);
  // console.log('Focus mode:', config.appearance?.focusMode);
  // console.log('Current notes count:', notes.length);
  // console.log('Selected note ID:', selectedNoteId);

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

  // Apply theme on startup and when config changes
  useEffect(() => {
    const themeId = config?.appearance?.themeId || 'midnight-ink';
    const theme = getThemeById(themeId);
    
    if (theme) {
      applyTheme(theme);
    } else {
      console.error('[BLINK] Theme not found:', themeId);
    }
  }, [config]);

  // Note: Default theme application moved to config effect to avoid race conditions

  // Load config and windows on startup
  useEffect(() => {
    console.log('[BLINK] [FRONTEND] App initialization starting...');
    console.log('[BLINK] [FRONTEND] Tauri detection:', {
      windowExists: typeof window !== 'undefined',
      tauriExists: typeof window !== 'undefined' && !!window.__TAURI__,
      tauriValue: typeof window !== 'undefined' ? window.__TAURI__ : 'window undefined',
      href: window.location.href,
      userAgent: navigator.userAgent.includes('Tauri')
    });
    
    const initializeApp = async () => {
      await loadConfig();
      await loadWindows();
      console.log('[BLINK] [FRONTEND] ✅ App initialization complete');
      
      // DEBUG: Add a global function to test restore
      (window as any).testRestoreWindows = async () => {
        try {
          console.log('Calling restore_detached_windows...');
          const { invoke } = await import('@tauri-apps/api/core');
          const restored = await invoke<string[]>('restore_detached_windows');
          console.log('Restored windows:', restored);
        } catch (error) {
          console.error('Failed to restore windows:', error);
        }
      };
    };
    
    initializeApp();
  }, [isDetachedWindow, loadWindows]);

  // Set up event listeners for Tauri events
  useEffect(() => {
    const setupListeners = async () => {
      // Try to set up listeners regardless of __TAURI__ detection
      console.log('[BLINK] [FRONTEND] Attempting to set up Tauri event listeners...');
      
      console.log('[BLINK] [FRONTEND] Setting up Tauri event listeners...');
      const unlisteners: (() => void)[] = [];
      
      try {
        // Listen for new note event and delegate to our hook
        const unlistenNewNote = await listen('menu-new-note', async (event) => {
          console.log('[BLINK] [FRONTEND] 🔥 Received menu-new-note event!', event);
          createNewNote();
        });
        unlisteners.push(unlistenNewNote);
        
        // Listen for chord window mode event from global shortcut
        console.log('[BLINK] [FRONTEND] Setting up chord-window-mode listener...');
        const unlistenChordWindow = await listen('chord-window-mode', async (event) => {
          console.log('[BLINK] [FRONTEND] 🔥🔥🔥 RECEIVED CHORD-WINDOW-MODE EVENT! 🔥🔥🔥', event);
          console.log('[CHORD] Starting window mode from global shortcut');
          startWindowMode();
        });
        unlisteners.push(unlistenChordWindow);
        console.log('[BLINK] [FRONTEND] ✅ chord-window-mode listener set up successfully');
        
        // Listen for direct note deployment events from Hyper+1-9
        console.log('[BLINK] [FRONTEND] Setting up deploy-note-window listener...');
        const unlistenDeployWindow = await listen('deploy-note-window', async (event) => {
          const noteIndex = event.payload as number;
          console.log('[BLINK] [FRONTEND] 🚀🚀🚀 DEPLOY NOTE WINDOW EVENT RECEIVED! 🚀🚀🚀');
          console.log('[BLINK] [FRONTEND] Event details:', { event, noteIndex, payload: event.payload });
          
          // Calculate grid position for this note slot (1-9)
          const getGridPosition = (slotNumber: number) => {
            const screenWidth = window.screen.width;
            const screenHeight = window.screen.height;
            const windowWidth = 600;
            const windowHeight = 400;
            
            // Create 3x3 grid with some padding from edges
            const cols = 3;
            const rows = 3;
            const padding = 100;
            const usableWidth = screenWidth - 2 * padding - windowWidth;
            const usableHeight = screenHeight - 2 * padding - windowHeight;
            
            const col = (slotNumber - 1) % cols;
            const row = Math.floor((slotNumber - 1) / cols);
            
            const x = padding + (col * usableWidth / (cols - 1));
            const y = padding + (row * usableHeight / (rows - 1));
            
            return { x: Math.round(x), y: Math.round(y), width: windowWidth, height: windowHeight };
          };
          
          // Retry mechanism for when notes haven't loaded yet
          const attemptDeploy = async (retries = 3) => {
            const currentNotes = notesRef.current;
            const windowsStore = useDetachedWindowsStore.getState();
            
            console.log('[DEPLOY] === DEPLOYMENT STATE DEBUG ===');
            console.log('[DEPLOY] Checking notes - index:', noteIndex, 'available:', currentNotes.length);
            console.log('[DEPLOY] Available notes:', currentNotes.map(n => ({ id: n.id, title: n.title })));
            console.log('[DEPLOY] Current windows in frontend state:', Array.isArray(windowsStore.windows) ? windowsStore.windows.map(w => ({ 
              note_id: w.note_id, 
              window_label: w.window_label,
              position: w.position 
            })) : windowsStore.windows);
            
            if (currentNotes[noteIndex]) {
              const targetNote = currentNotes[noteIndex];
              const slotNumber = noteIndex + 1; // Convert 0-based to 1-based
              const gridPos = getGridPosition(slotNumber);
              
              console.log('[DEPLOY] Target note:', { id: targetNote.id, title: targetNote.title });
              console.log('[DEPLOY] Grid position for slot', slotNumber, ':', gridPos);
              
              try {
                // First refresh windows to get latest state from backend
                console.log('[DEPLOY] Refreshing windows state...');
                await refreshWindows();
                
                // Log state after refresh
                const refreshedWindowsStore = useDetachedWindowsStore.getState();
                console.log('[DEPLOY] Windows after refresh:', Array.isArray(refreshedWindowsStore.windows) ? refreshedWindowsStore.windows.map(w => ({ 
                  note_id: w.note_id, 
                  window_label: w.window_label,
                  position: w.position 
                })) : refreshedWindowsStore.windows);
                
                // Simple algorithm: Try to focus detached window, if that fails create new one
                const windowExists = isWindowOpen(targetNote.id);
                console.log('[DEPLOY] Window exists in state:', windowExists);
                
                if (windowExists) {
                  console.log('[DEPLOY] Attempting to focus existing detached window...');
                  const focused = await focusWindow(targetNote.id);
                  console.log('[DEPLOY] Focus result:', focused);
                  
                  if (focused) {
                    console.log('[DEPLOY] ✅ Successfully focused existing window');
                  } else {
                    console.log('[DEPLOY] ❌ Focus failed - window may not actually exist, creating new one');
                    const result = await createWindow(targetNote.id, gridPos.x, gridPos.y, gridPos.width, gridPos.height);
                    console.log('[DEPLOY] Created new window:', result ? '✅ Success' : '❌ Failed');
                  }
                } else {
                  console.log('[DEPLOY] No detached window found, creating new one at grid position', slotNumber);
                  const result = await createWindow(targetNote.id, gridPos.x, gridPos.y, gridPos.width, gridPos.height);
                  console.log('[DEPLOY] Created new window:', result ? '✅ Success' : '❌ Failed');
                }
              } catch (error) {
                console.error('[DEPLOY] ❌ Error deploying window:', error);
              }
            } else if (retries > 0) {
              console.log('[DEPLOY] ⏳ Notes not loaded yet, retrying in 200ms... (retries left:', retries, ')');
              setTimeout(() => attemptDeploy(retries - 1), 200);
            } else {
              console.log('[DEPLOY] ❌ No note at index:', noteIndex, 'available notes:', currentNotes.length, 'after all retries');
            }
          };
          
          await attemptDeploy();
        });
        unlisteners.push(unlistenDeployWindow);
        console.log('[BLINK] [FRONTEND] ✅ deploy-note-window listener set up successfully');
        
        // Listen for window closed events
        const unlistenWindowClosed = await listen('window-closed', async (event) => {
          console.log('[BLINK] Window closed event received for note:', event.payload);
          const noteId = event.payload as string;
          
          // Single refresh only
          await useDetachedWindowsStore.getState().refreshWindows();
        });
        unlisteners.push(unlistenWindowClosed);
        
        // Listen for window created events (from drag finalization)
        const unlistenWindowCreated = await listen('window-created', async (event) => {
          console.log('[BLINK] Window created event received for note:', event.payload);
          
          // Single refresh only
          await useDetachedWindowsStore.getState().refreshWindows();
        });
        unlisteners.push(unlistenWindowCreated);
        
        // Listen for window destroyed events (from OS/user closing window)
        const unlistenWindowDestroyed = await listen('window-destroyed', async (event) => {
          console.log('[BLINK] Window destroyed event received for note:', event.payload);
          const noteId = event.payload as string;
          
          // Clean up backend state
          try {
            await invoke('cleanup_destroyed_window', { noteId });
            console.log('[BLINK] Backend state cleaned up for destroyed window');
          } catch (error) {
            console.error('[BLINK] Failed to cleanup backend state:', error);
          }
          
          // Single refresh only
          await useDetachedWindowsStore.getState().refreshWindows();
            console.log('[BLINK] Windows after destroy cleanup:', Array.isArray(windowsStore.windows) ? windowsStore.windows.map(w => w.note_id) : 'no windows');
          }, 500);
        });
        unlisteners.push(unlistenWindowDestroyed);
        
        // Listen for hybrid window destroyed events
        const unlistenHybridDestroyed = await listen('hybrid-window-destroyed', async (event) => {
          console.log('[BLINK] Hybrid window destroyed event received:', event.payload);
          
          // Single refresh only
          await useDetachedWindowsStore.getState().refreshWindows();
        });
        unlisteners.push(unlistenHybridDestroyed);
        
        console.log('[BLINK] [FRONTEND] ✅ All listeners setup complete');
        
        return () => {
          unlisteners.forEach(fn => {
            try {
              fn();
            } catch (error) {
              console.warn('[BLINK] Failed to unlisten event:', error);
            }
          });
        };
      } catch (error) {
        console.error('[BLINK] [FRONTEND] ❌ Failed to setup listeners:', error);
        return () => {};
      }
    };
    
    let cleanup: (() => void) | undefined;
    setupListeners().then(fn => {
      cleanup = fn;
    });

    return () => {
      if (cleanup) {
        cleanup();
      }
    };
  }, [createNewNote]); // Remove refreshWindows to prevent re-registration


  // Animation handlers
  const handleNotesClick = () => {
    if (currentView === 'notes') {
      setSidebarVisible(!sidebarVisible);
    } else {
      setCurrentView('notes');
      setSidebarVisible(true);
    }
  };
  const handleSettingsClick = () => {
    if (currentView === 'settings') {
      setSidebarVisible(!sidebarVisible);
    } else {
      setCurrentView('settings');
      setSidebarVisible(true);
    }
  };

  // If this is a detached window, render the detached note component
  if (isDetachedWindow && detachedNoteId) {
    return <DetachedNoteWindow noteId={detachedNoteId} />;
  }

  // If this is a drag ghost window, render the drag ghost component
  if (isDragGhost && dragGhostTitle) {
    return <DragGhost noteTitle={dragGhostTitle} distance={100} threshold={60} />;
  }

  // Calculate word count for current content
  const wordCount = getWordCount(currentContent);
  
  // Show loading screen while config is loading
  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <div className="text-foreground">Loading...</div>
      </div>
    );
  }

  const themeId = config?.appearance?.themeId || 'midnight-ink';
  const theme = getThemeById(themeId);
  
  return (
    <WindowWrapper
      className={`main-window transition-all duration-300 ${
        isDragging ? 'bg-blue-500/5' : ''
      } ${config?.appearance?.focusMode ? 'focus-mode' : ''}`}
      style={
        config?.appearance?.appFontFamily
          ? ({ ['--font-ui']: config.appearance.appFontFamily } as any)
          : undefined
      }
    >
      <div className="h-full grid grid-rows-[auto_1fr_auto]">
        <CustomTitleBar 
          title="Blink"
          isMainWindow={true}
          isShaded={isShaded}
          stats={{
            wordCount: selectedNote ? wordCount : undefined,
            lastSaved: selectedNote?.updated_at ? new Date(selectedNote.updated_at).toLocaleString() : undefined
          }}
        />
        
        <div className="flex min-h-0 overflow-hidden">
          <NavigationSidebar
            currentView={currentView}
            sidebarVisible={sidebarVisible}
            onNotesClick={handleNotesClick}
            onSettingsClick={handleSettingsClick}
          />
        {/* Main content area (notes or settings) */}
        <div className="flex-1 flex flex-col bg-background min-h-0 overflow-hidden">
          {currentView === 'notes' ? (
            <div className="flex-1 flex min-h-0 overflow-hidden">
              <NotesPanel
                sidebarVisible={sidebarVisible}
                notes={notes}
                selectedNoteId={selectedNoteId}
                loading={loading}
                showNotePreviews={config?.appearance?.showNotePreviews}
                onCreateNewNote={createNewNote}
                onSelectNote={selectNote}
                onDeleteNote={deleteNote}
                onShowContextMenu={showContextMenu}
                onStartDrag={startDrag}
                isWindowOpen={isWindowOpen}
              />

              <EditorArea
                selectedNote={selectedNote || null}
                currentContent={currentContent}
                isPreviewMode={isPreviewMode}
                saveStatus={saveStatus}
                wordCount={wordCount}
                textareaRef={textareaRef}
                editorConfig={{
                  fontSize: config?.appearance?.fontSize,
                  editorFontFamily: config?.appearance?.editorFontFamily,
                  contentFontSize: config?.appearance?.contentFontSize,
                  previewFontFamily: config?.appearance?.previewFontFamily,
                  lineHeight: config?.appearance?.lineHeight,
                  syntaxHighlighting: config?.appearance?.syntaxHighlighting,
                  notePaperStyle: config?.appearance?.notePaperStyle
                }}
                onContentChange={(content) => {
                  setCurrentContent(content);
                  updateNoteContent(content);
                }}
                onPreviewToggle={() => setIsPreviewMode(!isPreviewMode)}
              />
            </div>
          ) : (
            /* Settings view */
            <div className="flex-1 flex min-h-0 overflow-hidden">
              <SettingsNavigation
                sidebarVisible={sidebarVisible}
                selectedSection={selectedSettingsSection}
                onSectionChange={setSelectedSettingsSection}
              />
              
              {/* Settings content area */}
              <div className="flex-1 flex flex-col bg-background min-h-0 overflow-hidden">
                <SettingsPanel selectedSection={selectedSettingsSection} />
              </div>
            </div>
          )}
        </div>
        </div>
        
        <AppFooter 
          theme={theme || null} 
          themeId={themeId} 
          config={config} 
        />
      </div>

      {/* Chord shortcuts hint overlay */}
      <ChordHint 
        mode={chordMode}
        visible={showChordHint}
        notes={notes.map(note => ({ id: note.id, title: note.title }))}
      />
      
      {/* Dev toolbar - only show in development */}
      {process.env.NODE_ENV === 'development' && !isDetachedWindow && <DevToolbar />}
    </WindowWrapper>
  );
}

export default App;