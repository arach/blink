import { useState, useCallback } from 'react';
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
  useModifiedState,
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
import { getCenterPosition, getGridPosition } from './utils/window-positioning';


function App() {
  const { config, updateConfig } = useConfigStore();
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
    focusWindow
  } = useDetachedWindowsStore();

  // Drag-to-detach functionality - stable callback to prevent re-renders
  const onDropCallback = useCallback(async (noteId: string, x: number, y: number) => {
    if (!isWindowOpen(noteId)) {
      await createWindow(noteId, x, y);
    }
  }, [isWindowOpen, createWindow]);

  const { startDrag, isDragging } = useDragToDetach({
    onDrop: onDropCallback
  });

  // Save status tracking
  const saveStatus = useSaveStatus();
  const modifiedState = useModifiedState();
  
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
    saveNoteImmediately,
    deleteNote,
    setCurrentContent,
  } = useNoteManagement({
    onSaveStart: () => {
      saveStatus.startSaving();
    },
    onSaveComplete: () => {
      saveStatus.saveSuccess();
      modifiedState.markSaved(currentContent);
    },
    onSaveError: () => {
      saveStatus.setSaveError('Failed to save note');
    }
  });

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
      const { x, y } = getCenterPosition();
      await createWindow(noteId, x, y);
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
      const { x, y } = getCenterPosition();
      await createWindow(noteId, x, y);
    },
    onFocusWindow: async (noteId: string) => {
      console.log('[CHORD] onFocusWindow called with noteId:', noteId);
      
      // Check if window already exists
      if (isWindowOpen(noteId)) {
        console.log('[CHORD] ✅ Window exists, attempting to focus');
        const focused = await focusWindow(noteId);
        if (focused) {
          console.log('[CHORD] ✅ Focus successful');
          return;
        }
      }
      
      console.log('[CHORD] Creating new window');
      // Determine position based on note index for first 9 notes
      const noteIndex = notes.findIndex(note => note.id === noteId);
      let position;
      
      if (noteIndex >= 0 && noteIndex < 9) {
        const slotNumber = noteIndex + 1;
        position = getGridPosition(slotNumber);
        console.log('[CHORD] Using grid position for slot', slotNumber, ':', position);
      } else {
        position = getCenterPosition();
        console.log('[CHORD] Using center position');
      }
      
      await createWindow(noteId, position.x, position.y, position.width, position.height);
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
  
  // Remove loading screen - show UI immediately with defaults

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
                saveStatus={{
                  isSaving: saveStatus.isSaving,
                  lastSaved: saveStatus.lastSaved,
                  isModified: modifiedState.isModified
                }}
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
                  // Mark as modified if content changed
                  if (selectedNote && content !== selectedNote.content) {
                    modifiedState.markModified();
                  }
                }}
                onSave={saveNoteImmediately}
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