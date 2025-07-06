import { Palette, Eye, Focus, Keyboard, Pin, Folder } from 'lucide-react';

interface Theme {
  name: string;
  colors?: {
    accent?: string;
  };
}

interface AppConfig {
  appearance?: {
    windowOpacity?: number;
    focusMode?: boolean;
    typewriterMode?: boolean;
  };
  alwaysOnTop?: boolean;
}

interface AppFooterProps {
  theme: Theme | null;
  themeId: string;
  config: AppConfig;
}

export function AppFooter({ theme, themeId, config }: AppFooterProps) {
  return (
    <footer className="app-footer w-full bg-background/90 border-t border-border/30 px-3 flex items-center justify-between text-xs text-muted-foreground/80 h-6 min-h-[1.5rem] gap-4 select-none">
      <div className="flex items-center gap-3">
        {/* Theme swatch and name */}
        <span className="flex items-center gap-1">
          <Palette className="w-4 h-4 text-primary/80 flex-shrink-0" />
          <span 
            className="w-3 h-3 rounded-full border border-border/40 mr-1 flex-shrink-0" 
            style={{ backgroundColor: theme ? theme.colors?.accent || '#3b82f6' : '#3b82f6' }} 
          />
          {theme ? theme.name : themeId}
        </span>
        
        {/* Opacity */}
        {typeof config.appearance?.windowOpacity === 'number' && (
          <span className="flex items-center gap-1">
            <Eye className="w-4 h-4 flex-shrink-0" />
            {Math.round(config.appearance.windowOpacity * 100)}%
          </span>
        )}
        
        {/* Focus mode */}
        {config.appearance?.focusMode && (
          <span className="flex items-center gap-1 text-primary">
            <Focus className="w-4 h-4 flex-shrink-0" /> Focus
          </span>
        )}
        
        {/* Typewriter mode */}
        {config.appearance?.typewriterMode && (
          <span className="flex items-center gap-1 text-primary">
            <Keyboard className="w-4 h-4 flex-shrink-0" /> Typewriter
          </span>
        )}
        
        {/* Always on top */}
        {config.alwaysOnTop && (
          <span className="flex items-center gap-1 text-primary">
            <Pin className="w-4 h-4 flex-shrink-0" /> Pinned
          </span>
        )}
      </div>
      
      <div className="flex items-center gap-2 text-foreground/90">
        <Folder className="w-4 h-4 flex-shrink-0" />
        <span className="truncate">~/Notes</span>
      </div>
    </footer>
  );
}