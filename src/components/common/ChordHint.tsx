interface ChordHintProps {
  mode: 'none' | 'note' | 'window';
  visible: boolean;
  notes: Array<{ id: string; title: string }>;
}

export function ChordHint({ mode, visible, notes }: ChordHintProps) {
  if (!visible || mode === 'none') return null;

  const noteCommands = [
    { key: '1-9', desc: 'Select note' },
    { key: 'N', desc: 'New note' },
    { key: 'S', desc: 'Search' },
  ];

  const windowCommands = [
    { key: '1-9', desc: 'Focus/open window' },
  ];

  const commands = mode === 'note' ? noteCommands : windowCommands;

  return (
    <div className="fixed top-4 right-4 z-50 bg-background/95 backdrop-blur-sm border border-border/30 rounded-2xl p-4 shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
        <span className="text-sm font-semibold text-foreground">
          {mode === 'note' ? 'Note Mode' : 'Window Mode'}
        </span>
      </div>
      
      <div className="space-y-2">
        {commands.map((cmd, i) => (
          <div key={i} className="flex items-center justify-between gap-4 text-xs">
            <kbd className="px-2 py-1 bg-muted/50 border border-border/20 rounded-xl font-mono font-medium text-foreground/80">
              {cmd.key}
            </kbd>
            <span className="text-muted-foreground">{cmd.desc}</span>
          </div>
        ))}
      </div>
      
      {mode === 'note' && (
        <div className="mt-3 pt-3 border-t border-border/20">
          <div className="text-xs text-muted-foreground/70 mb-2">Available notes:</div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {notes.slice(0, 9).map((note, i) => (
              <div key={note.id} className="flex items-center gap-2 text-xs">
                <kbd className="w-6 h-6 flex items-center justify-center bg-muted/30 border border-border/20 rounded text-[10px] font-mono font-medium">
                  {i + 1}
                </kbd>
                <span className="text-foreground/70 truncate">{note.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      <div className="mt-3 pt-2 border-t border-border/20 text-xs text-muted-foreground/60 text-center">
        3s timeout • ESC to cancel
      </div>
    </div>
  );
}