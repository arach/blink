import { useState, useMemo } from 'react';
import { ResizablePanel } from '../windows/ResizablePanel';
import { markdownToPlainText, truncateText } from '../../lib/utils';
import { Note } from '../../types';

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
  const [searchQuery, setSearchQuery] = useState('');

  // Filter notes based on search query
  const filteredNotes = useMemo(() => {
    if (!searchQuery.trim()) {
      return notes;
    }
    
    const query = searchQuery.toLowerCase();
    return notes.filter(note => 
      note.title.toLowerCase().includes(query) ||
      markdownToPlainText(note.content).toLowerCase().includes(query)
    );
  }, [notes, searchQuery]);
  if (!sidebarVisible) {
    return (
      <div className="w-0 h-full overflow-hidden" data-notes-sidebar />
    );
  }

  return (
    <ResizablePanel
      defaultWidth={320}
      minWidth={240}
      maxWidth={480}
      className="h-full"
    >
      <div className="h-full bg-card border-r border-border/30 flex flex-col" data-notes-sidebar>
          {/* Header - Standardized 76px height */}
          <div className="h-[76px] flex flex-col justify-center px-4 border-b border-border/20 pt-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 pt-1">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-primary/70">
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
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg transition-colors"
                title="New note (⌘N)"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <line x1="12" y1="5" x2="12" y2="19"/>
                  <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
              </button>
            </div>
            
            {/* Search */}
            <div className="relative">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground/60">
                <circle cx="11" cy="11" r="8"/>
                <path d="M21 21l-4.35-4.35"/>
              </svg>
              <input
                type="text"
                placeholder="Search notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-1.5 bg-background border border-border/20 rounded-lg text-xs placeholder-muted-foreground/60 focus:outline-none focus:border-primary/40"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-muted-foreground/60 hover:text-foreground transition-colors"
                  title="Clear search"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Notes List */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden">
            {loading ? (
              <div className="p-4 text-center text-muted-foreground/60 text-sm">
                Loading your thoughts...
              </div>
            ) : filteredNotes.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground/60 text-sm">
                <div className="space-y-1">
                  {searchQuery.trim() ? (
                    <>
                      <div>No notes found</div>
                      <div className="text-xs text-muted-foreground/40">Try a different search term</div>
                    </>
                  ) : (
                    <>
                      <div>Your workspace awaits ✨</div>
                      <div className="text-xs text-muted-foreground/40">Press ⌘N to create your first note</div>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col">
                {filteredNotes.map((note, index) => {
                  return (
                  <div
                    key={note.id}
                    className={`group relative cursor-pointer transition-all ${
                      selectedNoteId === note.id
                        ? 'bg-primary/10 border-l-4 border-l-primary ml-0 pl-4 pr-4 py-3'
                        : 'hover:bg-background/50 border-l-4 border-l-transparent ml-1 pl-3 pr-4 py-3'
                    } ${index > 0 ? 'border-t border-border/10' : ''}`}
                    onClick={() => onSelectNote(note.id)}
                    onContextMenu={(e) => onShowContextMenu(e.clientX, e.clientY, note.id)}
                    onMouseDown={(e) => {
                      if (e.button === 0) { // Left click only
                        onStartDrag(e, note.id);
                      }
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-2">
                          <h3 className={`text-sm font-medium leading-tight transition-colors flex-1 ${
                            selectedNoteId === note.id 
                              ? 'text-primary' 
                              : 'text-foreground/90 group-hover:text-foreground'
                          }`}>
                            {note.title || 'Untitled'}
                          </h3>
                          {isWindowOpen(note.id) && (
                            <div className="w-1 h-1 rounded-full bg-primary/40 mt-2" title="Open in window" />
                          )}
                        </div>
                        
                        {showNotePreviews && note.content && (
                          <p className="text-xs text-muted-foreground/50 mt-1.5 line-clamp-2 leading-relaxed">
                            {truncateText(markdownToPlainText(note.content), 120)}
                          </p>
                        )}
                      </div>
                      
                      {/* Actions */}
                      <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteNote(note.id);
                          }}
                          className="text-muted-foreground/40 hover:text-red-400 p-1 rounded transition-colors"
                          title="Delete note"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 6h18"/>
                            <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/>
                            <path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                );
                })}
              </div>
            )}
          </div>
      </div>
    </ResizablePanel>
  );
}