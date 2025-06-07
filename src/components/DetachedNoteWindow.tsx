import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useDetachedWindowsStore } from '../stores/detached-windows-store';
import { useConfigStore } from '../stores/config-store';
import { useSaveStatus } from '../hooks/use-save-status';
import { noteSyncService, useNoteSync } from '../services/note-sync';

interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
}

interface DetachedNoteWindowProps {
  noteId: string;
}

export function DetachedNoteWindow({ noteId }: DetachedNoteWindowProps) {
  const { config } = useConfigStore();
  const [note, setNote] = useState<Note | null>(null);
  const [content, setContent] = useState('');
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const appWindow = getCurrentWebviewWindow();
  const { closeWindow } = useDetachedWindowsStore();
  const saveStatus = useSaveStatus();

  // Real-time sync for this note
  useNoteSync(noteId, (updatedNote) => {
    setNote(updatedNote);
    setContent(updatedNote.content);
  });

  // Extract title from markdown content
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

  useEffect(() => {
    loadNote();
  }, [noteId]);

  useEffect(() => {
    // Update window title when content changes
    if (note) {
      const title = extractTitleFromContent(content);
      appWindow.setTitle(title);
    }
  }, [content, note, appWindow]);

  const loadNote = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const loadedNote = await invoke<Note>('get_note', { id: noteId });
      
      if (loadedNote) {
        setNote(loadedNote);
        setContent(loadedNote.content);
      } else {
        setError('Note not found');
      }
    } catch (err) {
      setError(err as string);
    } finally {
      setLoading(false);
    }
  };

  const updateNoteContent = async (newContent: string) => {
    setContent(newContent);
    
    if (note) {
      try {
        saveStatus.startSaving();
        
        const updatedNote = await invoke<Note>('update_note', {
          id: noteId,
          request: {
            content: newContent
          }
        });
        
        if (updatedNote) {
          setNote(updatedNote);
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

  const handleCloseWindow = async () => {
    try {
      // Update the detached windows store to remove this window
      await closeWindow(noteId);
      // Close the actual window
      await appWindow.close();
    } catch (error) {
      console.error('Failed to close window:', error);
      // Fallback: just close the window
      await appWindow.close();
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    // Cmd+Shift+P to toggle preview mode
    if (e.metaKey && e.shiftKey && e.key.toLowerCase() === 'p') {
      e.preventDefault();
      setIsPreviewMode(!isPreviewMode);
    }

    // Cmd+W to close window
    if (e.metaKey && e.key.toLowerCase() === 'w') {
      e.preventDefault();
      handleCloseWindow();
    }
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    
    // Listen for window close events to clean up state
    const handleWindowClose = async () => {
      try {
        await closeWindow(noteId);
      } catch (error) {
        console.error('Failed to update window state on close:', error);
      }
    };

    // Set up beforeunload handler to clean up state
    window.addEventListener('beforeunload', handleWindowClose);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('beforeunload', handleWindowClose);
    };
  }, [isPreviewMode, noteId, closeWindow]);

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-background text-foreground">
        <div className="text-sm text-muted-foreground">Loading note...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-background text-foreground">
        <div className="text-sm text-red-400">Error: {error}</div>
      </div>
    );
  }

  if (!note) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-background text-foreground">
        <div className="text-sm text-muted-foreground">Note not found</div>
      </div>
    );
  }

  return (
    <div 
      className="w-full h-full text-foreground flex flex-col bg-background"
    >
      {/* Ultra-thin top bar - draggable */}
      <div 
        className="h-7 bg-background/80 border-b border-border/30 flex items-center justify-between px-3 cursor-move"
        data-tauri-drag-region
      >
        <div className="flex-1 cursor-move" data-tauri-drag-region></div>
        
        <div className="flex items-center gap-2 cursor-default">
          {/* Mode toggle */}
          <div className="flex items-center bg-background/40 border border-border/30 rounded-md">
            <button
              onClick={() => setIsPreviewMode(false)}
              className={`w-5 h-4 flex items-center justify-center rounded-sm transition-all duration-200 ${
                !isPreviewMode 
                  ? 'bg-primary/25 text-primary shadow-sm' 
                  : 'text-muted-foreground/60 hover:text-foreground hover:bg-white/5'
              }`}
              title="Edit mode"
            >
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button
              onClick={() => setIsPreviewMode(true)}
              className={`w-5 h-4 flex items-center justify-center rounded-sm transition-all duration-200 ${
                isPreviewMode 
                  ? 'bg-primary/25 text-primary shadow-sm' 
                  : 'text-muted-foreground/60 hover:text-foreground hover:bg-white/5'
              }`}
              title="Preview mode"
            >
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </button>
          </div>

          {/* Close button */}
          <button
            onClick={handleCloseWindow}
            className="w-5 h-5 flex items-center justify-center text-soft/30 hover:text-red-400 transition-colors rounded hover:bg-red-500/10"
            title="Close window (⌘W)"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 p-6 pt-5 relative overflow-hidden">
          {/* Editor */}
          <textarea 
            className={`w-full h-full bg-transparent text-foreground resize-none outline-none placeholder-muted-foreground/40 transition-opacity ${
              isPreviewMode ? 'absolute inset-0 z-10 opacity-0 pointer-events-none' : 'opacity-100'
            }`}
            style={{ 
              fontSize: `${config.appearance.fontSize}px`,
              fontFamily: config.appearance.editorFontFamily,
              lineHeight: config.appearance.lineHeight,
              padding: '0' 
            }}
            placeholder="Start writing..."
            value={content}
            onChange={(e) => updateNoteContent(e.target.value)}
            autoFocus={!isPreviewMode}
          />
          
          {/* Preview overlay */}
          {isPreviewMode && (
            <div 
              className="w-full h-full overflow-y-auto prose prose-invert prose-sm max-w-none cursor-text"
              onDoubleClick={() => setIsPreviewMode(false)}
              title="Double-click to edit"
              style={{ 
                fontSize: `${config.appearance.fontSize}px`,
                fontFamily: config.appearance.editorFontFamily,
                lineHeight: config.appearance.lineHeight,
                padding: '0' 
              }}
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {content || '*Empty note*'}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-card/20 border-t border-border/15 px-4 py-2 flex items-center justify-between">
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
          
          {content && (
            <span className="text-xs text-muted-foreground/40 font-light" style={{ fontSize: '10px' }}>
              {content.split(/\s+/).filter(word => word.length > 0).length} words
            </span>
          )}
        </div>
      </div>
    </div>
  );
}