import { listen } from '@tauri-apps/api/event';
import { useState, useEffect } from 'react';
import { 
  DetachedNoteWindow, 
  DragGhost 
} from './components/windows';
import { 
  SettingsPanel, 
  SettingsNavigation 
} from './components/settings';
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
  useContextMenu
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
    refreshWindows 
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
    const initializeApp = async () => {
      await loadConfig();
      loadWindows();
    };
    
    initializeApp();
  }, [isDetachedWindow, loadWindows]);

  // Set up event listeners for Tauri events
  useEffect(() => {
    const setupListeners = async () => {
      // Only setup listeners in Tauri context
      if (typeof window === 'undefined' || !window.__TAURI__) {
        return () => {}; // Return a no-op function instead of array
      }
      
      const unlisteners: (() => void)[] = [];
      
      try {
        // Listen for new note event and delegate to our hook
        const unlistenNewNote = await listen('menu-new-note', async (event) => {
          console.log('[BLINK] [FRONTEND] 🔥 Received menu-new-note event!', event);
          createNewNote();
        });
        unlisteners.push(unlistenNewNote);
        
        // Listen for window closed events
        const unlistenWindowClosed = await listen('window-closed', async (event) => {
          console.log('[BLINK] Window closed event received for note:', event.payload);
          const noteId = event.payload as string;
          
          // Force immediate refresh of windows list
          await refreshWindows();
          
          // Additional force update by directly updating the store
          setTimeout(async () => {
            await refreshWindows();
            const windowsStore = useDetachedWindowsStore.getState();
            console.log('[BLINK] Windows after refresh:', windowsStore.windows.map(w => w.note_id));
            console.log('[BLINK] Is window still open?', windowsStore.isWindowOpen(noteId));
          }, 200);
        });
        unlisteners.push(unlistenWindowClosed);
        
        // Listen for window created events (from drag finalization)
        const unlistenWindowCreated = await listen('window-created', async (event) => {
          console.log('[BLINK] Window created event received for note:', event.payload);
          
          // Force immediate refresh of windows list
          await refreshWindows();
        });
        unlisteners.push(unlistenWindowCreated);
        
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
  }, [createNewNote, refreshWindows]);


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
        
        <div className="flex min-h-0">
          <NavigationSidebar
            currentView={currentView}
            sidebarVisible={sidebarVisible}
            onNotesClick={handleNotesClick}
            onSettingsClick={handleSettingsClick}
          />
        {/* Main content area (notes or settings) */}
        <div className="flex-1 flex flex-col bg-background min-h-0">
          {currentView === 'notes' ? (
            <div className="flex-1 flex">
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
                  syntaxHighlighting: config?.appearance?.syntaxHighlighting
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
            <div className="flex-1 flex">
              <SettingsNavigation
                sidebarVisible={sidebarVisible}
                selectedSection={selectedSettingsSection}
                onSectionChange={setSelectedSettingsSection}
              />
              
              {/* Settings content area */}
              <div className="flex-1 flex flex-col bg-background min-h-0">
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
    </WindowWrapper>
  );
}

export default App;