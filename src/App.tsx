import { useState } from 'react';
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
  useAppInitialization,
  useSaveStatus,
  useWindowTransparency,
  useTypewriterMode,
  useDragToDetach,
  useWindowShade,
  useNoteManagement,
  useCommandPalette,
  useKeyboardShortcuts,
  useContextMenu,
  useChordShortcuts,
  useWindowManager,
  useGlobalEventListeners
} from './hooks';
import { getThemeById } from './types';
import { getWordCount } from './lib/utils';
import { getCenterPosition } from './utils/window-positioning';


function App() {
  const { config, updateConfig, isLoading } = useConfigStore();
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [isPreviewMode, setIsPreviewMode] = useState(false); // Start in edit mode
  const [currentView, setCurrentView] = useState<'notes' | 'settings'>('notes');
  const [selectedSettingsSection, setSelectedSettingsSection] = useState<'general' | 'appearance' | 'shortcuts' | 'editor' | 'advanced'>('appearance');

  // Window detection from hook
  const { isDetachedWindow, detachedNoteId, isDragGhost, dragGhostTitle } = useWindowManager();
  
  // App initialization
  useAppInitialization({ isDetachedWindow });

  // Detached windows store
  const { 
    createWindow, 
    isWindowOpen, 
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
        const { x, y } = getCenterPosition();
        await createWindow(noteId, x, y);
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
        const { x, y } = getCenterPosition();
        await createWindow(noteId, x, y);
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
          const { x, y } = getCenterPosition();
          const result = await createWindow(noteId, x, y);
          console.log('[CHORD] Create window result:', result);
        }
      } catch (error) {
        console.error('[CHORD] ❌ Error in onFocusWindow:', error);
      }
    },
  });
  
  // Global event listeners
  useGlobalEventListeners({
    notes,
    onCreateNewNote: createNewNote,
    onStartWindowMode: startWindowMode,
  });
  
  // Debug logging
  // console.log('Config loaded:', config);
  // console.log('Focus mode:', config.appearance?.focusMode);
  // console.log('Current notes count:', notes.length);
  // console.log('Selected note ID:', selectedNoteId);




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