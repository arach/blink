import React from 'react';
import { CodeMirrorEditor } from './CodeMirrorEditor';
import { MarkdownRenderer } from '../common/MarkdownRenderer';

// Shared utility function for paper styles
export const getPaperStyleClass = (style?: string) => {
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

export interface EditorConfig {
  fontSize: number;
  fontFamily?: string;
  lineHeight: number;
  editorFontFamily?: string;
  previewFontFamily?: string;
  contentFontSize?: number;
  syntaxHighlighting?: boolean;
  vimMode?: boolean;
  typewriterMode?: boolean;
  backgroundPattern?: string;
  notePaperStyle?: string;
}

export interface VimStatus {
  mode: string;
  subMode?: string;
}

export interface NoteEditorProps {
  // Content
  content: string;
  onContentChange: (content: string) => void;
  
  // Preview mode
  isPreviewMode: boolean;
  onPreviewToggle?: () => void;
  
  // Configuration
  config: EditorConfig;
  
  // Vim mode
  vimStatus?: VimStatus;
  onVimStatusChange?: (status: VimStatus) => void;
  
  // Optional props
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
  textareaRef?: React.RefObject<HTMLTextAreaElement>;
  
  // Render props for custom UI elements
  renderHeader?: () => React.ReactNode;
  renderFooter?: () => React.ReactNode;
  
  // Style options
  editorClassName?: string;
  previewClassName?: string;
}

export function NoteEditor({
  content,
  onContentChange,
  isPreviewMode,
  onPreviewToggle,
  config,
  onVimStatusChange,
  placeholder = "Start writing...",
  autoFocus = false,
  className = "",
  textareaRef,
  renderHeader,
  renderFooter,
  editorClassName = "",
  previewClassName = ""
}: NoteEditorProps) {
  // Shared paper style logic
  const paperStyleClass = getPaperStyleClass(config.notePaperStyle);
  
  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Optional custom header */}
      {renderHeader && renderHeader()}
      
      {/* Editor/Preview area */}
      <div className={`flex-1 relative overflow-hidden ${
        config.backgroundPattern && config.backgroundPattern !== 'none' 
          ? `bg-pattern-${config.backgroundPattern}` 
          : ''
      } ${paperStyleClass} ${editorClassName}`}>
        {!isPreviewMode ? (
          <>
            <CodeMirrorEditor
              value={content}
              onChange={onContentChange}
              placeholder={placeholder}
              vimMode={config.vimMode || false}
              fontSize={config.fontSize}
              fontFamily={config.editorFontFamily || config.fontFamily || 'system-ui'}
              lineHeight={config.lineHeight}
              typewriterMode={config.typewriterMode || false}
              autoFocus={autoFocus}
              className={paperStyleClass}
              onVimStatusChange={onVimStatusChange}
            />
            {/* Hidden textarea for maintaining ref compatibility */}
            {textareaRef && (
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => onContentChange(e.target.value)}
                className="sr-only"
                tabIndex={-1}
              />
            )}
          </>
        ) : (
          <MarkdownRenderer
            content={content}
            syntaxHighlighting={config.syntaxHighlighting}
            className={`w-full h-full overflow-y-auto prose prose-invert max-w-none cursor-text ${paperStyleClass} ${previewClassName}`}
            onDoubleClick={onPreviewToggle}
            title="Double-click to edit"
            style={{ 
              fontSize: `${config.contentFontSize || config.fontSize || 16}px`,
              fontFamily: config.previewFontFamily || 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
              lineHeight: config.lineHeight || 1.6,
              padding: '1.5rem'
            }}
          />
        )}
      </div>
      
      {/* Optional custom footer */}
      {renderFooter && renderFooter()}
    </div>
  );
}

// Vim mode indicator component for reuse
export interface VimModeIndicatorProps {
  vimStatus: VimStatus;
  className?: string;
}

export function VimModeIndicator({ vimStatus, className = "" }: VimModeIndicatorProps) {
  return (
    <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md ${
      vimStatus.mode === 'INSERT' ? 'bg-green-500/10' : 
      vimStatus.mode === 'VISUAL' ? 'bg-purple-500/10' : 
      'bg-primary/10'
    } ${className}`}>
      <div className={`w-1.5 h-1.5 rounded-full ${
        vimStatus.mode === 'INSERT' ? 'bg-green-500' : 
        vimStatus.mode === 'VISUAL' ? 'bg-purple-500' : 
        'bg-primary'
      }`} />
      <span className={`text-xs font-mono ${
        vimStatus.mode === 'INSERT' ? 'text-green-500/70' : 
        vimStatus.mode === 'VISUAL' ? 'text-purple-500/70' : 
        'text-primary/70'
      }`}>
        {vimStatus.mode}
      </span>
    </div>
  );
}