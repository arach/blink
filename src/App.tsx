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
import { CommandPalette } from './components/CommandPalette';
import { PermissionPrompt } from './components/PermissionPrompt';
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
import { usePermissions } from './hooks/use-permissions';
import { useContextMenu } from './hooks/use-context-menu';
import { markdownToPlainText, truncateText } from './lib/utils';


function App() {
  const { config, updateConfig } = useConfigStore();
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [currentView, setCurrentView] = useState<'notes' | 'settings'>('notes');

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

  // Permission management hook
  const {
    showPermissionPrompt,
    requestPermissions,
    dismissPermissionPrompt,
    openSystemSettings,
  } = usePermissions();

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
  console.log('Config loaded:', config);
  console.log('Focus mode:', config.appearance?.focusMode);
  console.log('Current notes count:', notes.length);
  console.log('Selected note ID:', selectedNoteId);

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

  // Load windows and check permissions on startup
  useEffect(() => {
    const initializeApp = async () => {
      console.log('[BLINK] [FRONTEND] Initializing app...');
      
      // Load detached windows
      loadWindows();
      
      console.log('[BLINK] [FRONTEND] App initialization complete');
      
      if (!isDetachedWindow) {
        requestPermissions();
      }
    };
    
    initializeApp();
  }, [isDetachedWindow, loadWindows, requestPermissions]);

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
          unlisteners.forEach(fn => fn());
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
  
  return (
    <WindowWrapper className={`main-window transition-all duration-300 ${
      isDragging ? 'bg-blue-500/5' : ''
    } ${config.appearance?.focusMode ? 'focus-mode' : ''}`}>
      <CustomTitleBar 
        title="Blink"
        isMainWindow={true}
        isShaded={isShaded}
        stats={{
          wordCount: selectedNote ? wordCount : undefined,
          lastSaved: selectedNote?.updatedAt ? new Date(selectedNote.updatedAt).toLocaleString() : undefined
        }}
      />
      
      {!isShaded && (
        <div className="flex-1 flex">
        {/* Left sidebar - navigation */}
        <div className="w-8 bg-background flex flex-col items-center justify-between border-r border-border/30 flex-shrink-0 relative z-10">
          <div className="flex flex-col items-center">
            {/* Notes view icon */}
            <button 
              onClick={() => {
                if (currentView === 'notes') {
                  setSidebarVisible(!sidebarVisible);
                } else {
                  setCurrentView('notes');
                  setSidebarVisible(true);
                }
              }}
              className={`p-2 m-1 rounded transition-colors ${
                currentView === 'notes' 
                  ? 'bg-primary/10 text-primary' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/60'
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
              onClick={() => {
                if (currentView === 'settings') {
                  setSidebarVisible(!sidebarVisible);
                } else {
                  setCurrentView('settings');
                  setSidebarVisible(true);
                }
              }}
              className={`p-2 m-1 rounded transition-colors ${
                currentView === 'settings' 
                  ? 'bg-primary/10 text-primary' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/60'
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

        {/* Main content area */}
        {currentView === 'notes' ? (
          <div className="flex-1 flex">
            {/* Notes sidebar */}
            <div className={`h-full overflow-hidden transition-all duration-300 ease-out ${
              sidebarVisible ? 'w-80' : 'w-0'
            }`}>
              <ResizablePanel defaultWidth={320} minWidth={240} maxWidth={400}>
                <div className="h-full bg-card border-r border-border/30 flex flex-col">
                  {/* Header */}
                  <div className="p-4 border-b border-border/20">
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="text-sm font-medium text-foreground">Notes</h2>
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
                        className="w-full pl-9 pr-3 py-1.5 bg-background border border-border/20 rounded text-sm placeholder-muted-foreground/60 focus:outline-none focus:border-primary/40"
                      />
                    </div>
                  </div>

                  {/* Notes List */}
                  <div className="flex-1 overflow-y-auto">
                    {loading ? (
                      <div className="p-4 text-center text-muted-foreground/60 text-sm">
                        Loading notes...
                      </div>
                    ) : notes.length === 0 ? (
                      <div className="p-4 text-center text-muted-foreground/60 text-sm">
                        No notes yet. Create your first note!
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
                      placeholder="Start writing..."
                      className="w-full h-full resize-none bg-transparent border-none outline-none p-6 text-foreground placeholder-muted-foreground/50 scrollbar-thin"
                      style={{
                        fontSize: `${config.appearance?.fontSize || 15}px`,
                        fontFamily: config.appearance?.editorFontFamily || 'system-ui',
                        lineHeight: config.appearance?.lineHeight || 1.6,
                      }}
                    />
                    
                    {/* Preview overlay */}
                    {isPreviewMode && selectedNote && (
                      <div 
                        className="w-full h-full overflow-y-auto prose prose-invert max-w-none cursor-text"
                        onDoubleClick={() => setIsPreviewMode(false)}
                        title="Double-click to edit"
                        style={{ 
                          fontSize: `${config.appearance?.contentFontSize || config.appearance?.fontSize || 16}px`,
                          fontFamily: config.appearance?.previewFontFamily || 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
                          lineHeight: config.appearance?.lineHeight || 1.6,
                          padding: '1.5rem 0' 
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
                    <div className="bg-card/20 border-t border-border/15 px-6 py-2 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                          {saveStatus.isSaving ? (
                            <>
                              <span className="text-xs text-muted-foreground/50" style={{ fontSize: '10px' }}>Saving...</span>
                              <div className="w-1 h-1 bg-yellow-500/60 rounded-full animate-pulse"></div>
                            </>
                          ) : (
                            <>
                              <span className="text-xs text-muted-foreground/50" style={{ fontSize: '10px' }}>Saved</span>
                              <div className="w-1 h-1 bg-green-500/60 rounded-full"></div>
                            </>
                          )}
                        </div>
                        
                        <div className="text-xs text-muted-foreground/50" style={{ fontSize: '10px' }}>
                          {wordCount} words
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setIsPreviewMode(!isPreviewMode)}
                          className={`px-2 py-1 text-xs rounded transition-colors ${
                            isPreviewMode 
                              ? 'bg-primary/80 text-primary-foreground' 
                              : 'bg-background/60 text-muted-foreground hover:text-foreground'
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
                  <div className="text-center">
                    <p className="text-sm mb-2">Select a note to start editing</p>
                    <p className="text-xs">or create a new one with ⌘N</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Settings sidebar with sub-navigation */
          <div className={`h-full overflow-hidden transition-all duration-300 ease-out ${
            sidebarVisible ? 'w-64' : 'w-0'
          }`}>
            <div className="h-full bg-card border-r border-border/30 flex flex-col">
              <div className="p-4">
                <h2 className="text-sm font-medium text-foreground mb-4">Settings</h2>
                
                {/* Settings Sub-Navigation */}
                <nav className="space-y-1">
                  <button
                    onClick={() => {
                      const element = document.querySelector('[data-section="general"]');
                      element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-xs rounded transition-colors text-muted-foreground hover:text-foreground hover:bg-background/60"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="3"/>
                      <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1"/>
                    </svg>
                    General
                  </button>
                  
                  <button
                    onClick={() => {
                      const element = document.querySelector('[data-section="appearance"]');
                      element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-xs rounded transition-colors text-muted-foreground hover:text-foreground hover:bg-background/60"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14,2 14,8 20,8"/>
                      <line x1="16" y1="13" x2="8" y2="13"/>
                      <line x1="16" y1="17" x2="8" y2="17"/>
                      <line x1="10" y1="9" x2="8" y2="9"/>
                    </svg>
                    Appearance
                  </button>
                  
                  <button
                    onClick={() => {
                      const element = document.querySelector('[data-section="shortcuts"]');
                      element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-xs rounded transition-colors text-muted-foreground hover:text-foreground hover:bg-background/60"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="2" y="7" width="20" height="10" rx="1"/>
                      <path d="M7 21c0-2.5 2-2.5 2-5M15 21c0-2.5 2-2.5 2-5M9 7v-4M15 7v-4"/>
                    </svg>
                    Shortcuts
                  </button>
                  
                  <button
                    onClick={() => {
                      const element = document.querySelector('[data-section="ai"]');
                      element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-xs rounded transition-colors text-muted-foreground hover:text-foreground hover:bg-background/60"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
                    </svg>
                    AI & Plugins
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}

        {/* Settings content area */}
        {currentView === 'settings' && (
          <div className="flex-1">
            <SettingsPanel />
          </div>
        )}
        </div>
      )}
      
      {/* Command Palette */}
      <CommandPalette
        show={showCommandPalette}
        query={commandQuery}
        selectedIndex={selectedCommandIndex}
        commands={filteredCommands}
        onQueryChange={setCommandQuery}
        onSelectedIndexChange={setSelectedCommandIndex}
        onExecuteCommand={executeCommand}
        onClose={closeCommandPalette}
        onKeyDown={handleCommandKeyDown}
      />

      {/* Permission Prompt */}
      <PermissionPrompt
        show={showPermissionPrompt}
        onOpenSettings={openSystemSettings}
        onDismiss={dismissPermissionPrompt}
      />

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          noteId={contextMenu.noteId}
          onAction={handleContextMenuAction}
          onClose={hideContextMenu}
        />
      )}
    </WindowWrapper>
  );
}

export default App;