import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { useDetachedWindowsStore } from '../stores/detached-windows-store';
import { useConfigStore } from '../stores/config-store';
import { useSaveStatus } from '../hooks/use-save-status';
import { useWindowShade } from '../hooks/use-window-shade';
import { useWindowTracking } from '../hooks/use-window-tracking';
import { noteSyncService, useNoteSync } from '../services/note-sync';
import { CustomTitleBar } from './CustomTitleBar';
import { WindowWrapper } from './WindowWrapper';

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
  const isShaded = useWindowShade();
  
  // Track window position/size changes with proper debouncing
  useWindowTracking(noteId);

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
    console.log('[DETACHED-WINDOW] Closing window for note:', noteId);
    try {
      // Update the detached windows store to remove this window
      console.log('[DETACHED-WINDOW] Updating store...');
      await closeWindow(noteId);
      console.log('[DETACHED-WINDOW] Store updated, closing window...');
      // Close the actual window
      await appWindow.close();
      console.log('[DETACHED-WINDOW] Window close command sent');
    } catch (error) {
      console.error('[DETACHED-WINDOW] Failed to close window:', error);
      // Fallback: just close the window
      console.log('[DETACHED-WINDOW] Attempting fallback close...');
      await appWindow.close();
    }
  };

  useEffect(() => {
    console.log('[DETACHED-WINDOW] Setting up keyboard event listeners for note:', noteId);
    
    // Define the keyboard handler inside useEffect to avoid stale closures
    const handleKeyDown = (e: KeyboardEvent) => {
      // Log all Cmd key combinations for debugging
      if (e.metaKey) {
        console.log('[DETACHED-WINDOW] Cmd key combo detected:', {
          key: e.key,
          shiftKey: e.shiftKey,
          altKey: e.altKey,
          ctrlKey: e.ctrlKey
        });
      }

      // Cmd+Shift+P to toggle preview mode
      if (e.metaKey && e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        console.log('[DETACHED-WINDOW] Toggling preview mode');
        setIsPreviewMode(prev => !prev);
      }

      // Cmd+W to close window
      if (e.metaKey && e.key.toLowerCase() === 'w') {
        e.preventDefault();
        e.stopPropagation(); // Stop event from bubbling
        console.log('[DETACHED-WINDOW] Cmd+W pressed, closing window...');
        
        // Ensure we're in the right window context
        if (window.location.search.includes(`note=${noteId}`)) {
          console.log('[DETACHED-WINDOW] Confirmed this is the correct window');
          // Call handleCloseWindow asynchronously to avoid blocking
          handleCloseWindow().catch(error => {
            console.error('[DETACHED-WINDOW] Error closing window:', error);
            // Ensure window closes even if there's an error
            appWindow.close().catch(() => {});
          });
        } else {
          console.warn('[DETACHED-WINDOW] Window context mismatch, ignoring Cmd+W');
        }
      }
    };

    // Add event listener with capture phase to ensure we get the event first
    window.addEventListener('keydown', handleKeyDown, true);
    // Also add to document to ensure we catch it
    document.addEventListener('keydown', handleKeyDown, true);
    
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
    
    // Log when listeners are being removed
    return () => {
      console.log('[DETACHED-WINDOW] Removing keyboard event listeners for note:', noteId);
      window.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('beforeunload', handleWindowClose);
    };
  }, [noteId, closeWindow, appWindow]);

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

  // Mode toggle component for the title bar
  const modeToggle = (
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
  );

  // Calculate word count
  const wordCount = content.split(/\s+/).filter(word => word.length > 0).length;

  return (
    <WindowWrapper className="detached-note-window">
      <CustomTitleBar 
        title={extractTitleFromContent(content)}
        noteId={noteId}
        rightContent={!isShaded ? modeToggle : undefined}
        onClose={handleCloseWindow}
        isShaded={isShaded}
        stats={{
          wordCount,
          lastSaved: saveStatus.lastSaved ? saveStatus.getRelativeTime || undefined : undefined
        }}
      />

      {/* Content area - hide when shaded */}
      {!isShaded && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className={`flex-1 p-6 pt-5 relative overflow-hidden ${
          config.appearance?.backgroundPattern && config.appearance?.backgroundPattern !== 'none' 
            ? `bg-pattern-${config.appearance?.backgroundPattern}` 
            : ''
        }`}>
          {/* Editor */}
          <textarea 
            className={`w-full h-full bg-transparent text-foreground resize-none outline-none placeholder-muted-foreground/40 transition-opacity ${
              isPreviewMode ? 'absolute inset-0 z-10 opacity-0 pointer-events-none' : 'opacity-100'
            }`}
            style={{ 
              fontSize: `${config.appearance?.fontSize || 15}px`,
              fontFamily: config.appearance?.editorFontFamily || 'system-ui',
              lineHeight: config.appearance?.lineHeight || 1.6,
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
              className="w-full h-full overflow-y-auto prose prose-invert max-w-none cursor-text"
              onDoubleClick={() => setIsPreviewMode(false)}
              title="Double-click to edit"
              style={{ 
                fontSize: `${config.appearance?.contentFontSize || config.appearance?.fontSize || 16}px`,
                fontFamily: config.appearance?.previewFontFamily || 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
                lineHeight: config.appearance?.lineHeight || 1.6,
                padding: '1.5rem' 
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
                  code: ({inline, children}: {inline?: boolean, children?: React.ReactNode}) => (
                    inline ?
                      <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">{children}</code> :
                      <code className="block">{children}</code>
                  ),
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
      )}
    </WindowWrapper>
  );
}