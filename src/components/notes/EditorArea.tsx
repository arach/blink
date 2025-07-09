import { Note } from '../../types';
import { MarkdownRenderer } from '../common/MarkdownRenderer';

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
          {/* Editor area */}
          <div className={`flex-1 relative ${getPaperStyleClass(editorConfig.notePaperStyle)}`}>
            <textarea
              ref={textareaRef}
              value={currentContent}
              onChange={(e) => onContentChange(e.target.value)}
              placeholder="Your thoughts, unfiltered..."
              className="w-full h-full resize-none bg-transparent border-none outline-none p-5 text-foreground placeholder-muted-foreground/50 scrollbar-thin"
              style={{
                fontSize: `${editorConfig.fontSize || 15}px`,
                fontFamily: editorConfig.editorFontFamily || 'system-ui',
                lineHeight: editorConfig.lineHeight || 1.6,
              }}
            />
            
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
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={onPreviewToggle}
                  className={`px-3 py-1.5 text-xs rounded-2xl transition-all duration-200 font-medium ${
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
  );
}