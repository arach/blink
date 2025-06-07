import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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
  const [note, setNote] = useState<Note | null>(null);
  const [content, setContent] = useState('');
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const appWindow = getCurrentWebviewWindow();

  // Extract title from markdown content
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

  useEffect(() => {
    loadNote();
  }, [noteId]);

  useEffect(() => {
    // Update window title when content changes
    if (note) {
      const title = extractTitleFromContent(content);
      appWindow.setTitle(`${title} - Detached Note`);
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
        const extractedTitle = extractTitleFromContent(newContent);
        
        const updatedNote = await invoke<Note>('update_note', {
          id: noteId,
          request: {
            title: extractedTitle,
            content: newContent
          }
        });
        
        if (updatedNote) {
          setNote(updatedNote);
        }
      } catch (error) {
        console.error('Failed to update note:', error);
      }
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    // Cmd+Shift+P to toggle preview mode
    if (e.metaKey && e.shiftKey && e.key === 'P') {
      e.preventDefault();
      setIsPreviewMode(!isPreviewMode);
    }

    // Cmd+W to close window
    if (e.metaKey && e.key === 'w') {
      e.preventDefault();
      appWindow.close();
    }
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPreviewMode]);

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
      className="w-full h-full text-foreground flex flex-col bg-background/95"
      style={{ background: 'rgba(18, 19, 23, 0.95)' }}
    >
      {/* Ultra-thin top bar - draggable */}
      <div 
        className="h-6 bg-background/80 border-b border-border/30 flex items-center justify-between px-3 cursor-move"
        data-tauri-drag-region
      >
        <span className="text-xs text-soft/50 tracking-wide truncate flex-1">
          {extractTitleFromContent(content)}
        </span>
        
        <div className="flex items-center gap-2">
          {/* Mode toggle */}
          <div className="flex bg-card/30 border border-border/40 rounded shadow-sm">
            <button
              onClick={() => setIsPreviewMode(false)}
              className={`px-2 py-0.5 text-xs font-medium transition-all duration-200 rounded-l ${
                !isPreviewMode 
                  ? 'bg-primary/15 text-primary' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/40'
              }`}
            >
              Edit
            </button>
            <button
              onClick={() => setIsPreviewMode(true)}
              className={`px-2 py-0.5 text-xs font-medium transition-all duration-200 rounded-r border-l border-border/20 ${
                isPreviewMode 
                  ? 'bg-primary/15 text-primary' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/40'
              }`}
            >
              Preview
            </button>
          </div>

          {/* Close button */}
          <button
            onClick={() => appWindow.close()}
            className="w-4 h-4 flex items-center justify-center text-soft/30 hover:text-red-400 transition-colors rounded hover:bg-red-500/10"
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
      <div className="flex-1 flex flex-col">
        <div className="flex-1 p-4 relative">
          {/* Editor */}
          <textarea 
            className={`content-font w-full h-full bg-transparent text-foreground resize-none outline-none leading-relaxed placeholder-muted-foreground/40 transition-opacity ${
              isPreviewMode ? 'absolute inset-0 z-10 opacity-0 pointer-events-none' : 'opacity-100'
            }`}
            style={{ fontSize: '14px', padding: '0' }}
            placeholder="Start writing..."
            value={content}
            onChange={(e) => updateNoteContent(e.target.value)}
            autoFocus={!isPreviewMode}
          />
          
          {/* Preview overlay */}
          {isPreviewMode && (
            <div 
              className="content-font w-full h-full overflow-y-auto prose prose-invert prose-sm max-w-none cursor-text"
              onDoubleClick={() => setIsPreviewMode(false)}
              title="Double-click to edit"
              style={{ fontSize: '14px', padding: '0' }}
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {content || '*Empty note*'}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-card/20 border-t border-border/15 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs text-muted-foreground/50">
            {content && (
              <span style={{ fontSize: '10px' }}>
                {content.split(/\s+/).filter(word => word.length > 0).length} words
              </span>
            )}
            <div className="flex items-center gap-1">
              <span style={{ fontSize: '10px' }}>Saved</span>
              <div className="w-1 h-1 bg-green-500/60 rounded-full"></div>
            </div>
          </div>
          
          <div className="text-xs text-muted-foreground/40">
            ⌘⇧P Preview • ⌘W Close
          </div>
        </div>
      </div>
    </div>
  );
}