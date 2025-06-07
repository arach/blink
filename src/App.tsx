import { invoke } from '@tauri-apps/api/core';
import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { DetachedNoteWindow } from './components/DetachedNoteWindow';
import { useDetachedWindowsStore } from './stores/detached-windows-store';

interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

function App() {
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [currentContent, setCurrentContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [showPermissionPrompt, setShowPermissionPrompt] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  // Detached window detection
  const [isDetachedWindow, setIsDetachedWindow] = useState(false);
  const [detachedNoteId, setDetachedNoteId] = useState<string | null>(null);
  
  // Detached windows store
  const { 
    createWindow, 
    closeWindow, 
    isWindowOpen, 
    loadWindows 
  } = useDetachedWindowsStore();

  const selectedNote = notes.find(note => note.id === selectedNoteId);

  // Detect if this is a detached window
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const noteParam = urlParams.get('note');
    
    if (noteParam) {
      setIsDetachedWindow(true);
      setDetachedNoteId(noteParam);
    }
  }, []);

  // Load notes on startup and check permissions
  useEffect(() => {
    loadNotes();
    loadWindows();
    if (!isDetachedWindow) {
      checkGlobalShortcutPermissions();
    }
  }, [isDetachedWindow]);

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
    
    // Look for first header (# Title)
    const headerMatch = content.match(/^#+\s*(.+)$/m);
    if (headerMatch) {
      return headerMatch[1].trim();
    }
    
    // Fallback to first non-empty line
    const firstLine = content.split('\n').find(line => line.trim());
    if (firstLine) {
      return firstLine.trim().substring(0, 50);
    }
    
    return 'Untitled';
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
      }
    ];

    // Add detach/attach window commands for selected note
    if (selectedNote && !isDetachedWindow) {
      if (isWindowOpen(selectedNote.id)) {
        commands.push({
          id: 'close-detached-window',
          title: 'Close Detached Window',
          description: `Close the detached window for "${extractTitleFromContent(selectedNote.content)}"`,
          action: async () => {
            setShowCommandPalette(false);
            await closeWindow(selectedNote.id);
          },
          category: 'action'
        });
      } else {
        commands.push({
          id: 'detach-window',
          title: 'Detach Window',
          description: `Open "${extractTitleFromContent(selectedNote.content)}" in a separate window`,
          action: async () => {
            setShowCommandPalette(false);
            await createWindow(selectedNote.id);
          },
          category: 'action'
        });
      }
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

      // Escape to close command palette
      if (e.key === 'Escape' && showCommandPalette) {
        e.preventDefault();
        setShowCommandPalette(false);
        setCommandQuery('');
        return;
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

      // Hyperkey + N (Cmd+Ctrl+Alt+Shift+N) to create new note
      if (e.metaKey && e.ctrlKey && e.altKey && e.shiftKey && e.key === 'N') {
        e.preventDefault();
        createNewNote();
      }

      // Cmd+Shift+P to toggle preview mode
      if (e.metaKey && e.shiftKey && e.key === 'P' && selectedNote) {
        e.preventDefault();
        setIsPreviewMode(!isPreviewMode);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showCommandPalette, selectedCommandIndex, commandQuery]);

  const loadNotes = async () => {
    try {
      const loadedNotes = await invoke<Note[]>('get_notes');
      setNotes(loadedNotes);
      
      // Select first note if available
      if (loadedNotes.length > 0 && !selectedNoteId) {
        setSelectedNoteId(loadedNotes[0].id);
        setCurrentContent(loadedNotes[0].content);
      }
    } catch (error) {
      console.error('Failed to load notes:', error);
    } finally {
      setLoading(false);
    }
  };

  const createNewNote = async () => {
    try {
      const newNote = await invoke<Note>('create_note', {
        request: {
          title: 'Untitled',
          content: '',
          tags: []
        }
      });
      setNotes(prev => [newNote, ...prev]);
      setSelectedNoteId(newNote.id);
      setCurrentContent('');
    } catch (error) {
      console.error('Failed to create note:', error);
    }
  };

  const updateNoteContent = async (content: string) => {
    setCurrentContent(content);
    if (selectedNoteId) {
      try {
        // Extract title from content
        const extractedTitle = extractTitleFromContent(content);
        
        const updatedNote = await invoke<Note>('update_note', {
          id: selectedNoteId,
          request: {
            title: extractedTitle,
            content: content
          }
        });
        if (updatedNote) {
          setNotes(prev => prev.map(note => 
            note.id === selectedNoteId ? updatedNote : note
          ));
        }
      } catch (error) {
        console.error('Failed to update note:', error);
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


  // If this is a detached window, render the detached note component
  if (isDetachedWindow && detachedNoteId) {
    return <DetachedNoteWindow noteId={detachedNoteId} />;
  }

  return (
    <div className="w-screen h-screen text-foreground flex flex-col" style={{ background: 'rgba(18, 19, 23, 0.95)' }}>
      {/* Ultra-thin top bar - edge to edge, draggable */}
      <div 
        className="h-6 bg-background border-b border-border/30 flex items-center justify-center px-3 cursor-move"
        data-tauri-drag-region
      >
        <span className="text-xs text-soft/50 tracking-wide">Notes</span>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex">
        {/* Sidebar toggle */}
        <div className={`w-8 bg-background flex flex-col items-center ${!sidebarVisible ? 'border-r border-border/30' : ''}`}>
          <button 
            onClick={() => setSidebarVisible(!sidebarVisible)}
            className="mt-3 w-5 h-5 flex items-center justify-center text-soft/50 hover:text-soft transition-colors rounded hover:bg-white/5"
            title={sidebarVisible ? "Hide sidebar" : "Show sidebar"}
          >
            {sidebarVisible ? (
              // Collapse icon (chevron left)
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15,18 9,12 15,6"/>
              </svg>
            ) : (
              // Expand icon (chevron right)
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9,18 15,12 9,6"/>
              </svg>
            )}
          </button>
        </div>

      {/* Expandable sidebar */}
      {sidebarVisible && (
        <div className="w-64 bg-card border-r border-border/30 p-4 flex flex-col">
          {/* Header with separator */}
          <div className="pb-3 mb-3 border-b border-border/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                <h2 className="text-sm font-semibold text-foreground">Notes</h2>
              </div>
              <button 
                onClick={createNewNote}
                className="w-5 h-5 flex items-center justify-center text-soft/50 hover:text-primary transition-colors rounded hover:bg-primary/10"
                title="New note"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19"/>
                  <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
              </button>
            </div>
          </div>
          
          {/* Notes list */}
          <div className="space-y-0 flex-1 overflow-y-auto">
            {loading ? (
              <div className="text-xs text-soft/40 p-3">Loading...</div>
            ) : notes.length === 0 ? (
              <div className="text-xs text-soft/40 p-3">No notes yet</div>
            ) : (
              notes.map(note => (
                <div 
                  key={note.id}
                  onClick={() => selectNote(note.id)}
                  className={`group relative mx-1 px-3 py-3 cursor-pointer transition-all duration-200 rounded-lg ${
                    selectedNoteId === note.id 
                      ? 'bg-primary/12 shadow-sm ring-1 ring-primary/25' 
                      : 'hover:bg-background/60'
                  }`}
                >
                  {/* Note title with hierarchy */}
                  <div className={`text-xs truncate pr-6 transition-all ${
                    selectedNoteId === note.id 
                      ? 'text-foreground font-medium' 
                      : 'text-soft/70 font-normal group-hover:text-foreground'
                  }`}>
                    {extractTitleFromContent(note.content)}
                  </div>
                  
                  {/* Date - subtle and right-aligned */}
                  <div className={`absolute right-3 top-2.5 text-xs transition-opacity ${
                    selectedNoteId === note.id 
                      ? 'text-primary/60' 
                      : 'text-soft/30 group-hover:text-soft/40'
                  }`}>
                    {note.updatedAt ? new Date(note.updatedAt).toLocaleDateString('en-US', { 
                      month: 'numeric', 
                      day: 'numeric' 
                    }) : ''}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
      
        {/* Main editor - full focus */}
        <div className="flex-1 flex flex-col">
          {/* Header with mode toggle */}
          {selectedNote && (
            <div className="px-6 py-4 border-b border-border/15 flex items-center justify-between bg-card/30">
              <div className="text-sm text-muted-foreground font-medium">
                {extractTitleFromContent(currentContent)}
              </div>
              <div className="flex items-center gap-3">
                {/* Detach button */}
                <button
                  onClick={async () => {
                    if (isWindowOpen(selectedNote.id)) {
                      await closeWindow(selectedNote.id);
                    } else {
                      await createWindow(selectedNote.id);
                    }
                  }}
                  className="px-3 py-1.5 text-xs font-medium bg-card border border-border/40 rounded-lg shadow-sm text-muted-foreground hover:text-foreground hover:bg-background/40 transition-all duration-200"
                  title={isWindowOpen(selectedNote.id) ? "Close detached window" : "Open in separate window"}
                >
                  {isWindowOpen(selectedNote.id) ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6L6 18M6 6l12 12"/>
                    </svg>
                  ) : (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 9V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v2"/>
                      <path d="M21 15v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2"/>
                      <path d="M9 9h1m4 0h1"/>
                    </svg>
                  )}
                </button>
                
                <div className="flex bg-card border border-border/40 rounded-lg shadow-sm">
                <button
                  onClick={() => setIsPreviewMode(false)}
                  className={`px-3 py-1.5 text-xs font-medium transition-all duration-200 rounded-l-lg ${
                    !isPreviewMode 
                      ? 'bg-primary/15 text-primary shadow-sm' 
                      : 'text-muted-foreground hover:text-foreground hover:bg-background/40'
                  }`}
                >
                  Edit
                </button>
                <button
                  onClick={() => setIsPreviewMode(true)}
                  className={`px-3 py-1.5 text-xs font-medium transition-all duration-200 rounded-r-lg border-l border-border/20 ${
                    isPreviewMode 
                      ? 'bg-primary/15 text-primary shadow-sm' 
                      : 'text-muted-foreground hover:text-foreground hover:bg-background/40'
                  }`}
                >
                  Preview
                </button>
                </div>
              </div>
            </div>
          )}
          
          {/* Editor/Preview area */}
          <div className="flex-1 flex flex-col">
            <div className="flex-1 p-6 pt-4 relative">
              {/* Always-available textarea */}
              <textarea 
                className={`content-font w-full h-full bg-transparent text-foreground resize-none outline-none leading-relaxed placeholder-muted-foreground/40 transition-opacity ${
                  isPreviewMode ? 'absolute inset-0 z-10 opacity-0 pointer-events-none' : 'opacity-100'
                }`}
                style={{ fontSize: '15px', padding: '1rem 0' }}
                placeholder={selectedNote ? "Start writing..." : "Create a new note to start writing..."}
                value={currentContent}
                onChange={(e) => updateNoteContent(e.target.value)}
                disabled={!selectedNote}
                autoFocus={!isPreviewMode}
              />
              
              {/* Preview overlay */}
              {isPreviewMode && selectedNote && (
                <div 
                  className="content-font w-full h-full overflow-y-auto prose prose-invert prose-sm max-w-none cursor-text"
                  onDoubleClick={() => setIsPreviewMode(false)}
                  title="Double-click to edit"
                  style={{ fontSize: '15px', padding: '1rem 0' }}
                >
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {currentContent || '*Empty note*'}
                  </ReactMarkdown>
                </div>
              )}
            </div>
            
            {/* Note-specific footer */}
            {selectedNote && (
              <div className="bg-card/20 border-t border-border/15 px-6 py-3 flex items-center justify-end">
                <div className="flex items-center gap-4 text-xs text-muted-foreground/50 font-light">
                  {currentContent && (
                    <span style={{ fontSize: '10px' }}>
                      {currentContent.split(/\s+/).filter(word => word.length > 0).length} words • {currentContent.length} characters
                    </span>
                  )}
                  <div className="flex items-center gap-1.5">
                    <span style={{ fontSize: '10px' }}>Saved</span>
                    <div className="w-1 h-1 bg-green-500/60 rounded-full"></div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Global IDE-style footer */}
      <div className="h-5 bg-card/40 border-t border-border/25 px-3 flex items-center justify-between text-muted-foreground/60 font-light" style={{ fontSize: '10px' }}>
        <div className="flex items-center gap-4">
          <span>Tauri Notes</span>
          <div className="w-px h-3 bg-border/30"></div>
          <span>{notes.length} {notes.length === 1 ? 'note' : 'notes'}</span>
          {selectedNote && (
            <>
              <div className="w-px h-3 bg-border/30"></div>
              <span>{isPreviewMode ? 'Preview' : 'Edit'} mode</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span className="mono-font">⌘K Command Palette</span>
          <div className="w-px h-3 bg-border/30"></div>
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
    </div>
  );
}

export default App;