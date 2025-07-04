interface ContextMenuProps {
  x: number;
  y: number;
  noteId: string;
  onAction: (action: 'delete' | 'detach', noteId: string) => void;
  onClose: () => void;
}

export function ContextMenu({
  x,
  y,
  noteId,
  onAction,
}: ContextMenuProps) {
  return (
    <div 
      data-context-menu
      className="fixed z-50 bg-card border border-border/30 rounded-lg shadow-xl py-1 min-w-[160px]"
      style={{ 
        left: `${x}px`, 
        top: `${y}px`,
        // Ensure menu stays within viewport
        transform: `translate(${x > window.innerWidth - 200 ? '-100%' : '0'}, ${y > window.innerHeight - 100 ? '-100%' : '0'})`
      }}
    >
      <button
        onClick={() => onAction('detach', noteId)}
        className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-background/60 flex items-center gap-3 transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground/70">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
        </svg>
        Open in Window
      </button>
      
      <div className="h-px bg-border/20 my-1 mx-2" />
      
      <button
        onClick={() => onAction('delete', noteId)}
        className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 flex items-center gap-3 transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-400/70">
          <polyline points="3,6 5,6 21,6"/>
          <path d="M19,6l-1,14a2,2,0,0,1-2,2H8a2,2,0,0,1-2-2L5,6"/>
          <path d="M10,11v6"/>
          <path d="M14,11v6"/>
        </svg>
        Delete Note
      </button>
    </div>
  );
}