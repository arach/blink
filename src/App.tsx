import { listen } from '@tauri-apps/api/event';
import { useState, useEffect } from 'react';
import { DetachedNoteWindow } from './components/DetachedNoteWindow';
import { DragGhost } from './components/DragGhost';
import { SettingsPanel } from './components/SettingsPanel';
import { CustomTitleBar } from './components/CustomTitleBar';
import { WindowWrapper } from './components/WindowWrapper';
import { NavigationSidebar } from './components/NavigationSidebar';
import { NotesPanel } from './components/NotesPanel';
import { SettingsNavigation } from './components/SettingsNavigation';
import { EditorArea } from './components/EditorArea';
import { AppFooter } from './components/AppFooter';
import { useDetachedWindowsStore } from './stores/detached-windows-store';
import { useConfigStore } from './stores/config-store';
import { useSaveStatus } from './hooks/use-save-status';
import { useWindowTransparency } from './hooks/use-window-transparency';
import { useTypewriterMode } from './hooks/use-typewriter-mode';
import { useDragToDetach } from './hooks/use-drag-to-detach';
import { useWindowShade } from './hooks/use-window-shade';
import { useNoteManagement } from './hooks/use-note-management';
import { useCommandPalette } from './hooks/use-command-palette';
import { useKeyboardShortcuts } from './hooks/use-keyboard-shortcuts';
import { useContextMenu } from './hooks/use-context-menu';
import { themes, applyTheme, getThemeById } from './types/theme';


function App() {
  const { config, updateConfig, loadConfig } = useConfigStore();
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
          ...config.appearance,
          focusMode: !config.appearance?.focusMode
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
    const themeId = config.appearance?.themeId || 'midnight-ink';
    const theme = getThemeById(themeId);
    // console.log('[APP] Theme effect triggered. Config:', config);
    // console.log('[APP] ThemeId:', themeId, 'Theme found:', !!theme);
    
    // Force apply the theme regardless
    if (theme) {
      // console.log('[APP] Applying theme:', theme.name);
      applyTheme(theme);
    } else {
      console.error('[APP] Theme not found:', themeId, 'Available themes:', Object.values(themes).map(t => t.id));
    }
  }, [config]); // Trigger when config changes

  // Also apply default theme on mount to ensure it loads
  useEffect(() => {
    // console.log('[DEBUG] Themes object:', themes);
    // console.log('[DEBUG] Available theme IDs:', Object.values(themes).map(t => t.id));
    const defaultTheme = getThemeById('midnight-ink');
    if (defaultTheme) {
      // console.log('[APP] Applying default theme on mount:', defaultTheme.name);
      applyTheme(defaultTheme);
    } else {
      console.error('[DEBUG] midnight-ink theme not found in themes object');
    }
  }, []); // Only run once on mount

  // Load windows and check permissions on startup
  useEffect(() => {
    const initializeApp = async () => {
      // console.log('[BLINK] [FRONTEND] Initializing app...');
      
      // Load config first
      await loadConfig();
      
      // Load detached windows
      loadWindows();
      
      // console.log('[BLINK] [FRONTEND] App initialization complete');
      
      // Permissions resolved - no longer needed
    };
    
    initializeApp();
  }, [isDetachedWindow, loadWindows]);

  // Set up event listeners for Tauri events
  useEffect(() => {
    console.log('[BLINK] [FRONTEND] Setting up event listeners');
    
    const setupListeners = async () => {
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
      console.log('[BLINK] [FRONTEND] Cleaning up event listeners');
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
  const wordCount = currentContent.split(/\s+/).filter(word => word.length > 0).length;
  
  const themeId = config.appearance?.themeId || 'midnight-ink';
  const theme = getThemeById(themeId);
  
  return (
    <WindowWrapper
      className={`main-window transition-all duration-300 ${
        isDragging ? 'bg-blue-500/5' : ''
      } ${config.appearance?.focusMode ? 'focus-mode' : ''}`}
      style={
        config.appearance?.appFontFamily
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
            lastSaved: selectedNote?.updatedAt ? new Date(selectedNote.updatedAt).toLocaleString() : undefined
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
                showNotePreviews={config.appearance?.showNotePreviews}
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
                  fontSize: config.appearance?.fontSize,
                  editorFontFamily: config.appearance?.editorFontFamily,
                  contentFontSize: config.appearance?.contentFontSize,
                  previewFontFamily: config.appearance?.previewFontFamily,
                  lineHeight: config.appearance?.lineHeight,
                  syntaxHighlighting: config.appearance?.syntaxHighlighting
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