import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';

interface Note {
  id: string;
  title: string;
  content: string;
  updatedAt?: string;
}

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
  return (
    <div className="flex-1 flex flex-col bg-background">
      {selectedNote ? (
        <>
          {/* Editor area */}
          <div className="flex-1 relative">
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
              <div 
                className="absolute inset-0 w-full h-full overflow-y-auto prose prose-invert max-w-none cursor-text bg-background z-10"
                onDoubleClick={onPreviewToggle}
                title="Double-click to edit"
                style={{ 
                  fontSize: `${editorConfig.contentFontSize || editorConfig.fontSize || 16}px`,
                  fontFamily: editorConfig.previewFontFamily || 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
                  lineHeight: editorConfig.lineHeight || 1.6,
                  padding: '1.25rem' 
                }}
              >
                <ReactMarkdown 
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={editorConfig.syntaxHighlighting ? [rehypeHighlight] : []}
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
                        <code className="bg-muted px-1.5 py-0.5 rounded-xl text-sm font-mono">{children}</code> :
                        <code className="block">{children}</code>
                    ),
                    pre: ({children}) => (
                      <pre className="bg-muted/50 border border-border/30 rounded-2xl p-4 overflow-x-auto my-4">
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