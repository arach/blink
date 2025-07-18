import { useState } from 'react';
import { Note } from '../../types';
import { extractTitleFromContent } from '../../lib/utils';
import { useConfigStore } from '../../stores/config-store';
import { NoteEditor, VimModeIndicator, type VimStatus, type EditorConfig } from '../editor/NoteEditor';

interface SaveStatus {
  isSaving: boolean;
  lastSaved?: Date | null;
  isModified?: boolean;
  saveError?: string | null;
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
  const [vimStatus, setVimStatus] = useState<VimStatus>({ mode: 'NORMAL' });
  // const [lastSavedContent, setLastSavedContent] = useState<string | null>(null);
  // Create a unified config object for NoteEditor
  const noteEditorConfig: EditorConfig = {
    fontSize: editorConfig.fontSize || 15,
    fontFamily: editorConfig.editorFontFamily || 'system-ui',
    lineHeight: editorConfig.lineHeight || 1.6,
    editorFontFamily: editorConfig.editorFontFamily,
    previewFontFamily: editorConfig.previewFontFamily,
    contentFontSize: editorConfig.contentFontSize,
    syntaxHighlighting: editorConfig.syntaxHighlighting,
    vimMode: config?.appearance?.vimMode,
    typewriterMode: config?.appearance?.typewriterMode,
    wordWrap: config?.appearance?.wordWrap,
    notePaperStyle: editorConfig.notePaperStyle
  };

  // Header component with mode toggle
  const renderHeader = () => (
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
  );

  // Footer component
  const renderFooter = () => (
    <div className="status-footer bg-background/90 border-t border-border/30 px-6 h-6 flex items-center justify-between backdrop-blur-sm">
      <div className="flex items-center gap-3">
        {/* Save status */}
        <div className="flex items-center gap-1.5">
          {saveStatus.isSaving ? (
            <>
              <span className="text-xs text-muted-foreground/50" style={{ fontSize: '10px' }}>Saving...</span>
              <div className="w-1 h-1 bg-yellow-500/60 rounded-full animate-pulse"></div>
            </>
          ) : saveStatus.isModified ? (
            <>
              <span className="text-xs text-muted-foreground/50" style={{ fontSize: '10px' }}>Modified</span>
              <div className="w-1 h-1 bg-orange-500/60 rounded-full"></div>
            </>
          ) : saveStatus.saveError ? (
            <>
              <span className="text-xs text-muted-foreground/50" style={{ fontSize: '10px' }}>Error saving</span>
              <div className="w-1 h-1 bg-red-500/60 rounded-full"></div>
            </>
          ) : saveStatus.lastSaved ? (
            <>
              <span className="text-xs text-muted-foreground/50" style={{ fontSize: '10px' }}>Saved</span>
              <div className="w-1 h-1 bg-green-500/60 rounded-full"></div>
            </>
          ) : (
            <>
              <span className="text-xs text-muted-foreground/50" style={{ fontSize: '10px' }}>Ready</span>
              <div className="w-1 h-1 bg-gray-500/60 rounded-full"></div>
            </>
          )}
        </div>
        
        {/* Vim mode indicator */}
        {config?.appearance?.vimMode && !isPreviewMode && (
          <VimModeIndicator vimStatus={vimStatus} />
        )}
      </div>
      
      {/* Word count */}
      <div className="text-xs text-muted-foreground/60 font-medium">
        {wordCount} words
      </div>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col bg-background">
      {selectedNote ? (
        <NoteEditor
          content={currentContent}
          onContentChange={onContentChange}
          isPreviewMode={isPreviewMode}
          onPreviewToggle={onPreviewToggle}
          config={noteEditorConfig}
          vimStatus={vimStatus}
          onVimStatusChange={setVimStatus}
          placeholder="Your thoughts, unfiltered..."
          autoFocus={true}
          textareaRef={textareaRef}
          renderHeader={renderHeader}
          renderFooter={renderFooter}
          previewClassName="absolute inset-0 bg-background z-10"
        />
      ) : (
        <div className="flex-1 flex items-center justify-center text-muted-foreground/60">
          <p>Select a note to start editing</p>
        </div>
      )}
    </div>
  );
}