import { Note } from '../../types';
import { MarkdownRenderer } from '../common/MarkdownRenderer';
import { extractTitleFromContent } from '../../lib/utils';
import { CodeMirrorEditor } from '../editor/CodeMirrorEditor';
import { useConfigStore } from '../../stores/config-store';

interface SaveStatus {
  isSaving: boolean;
}

interface EditorAreaProps {
  selectedNote: Note | null;
  currentContent: string;
  isPreviewMode: boolean;
  saveStatus: SaveStatus;
  wordCount: number;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  editorConfig: {
    fontSize?: number;
    editorFontFamily?: string;
    contentFontSize?: number;
    previewFontFamily?: string;
    lineHeight?: number;
    syntaxHighlighting?: boolean;
    notePaperStyle?: 'none' | 'dotted-grid' | 'lines' | 'ruled';
  };
  onContentChange: (content: string) => void;
  onPreviewToggle: () => void;
}

export function EditorArea({
  selectedNote,
  currentContent,
  isPreviewMode,
  saveStatus,
  wordCount,
  textareaRef,
  editorConfig,
  onContentChange,
  onPreviewToggle
}: EditorAreaProps) {
  const { config } = useConfigStore();
  const getPaperStyleClass = (style?: string) => {
    switch (style) {
      case 'dotted-grid':
        return 'note-paper-dotted-grid';
      case 'lines':
        return 'note-paper-lines';
      case 'ruled':
        return 'note-paper-ruled';
      default:
        return '';
    }
  };
  return (
    <div className="flex-1 flex flex-col bg-background">
      {selectedNote ? (
        <>
          {/* Note header with title and preview toggle */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-border/10">
            <h2 className="text-lg font-medium text-foreground/90 truncate flex-1">
              {extractTitleFromContent(currentContent) || 'Untitled'}
            </h2>
            
            {/* Mode toggle */}
            <div className="relative flex items-center gap-1 bg-background/40 border border-border/30 rounded-xl">
              {/* Sliding pill background - positioned absolutely but same z-level as buttons */}
              <div 
                className="absolute bg-primary/20 rounded-xl shadow-sm transition-all duration-200 ease-out pointer-events-none"
                style={{
                  width: isPreviewMode ? '56%' : '44%',
                  height: 'calc(100% + 4px)',
                  top: '-2px',
                  transform: isPreviewMode ? 'translateX(calc(100% - 14px))' : 'translateX(0)'
                }}
              />
              
              <button
                onClick={() => onPreviewToggle()}
                className={`relative px-2 py-1 flex items-center gap-1.5 rounded-xl transition-all duration-200 text-xs font-medium ${
                  !isPreviewMode 
                    ? 'text-primary' 
                    : 'text-muted-foreground/60 hover:text-foreground hover:bg-white/5'
                }`}
                title="Edit mode (⌘⇧P)"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                Edit
              </button>
              <button
                onClick={() => onPreviewToggle()}
                className={`relative px-2 py-1 flex items-center gap-1.5 rounded-xl transition-all duration-200 text-xs font-medium ${
                  isPreviewMode 
                    ? 'text-primary' 
                    : 'text-muted-foreground/60 hover:text-foreground hover:bg-white/5'
                }`}
                title="Preview mode (⌘⇧P)"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
                Preview
              </button>
            </div>
          </div>
          
          {/* Editor area */}
          <div className={`flex-1 relative ${getPaperStyleClass(editorConfig.notePaperStyle)}`}>
            {!isPreviewMode ? (
              <CodeMirrorEditor
                value={currentContent}
                onChange={onContentChange}
                placeholder="Your thoughts, unfiltered..."
                vimMode={config?.appearance?.vimMode || false}
                fontSize={editorConfig.fontSize || 15}
                fontFamily={editorConfig.editorFontFamily || 'system-ui'}
                lineHeight={editorConfig.lineHeight || 1.6}
                typewriterMode={config?.appearance?.typewriterMode || false}
                autoFocus={true}
                className={getPaperStyleClass(editorConfig.notePaperStyle)}
              />
            ) : (
              /* Keep textarea hidden for preview mode to maintain ref */
              <textarea
                ref={textareaRef}
                value={currentContent}
                onChange={(e) => onContentChange(e.target.value)}
                className="sr-only"
                tabIndex={-1}
              />
            )}
            
            {/* Preview overlay */}
            {isPreviewMode && selectedNote && (
              <MarkdownRenderer
                content={currentContent}
                syntaxHighlighting={editorConfig.syntaxHighlighting}
                className={`absolute inset-0 w-full h-full overflow-y-auto prose prose-invert max-w-none cursor-text bg-background z-10 ${getPaperStyleClass(editorConfig.notePaperStyle)}`}
                onDoubleClick={onPreviewToggle}
                title="Double-click to edit"
                style={{ 
                  fontSize: `${editorConfig.contentFontSize || editorConfig.fontSize || 16}px`,
                  fontFamily: editorConfig.previewFontFamily || 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
                  lineHeight: editorConfig.lineHeight || 1.6,
                  padding: '1.25rem' 
                }}
              />
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
                
                {/* Vim mode indicator */}
                {config?.appearance?.vimMode && !isPreviewMode && (
                  <div className="flex items-center gap-1.5 px-2 py-0.5 bg-primary/10 rounded-md">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary/70">
                      <rect x="5" y="4" width="14" height="16" rx="1"/>
                      <path d="M9 8h6"/>
                      <path d="M9 12h6"/>
                      <path d="M9 16h4"/>
                    </svg>
                    <span className="text-xs text-primary/70 font-mono uppercase">Vim</span>
                  </div>
                )}
              </div>
              
              {/* Preview toggle moved to header */}
            </div>
          )}
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center text-muted-foreground/60">
          <p>Select a note to start editing</p>
        </div>
      )}
    </div>
  );
}