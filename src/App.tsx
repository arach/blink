import { listen } from '@tauri-apps/api/event';
import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { DetachedNoteWindow } from './components/DetachedNoteWindow';
import { DragGhost } from './components/DragGhost';
import { SettingsPanel } from './components/SettingsPanel';
import { ResizablePanel } from './components/ResizablePanel';
import { CustomTitleBar } from './components/CustomTitleBar';
import { WindowWrapper } from './components/WindowWrapper';
import { ContextMenu } from './components/ContextMenu';
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
import { markdownToPlainText, truncateText } from './lib/utils';
import { themes, applyTheme, getThemeById } from './types/theme';
import { Palette, Eye, Focus, Keyboard, Pin, Folder } from 'lucide-react';


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
    commandQuery,
    selectedCommandIndex,
    filteredCommands,
    openCommandPalette,
    closeCommandPalette,
    setCommandQuery,
    setSelectedCommandIndex,
    executeCommand,
    handleCommandKeyDown,
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
    contextMenu,
    showContextMenu,
    hideContextMenu,
    handleContextMenuAction,
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
  const handleNotesClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (currentView === 'notes') {
      setSidebarVisible(!sidebarVisible);
    } else {
      setCurrentView('notes');
      setSidebarVisible(true);
    }
  };
  const handleSettingsClick = (e: React.MouseEvent<HTMLButtonElement>) => {
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
          {/* Sidebar - always visible */}
          <div className="w-8 bg-muted/80 flex flex-col items-center justify-between border-r border-primary/30 flex-shrink-0 relative z-10 backdrop-blur-sm" data-sidebar>
          <div className="flex flex-col items-center pt-1">
            {/* Notes view icon */}
            <button 
              onClick={handleNotesClick}
              className={`w-5 h-5 flex items-center justify-center m-0.5 rounded transition-colors hover:animate-flip-x ${
                currentView === 'notes' 
                  ? 'bg-primary text-background' 
                  : 'text-primary/80 hover:text-primary hover:bg-primary/20'
              }`}
              title={sidebarVisible && currentView === 'notes' ? 'Hide notes' : 'Notes'}
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
          <div className="flex flex-col items-center">
            {/* Settings icon */}
            <button 
              onClick={handleSettingsClick}
              className={`w-5 h-5 flex items-center justify-center m-0.5 mb-1 rounded transition-colors hover:animate-spin-fast ${
                currentView === 'settings' 
                  ? 'bg-primary text-background' 
                  : 'text-primary/80 hover:text-primary hover:bg-primary/20'
              }`}
              title={sidebarVisible && currentView === 'settings' ? 'Hide settings' : 'Settings (⌘,)'}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </button>
          </div>
        </div>
        {/* Main content area (notes or settings) */}
        <div className="flex-1 flex flex-col bg-background min-h-0">
          {currentView === 'notes' ? (
            <div className="flex-1 flex">
              {/* Notes sidebar */}
              <div className={`h-full overflow-hidden transition-all duration-300 ease-out ${
                sidebarVisible ? 'w-80' : 'w-0'
              }`}>
                <ResizablePanel defaultWidth={320} minWidth={240} maxWidth={400}>
                  <div className="h-full bg-card border-r border-border/30 flex flex-col">
                    {/* Header - Standardized 76px height */}
                    <div className="h-[76px] flex flex-col justify-center px-4 border-b border-border/20">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary/70">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                            <polyline points="14,2 14,8 20,8"/>
                            <line x1="16" y1="13" x2="8" y2="13"/>
                            <line x1="16" y1="17" x2="8" y2="17"/>
                            <line x1="10" y1="9" x2="8" y2="9"/>
                          </svg>
                          <h2 className="text-sm font-medium text-foreground">Notes</h2>
                        </div>
                        <button
                          onClick={createNewNote}
                          className="text-muted-foreground hover:text-foreground p-1 rounded transition-colors"
                          title="New note (⌘N)"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="12" y1="5" x2="12" y2="19"/>
                            <line x1="5" y1="12" x2="19" y2="12"/>
                          </svg>
                        </button>
                      </div>
                      
                      {/* Search */}
                      <div className="relative">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground/60">
                          <circle cx="11" cy="11" r="8"/>
                          <path d="M21 21l-4.35-4.35"/>
                        </svg>
                        <input
                          type="text"
                          placeholder="Search notes..."
                          className="w-full pl-9 pr-3 py-1.5 bg-background border border-border/20 rounded text-xs placeholder-muted-foreground/60 focus:outline-none focus:border-primary/40"
                        />
                      </div>
                    </div>

                    {/* Notes List */}
                    <div className="flex-1 overflow-y-auto">
                      {loading ? (
                        <div className="p-4 text-center text-muted-foreground/60 text-sm">
                          Loading your thoughts...
                        </div>
                      ) : notes.length === 0 ? (
                        <div className="p-4 text-center text-muted-foreground/60 text-sm">
                          <div className="space-y-1">
                            <div>Your workspace awaits ✨</div>
                            <div className="text-xs text-muted-foreground/40">Press ⌘N to create your first note</div>
                          </div>
                        </div>
                      ) : (
                        <div className="p-2">
                          {notes.map((note, index) => (
                            <div
                              key={note.id}
                              className={`group relative p-3 rounded-lg mb-2 cursor-pointer transition-all ${
                                selectedNoteId === note.id
                                  ? 'bg-primary/10 border border-primary/20'
                                  : 'bg-background/40 hover:bg-background/60 border border-transparent'
                              }`}
                              onClick={() => selectNote(note.id)}
                              onContextMenu={(e) => showContextMenu(e.clientX, e.clientY, note.id)}
                              onMouseDown={(e) => {
                                if (e.button === 0) { // Left click only
                                  startDrag(e, note.id);
                                }
                              }}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <h3 className={`text-sm font-medium truncate transition-colors ${
                                      selectedNoteId === note.id 
                                        ? 'text-primary' 
                                        : 'text-foreground group-hover:text-foreground'
                                    }`}>
                                      {note.title || 'Untitled'}
                                    </h3>
                                    {index < 9 && (
                                      <span className={`text-xs px-1.5 py-0.5 rounded font-mono transition-colors ${
                                        selectedNoteId === note.id 
                                          ? 'bg-primary/20 text-primary/80' 
                                          : 'bg-muted-foreground/10 text-muted-foreground/50 group-hover:text-muted-foreground/70'
                                      }`}>
                                        ⌃⌘⌥⇧{index + 1}
                                      </span>
                                    )}
                                  </div>
                                  
                                  {config.appearance?.showNotePreviews && (
                                    <p className="text-xs text-muted-foreground/70 mt-1 line-clamp-2 leading-relaxed">
                                      {note.content ? truncateText(markdownToPlainText(note.content), 80) : 'Empty note'}
                                    </p>
                                  )}
                                </div>
                                
                                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                  {/* Window indicator */}
                                  {isWindowOpen(note.id) && (
                                    <div className={`w-1.5 h-1.5 rounded-full transition-colors ${
                                      selectedNoteId === note.id ? 'bg-primary/60' : 'bg-muted-foreground/40'
                                    }`} title="Note is open in window" />
                                  )}
                                  
                                  {/* Delete button - only show on hover */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      deleteNote(note.id);
                                    }}
                                    className="opacity-0 group-hover:opacity-100 text-muted-foreground/50 hover:text-red-400 p-1 rounded transition-all"
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
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </ResizablePanel>
              </div>

              {/* Editor/Content Area */}
              <div className="flex-1 flex flex-col bg-background">
                {selectedNote ? (
                  <>
                    {/* Editor area */}
                    <div className="flex-1 relative">
                      <textarea
                        ref={textareaRef}
                        value={currentContent}
                        onChange={(e) => {
                          setCurrentContent(e.target.value);
                          updateNoteContent(e.target.value);
                        }}
                        placeholder="Your thoughts, unfiltered..."
                        className="w-full h-full resize-none bg-transparent border-none outline-none p-5 text-foreground placeholder-muted-foreground/50 scrollbar-thin"
                        style={{
                          fontSize: `${config.appearance?.fontSize || 15}px`,
                          fontFamily: config.appearance?.editorFontFamily || 'system-ui',
                          lineHeight: config.appearance?.lineHeight || 1.6,
                        }}
                      />
                      
                      {/* Preview overlay */}
                      {isPreviewMode && selectedNote && (
                        <div 
                          className="absolute inset-0 w-full h-full overflow-y-auto prose prose-invert max-w-none cursor-text bg-background z-10"
                          onDoubleClick={() => setIsPreviewMode(false)}
                          title="Double-click to edit"
                          style={{ 
                            fontSize: `${config.appearance?.contentFontSize || config.appearance?.fontSize || 16}px`,
                            fontFamily: config.appearance?.previewFontFamily || 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
                            lineHeight: config.appearance?.lineHeight || 1.6,
                            padding: '1.25rem' 
                          }}
                        >
                          <ReactMarkdown 
                            remarkPlugins={[remarkGfm]}
                            rehypePlugins={config.appearance?.syntaxHighlighting ? [rehypeHighlight] : []}
                            components={{
                              h1: ({children}) => <h1 className="text-2xl font-semibold mb-4 mt-6 first:mt-0">{children}</h1>,
                              h2: ({children}) => <h2 className="text-xl font-semibold mb-3 mt-5">{children}</h2>,
                              h3: ({children}) => <h3 className="text-lg font-semibold mb-2 mt-4">{children}</h3>,
                              p: ({children}) => <p className="mb-4 leading-relaxed">{children}</p>,
                              blockquote: ({children}) => (
                                <blockquote className="border-l-4 border-l-primary/60 bg-muted/20 pl-4 py-2 my-4 italic">
                                  {children}
                                </blockquote>
                              ),
                              code: ({children, ...props}) => {
                                const inline = !props.className?.includes('language-');
                                return inline ? 
                                  <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">{children}</code> :
                                  <code className="block">{children}</code>
                              },
                              pre: ({children}) => (
                                <pre className="bg-muted/50 border border-border/30 rounded-lg p-4 overflow-x-auto my-4">
                                  {children}
                                </pre>
                              ),
                              ul: ({children}) => <ul className="list-disc list-inside mb-4 space-y-1">{children}</ul>,
                              ol: ({children}) => <ol className="list-decimal list-inside mb-4 space-y-1">{children}</ol>,
                              li: ({children}) => <li className="leading-relaxed">{children}</li>,
                              a: ({href, children}) => (
                                <a href={href} className="text-primary hover:underline font-medium">{children}</a>
                              ),
                              strong: ({children}) => <strong className="font-semibold">{children}</strong>,
                              em: ({children}) => <em className="italic">{children}</em>,
                              hr: () => <hr className="border-border/30 my-6" />,
                              table: ({children}) => (
                                <div className="overflow-x-auto my-4">
                                  <table className="min-w-full border-collapse border border-border/30">
                                    {children}
                                  </table>
                                </div>
                              ),
                              th: ({children}) => (
                                <th className="border border-border/30 bg-muted/30 px-3 py-2 text-left font-semibold">
                                  {children}
                                </th>
                              ),
                              td: ({children}) => (
                                <td className="border border-border/30 px-3 py-2">{children}</td>
                              )
                            }}
                          >
                            {currentContent || '*Empty note*'}
                          </ReactMarkdown>
                        </div>
                      )}
                    </div>
                    
                    {/* Note-specific footer */}
                    {selectedNote && (
                      <div className="status-footer bg-background/90 border-t border-border/30 px-6 h-6 flex items-center justify-between backdrop-blur-sm">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            {saveStatus.isSaving ? (
                              <>
                                <div className="w-1.5 h-1.5 bg-yellow-500/70 rounded-full animate-pulse"></div>
                                <span className="text-xs text-muted-foreground/60 font-medium">Capturing thoughts...</span>
                              </>
                            ) : (
                              <>
                                <div className="w-1.5 h-1.5 bg-green-500/70 rounded-full"></div>
                                <span className="text-xs text-muted-foreground/60 font-medium">Safe & sound ✓</span>
                              </>
                            )}
                          </div>
                          
                          <div className="text-xs text-muted-foreground/60 font-medium">
                            {wordCount} words
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setIsPreviewMode(!isPreviewMode)}
                            className={`px-3 py-1.5 text-xs rounded-md transition-all duration-200 font-medium ${
                              isPreviewMode 
                                ? 'bg-primary/90 text-primary-foreground shadow-sm' 
                                : 'bg-background/80 text-muted-foreground hover:text-foreground hover:bg-background/90 border border-border/30'
                            }`}
                            title="Toggle preview (⌘⇧P)"
                          >
                            {isPreviewMode ? 'Edit' : 'Preview'}
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-muted-foreground/60">
                    <p>Select a note to start editing</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Settings view */
            <div className="flex-1 flex">
              {/* Settings sidebar */}
              <div className={`h-full overflow-hidden transition-all duration-300 ease-out ${
                sidebarVisible ? 'w-80' : 'w-0'
              }`}>
                <ResizablePanel defaultWidth={320} minWidth={240} maxWidth={400}>
                  <div className="h-full bg-card border-r border-border/30 flex flex-col">
                    {/* Header - Standardized 76px height */}
                    <div className="h-[76px] flex flex-col justify-center px-4 border-b border-border/20">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary/70">
                            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
                            <circle cx="12" cy="12" r="3"/>
                          </svg>
                          <h2 className="text-sm font-medium text-foreground">Settings</h2>
                        </div>
                      </div>
                      
                      {/* Empty row for vertical structure alignment */}
                      <div className="h-7"></div>
                    </div>
                    
                    {/* Settings sections list */}
                    <div className="flex-1 overflow-y-auto p-2">
                      <div className="space-y-1">
                        <button 
                          onClick={() => setSelectedSettingsSection('general')}
                          className={`w-full p-3 rounded-lg text-left transition-all ${
                            selectedSettingsSection === 'general'
                              ? 'bg-primary/10 border border-primary/20'
                              : 'hover:bg-background/60 border border-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground/70">
                              <circle cx="12" cy="12" r="3"/>
                              <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1"/>
                            </svg>
                            <h3 className={`text-sm font-medium ${
                              selectedSettingsSection === 'general' ? 'text-primary' : 'text-foreground'
                            }`}>General</h3>
                          </div>
                          <p className="text-xs text-muted-foreground/60">App info and interface settings</p>
                        </button>
                        
                        <button 
                          onClick={() => setSelectedSettingsSection('appearance')}
                          className={`w-full p-3 rounded-lg text-left transition-all ${
                            selectedSettingsSection === 'appearance'
                              ? 'bg-primary/10 border border-primary/20'
                              : 'hover:bg-background/60 border border-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground/70">
                              <path d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M19.07 4.93L4.93 19.07"/>
                            </svg>
                            <h3 className={`text-sm font-medium ${
                              selectedSettingsSection === 'appearance' ? 'text-primary' : 'text-foreground'
                            }`}>Appearance</h3>
                          </div>
                          <p className="text-xs text-muted-foreground/60">Theme, fonts, and visual preferences</p>
                        </button>
                        
                        <button 
                          onClick={() => setSelectedSettingsSection('shortcuts')}
                          className={`w-full p-3 rounded-lg text-left transition-all ${
                            selectedSettingsSection === 'shortcuts'
                              ? 'bg-primary/10 border border-primary/20'
                              : 'hover:bg-background/60 border border-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground/70">
                              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                              <line x1="8" y1="21" x2="16" y2="21"/>
                              <line x1="12" y1="17" x2="12" y2="21"/>
                            </svg>
                            <h3 className={`text-sm font-medium ${
                              selectedSettingsSection === 'shortcuts' ? 'text-primary' : 'text-foreground'
                            }`}>Shortcuts</h3>
                          </div>
                          <p className="text-xs text-muted-foreground/60">Keyboard shortcuts and hotkeys</p>
                        </button>
                        
                        <button 
                          onClick={() => setSelectedSettingsSection('editor')}
                          className={`w-full p-3 rounded-lg text-left transition-all ${
                            selectedSettingsSection === 'editor'
                              ? 'bg-primary/10 border border-primary/20'
                              : 'hover:bg-background/60 border border-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground/70">
                              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                              <path d="m15 5 4 4"/>
                            </svg>
                            <h3 className={`text-sm font-medium ${
                              selectedSettingsSection === 'editor' ? 'text-primary' : 'text-foreground'
                            }`}>Editor</h3>
                          </div>
                          <p className="text-xs text-muted-foreground/60">Writing and editing preferences</p>
                        </button>
                        
                        <button 
                          onClick={() => setSelectedSettingsSection('advanced')}
                          className={`w-full p-3 rounded-lg text-left transition-all ${
                            selectedSettingsSection === 'advanced'
                              ? 'bg-primary/10 border border-primary/20'
                              : 'hover:bg-background/60 border border-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground/70">
                              <polygon points="13,2 3,14 12,14 11,22 21,10 12,10"/>
                            </svg>
                            <h3 className={`text-sm font-medium ${
                              selectedSettingsSection === 'advanced' ? 'text-primary' : 'text-foreground'
                            }`}>Advanced</h3>
                          </div>
                          <p className="text-xs text-muted-foreground/60">Developer and system settings</p>
                        </button>
                      </div>
                    </div>
                  </div>
                </ResizablePanel>
              </div>
              
              {/* Settings content area */}
              <div className="flex-1 flex flex-col bg-background min-h-0">
                <SettingsPanel selectedSection={selectedSettingsSection} />
              </div>
            </div>
          )}
        </div>
        </div>
        
        {/* App-wide footer - always visible */}
        <footer className="app-footer w-full bg-background/90 border-t border-border/30 px-3 flex items-center justify-between text-xs text-muted-foreground/80 h-6 min-h-[1.5rem] gap-4 select-none">
          <div className="flex items-center gap-3">
            {/* Theme swatch and name */}
            <span className="flex items-center gap-1">
              <Palette className="w-4 h-4 text-primary/80" />
              <span className="w-3 h-3 rounded-full border border-border/40 mr-1" style={{ backgroundColor: theme ? theme.colors?.accent || '#3b82f6' : '#3b82f6' }} />
              {theme ? theme.name : themeId}
            </span>
            {/* Opacity */}
            {typeof config.appearance?.windowOpacity === 'number' && (
              <span className="flex items-center gap-1">
                <Eye className="w-4 h-4" />
                {Math.round(config.appearance.windowOpacity * 100)}%
              </span>
            )}
            {/* Focus mode */}
            {config.appearance?.focusMode && (
              <span className="flex items-center gap-1 text-primary">
                <Focus className="w-4 h-4" /> Focus
              </span>
            )}
            {/* Typewriter mode */}
            {config.appearance?.typewriterMode && (
              <span className="flex items-center gap-1 text-primary">
                <Keyboard className="w-4 h-4" /> Typewriter
              </span>
            )}
            {/* Always on top */}
            {config.alwaysOnTop && (
              <span className="flex items-center gap-1 text-primary">
                <Pin className="w-4 h-4" /> Pinned
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-foreground/90">
            <Folder className="w-4 h-4" />
            <span className="truncate">~/Notes</span>
          </div>
        </footer>
      </div>
    </WindowWrapper>
  );
}

export default App;