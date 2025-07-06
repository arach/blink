import { useEffect, useRef } from 'react';

interface Command {
  id: string;
  title: string;
  description: string;
  action: () => void;
  category: 'note' | 'action' | 'navigation';
}

interface CommandPaletteProps {
  show: boolean;
  query: string;
  selectedIndex: number;
  commands: Command[];
  onQueryChange: (query: string) => void;
  onSelectedIndexChange: (index: number) => void;
  onExecuteCommand: (command: Command) => void;
  onClose: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}

export function CommandPalette({
  show,
  query,
  selectedIndex,
  commands,
  onQueryChange,
  onSelectedIndexChange,
  onExecuteCommand,
  onClose,
  onKeyDown,
}: CommandPaletteProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when command palette opens
  useEffect(() => {
    if (show && inputRef.current) {
      inputRef.current.focus();
    }
  }, [show]);

  if (!show) return null;

  const getCategoryIcon = (category: Command['category']) => {
    switch (category) {
      case 'note':
        return (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14,2 14,8 20,8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <line x1="10" y1="9" x2="8" y2="9"/>
          </svg>
        );
      case 'action':
        return (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9,11 12,14 22,4"/>
            <path d="M21,12v7a2,2,0,0,1-2,2H5a2,2,0,0,1-2-2V5a2,2,0,0,1,2-2h11"/>
          </svg>
        );
      case 'navigation':
        return (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9,18 15,12 9,6"/>
          </svg>
        );
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-start justify-center pt-[20vh]"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-card border border-border/30 rounded-2xl shadow-xl w-[500px] max-w-[90vw] overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-border/20">
          <div className="relative">
            <svg 
              width="16" 
              height="16" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground/60"
            >
              <circle cx="11" cy="11" r="8"/>
              <path d="M21 21l-4.35-4.35"/>
            </svg>
            <input
              ref={inputRef}
              type="text"
              placeholder="Search notes and commands..."
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              onKeyDown={onKeyDown}
              className="w-full pl-10 pr-4 py-2 bg-background border border-border/20 rounded-xl text-sm placeholder-muted-foreground/60 focus:outline-none focus:border-primary/40"
            />
          </div>
        </div>

        {/* Commands List */}
        <div className="max-h-[400px] overflow-y-auto">
          {commands.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground/60 text-sm">
              No commands found
            </div>
          ) : (
            <div className="py-2">
              {commands.map((command, index) => (
                <button
                  key={command.id}
                  onClick={() => onExecuteCommand(command)}
                  className={`w-full text-left px-4 py-2 flex items-center gap-3 transition-colors ${
                    index === selectedIndex
                      ? 'bg-primary/10 text-foreground'
                      : 'text-muted-foreground hover:bg-background/60 hover:text-foreground'
                  }`}
                  onMouseEnter={() => onSelectedIndexChange(index)}
                >
                  <div className="flex-shrink-0 text-muted-foreground/60">
                    {getCategoryIcon(command.category)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {command.title}
                    </div>
                    <div className="text-xs text-muted-foreground/70 truncate">
                      {command.description}
                    </div>
                  </div>
                  {index === selectedIndex && (
                    <div className="flex-shrink-0">
                      <kbd className="px-2 py-0.5 text-xs bg-background/40 border border-border/30 rounded-2xl">
                        ↵
                      </kbd>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-border/20 bg-muted/20">
          <div className="flex items-center justify-between text-xs text-muted-foreground/60">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-background/40 border border-border/30 rounded-2xl">↑</kbd>
                <kbd className="px-1.5 py-0.5 bg-background/40 border border-border/30 rounded-2xl">↓</kbd>
                <span>navigate</span>
              </div>
              <div className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-background/40 border border-border/30 rounded-2xl">↵</kbd>
                <span>select</span>
              </div>
              <div className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-background/40 border border-border/30 rounded-2xl">esc</kbd>
                <span>close</span>
              </div>
            </div>
            <div>
              {commands.length} command{commands.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}