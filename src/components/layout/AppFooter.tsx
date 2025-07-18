import { Palette, Eye, Focus, Keyboard, Pin, Folder, FolderOpen } from 'lucide-react';
import { useState, useEffect } from 'react';
import { notesApi } from '../../services/tauri-api';

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
  onDirectoryLoad?: (noteCount: number) => void;
}

export function AppFooter({ theme, themeId, config }: AppFooterProps) {
  const [currentDirectory, setCurrentDirectory] = useState<string>('~/Notes');
  const [isLoading, setIsLoading] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    // Load current notes directory on mount
    const loadCurrentDirectory = async () => {
      try {
        // Only run in Tauri context
        if (typeof window !== 'undefined' && window.__TAURI__) {
          const directory = await notesApi.getCurrentNotesDirectory();
          // Show a simplified path for display
          const simplifiedPath = directory.replace(/\/Users\/[^/]+/, '~').replace(/.*\/([^/]+\/[^/]+)$/, '.../$1');
          setCurrentDirectory(simplifiedPath);
        } else {
          setCurrentDirectory('~/notes (demo)');
        }
      } catch (error) {
        console.error('Failed to load current directory:', error);
      }
    };
    loadCurrentDirectory();
  }, []);

  const handleDirectoryClick = async (_e: React.MouseEvent) => {
    console.log('[AppFooter] Directory clicked');
    
    // Both regular click and Alt+Click open the directory in Finder
    setIsLoading(true);
    try {
      console.log('[AppFooter] Getting current notes directory...');
      const currentPath = await notesApi.getCurrentNotesDirectory();
      console.log('[AppFooter] Current path:', currentPath);
      
      console.log('[AppFooter] Opening directory in Finder...');
      await notesApi.openDirectoryInFinder(currentPath);
      console.log(`[AppFooter] Successfully opened notes directory in Finder: ${currentPath}`);
    } catch (error) {
      console.error('[AppFooter] Failed to open directory in Finder:', error);
      // Only show alert for actual errors, not for non-Tauri context
      if (error && error.toString().includes('Failed to open')) {
        alert('Failed to open directory in Finder: ' + error);
      }
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <footer className="app-footer w-full bg-background/90 border-t border-border/30 px-3 flex items-center justify-between text-xs text-muted-foreground/80 h-6 min-h-[1.5rem] gap-4 select-none">
      <div className="flex items-center gap-3">
        {/* Theme swatch and name */}
        <span className="flex items-center gap-1">
          <Palette className="w-4 h-4 text-primary/80 flex-shrink-0" strokeWidth={1.5} />
          <span 
            className="w-3 h-3 rounded-full border border-border/40 mr-1 flex-shrink-0" 
            style={{ backgroundColor: theme ? theme.colors?.accent || '#3b82f6' : '#3b82f6' }} 
          />
          {theme ? theme.name : themeId}
        </span>
        
        {/* Opacity */}
        {typeof config.appearance?.windowOpacity === 'number' && (
          <span className="flex items-center gap-1">
            <Eye className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} />
            {Math.round(config.appearance.windowOpacity * 100)}%
          </span>
        )}
        
        {/* Focus mode */}
        {config.appearance?.focusMode && (
          <span className="flex items-center gap-1 text-primary">
            <Focus className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} /> Focus
          </span>
        )}
        
        {/* Typewriter mode */}
        {config.appearance?.typewriterMode && (
          <span className="flex items-center gap-1 text-primary">
            <Keyboard className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} /> Typewriter
          </span>
        )}
        
        {/* Always on top */}
        {config.alwaysOnTop && (
          <span className="flex items-center gap-1 text-primary">
            <Pin className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} /> Pinned
          </span>
        )}
      </div>
      
      <button 
        onClick={handleDirectoryClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        disabled={isLoading}
        className="flex items-center gap-2 text-foreground/90 hover:text-primary transition-colors cursor-pointer px-2 py-1 rounded-xl hover:bg-background/40 disabled:opacity-50"
        title="Click to open notes directory in Finder"
      >
        {isLoading ? (
          <div className="w-4 h-4 flex-shrink-0 animate-spin">
            <div className="w-full h-full border-2 border-muted-foreground/30 border-t-primary rounded-full"></div>
          </div>
        ) : isHovered ? (
          <FolderOpen className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} />
        ) : (
          <Folder className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} />
        )}
        <span className="truncate max-w-[200px]">{currentDirectory}</span>
      </button>
    </footer>
  );
}