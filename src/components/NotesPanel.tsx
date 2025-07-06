import { ResizablePanel } from './ResizablePanel';
import { markdownToPlainText, truncateText } from '../lib/utils';

interface Note {
  id: string;
  title: string;
  content: string;
  updatedAt?: string;
}

interface NotesPanelProps {
  sidebarVisible: boolean;
  notes: Note[];
  selectedNoteId: string | null;
  loading: boolean;
  showNotePreviews?: boolean;
  onCreateNewNote: () => void;
  onSelectNote: (noteId: string) => void;
  onDeleteNote: (noteId: string) => void;
  onShowContextMenu: (x: number, y: number, noteId: string) => void;
  onStartDrag: (e: React.MouseEvent, noteId: string) => void;
  isWindowOpen: (noteId: string) => boolean;
}

export function NotesPanel({
  sidebarVisible,
  notes,
  selectedNoteId,
  loading,
  showNotePreviews,
  onCreateNewNote,
  onSelectNote,
  onDeleteNote,
  onShowContextMenu,
  onStartDrag,
  isWindowOpen
}: NotesPanelProps) {
  return (
    <div className={`h-full overflow-hidden transition-all duration-300 ease-out ${
      sidebarVisible ? 'w-80' : 'w-0'
    }`}>
      <ResizablePanel defaultWidth={320} minWidth={240} maxWidth={400}>
        <div className="h-full bg-card border-r border-border/30 flex flex-col">
          {/* Header - Standardized 76px height */}
          <div className="h-[76px] flex flex-col justify-center px-4 border-b border-border/20 pt-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 pt-1">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary/70">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14,2 14,8 20,8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                  <line x1="10" y1="9" x2="8" y2="9"/>
                </svg>
                <h2 className="text-sm font-medium text-foreground">Notes</h2>
              </div>
              <button
                onClick={onCreateNewNote}
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
                className="w-full pl-9 pr-3 py-1.5 bg-background border border-border/20 rounded text-xs placeholder-muted-foreground/60 focus:outline-none focus:border-primary/40"
              />
            </div>
          </div>

          {/* Notes List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-muted-foreground/60 text-sm">
                Loading your thoughts...
              </div>
            ) : notes.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground/60 text-sm">
                <div className="space-y-1">
                  <div>Your workspace awaits ✨</div>
                  <div className="text-xs text-muted-foreground/40">Press ⌘N to create your first note</div>
                </div>
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
                    onClick={() => onSelectNote(note.id)}
                    onContextMenu={(e) => onShowContextMenu(e.clientX, e.clientY, note.id)}
                    onMouseDown={(e) => {
                      if (e.button === 0) { // Left click only
                        onStartDrag(e, note.id);
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
                        
                        {showNotePreviews && (
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
                            onDeleteNote(note.id);
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
  );
}