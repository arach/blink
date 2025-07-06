import { Palette, Eye, Focus, Keyboard, Pin, Folder, FolderOpen } from 'lucide-react';
import { useState, useEffect } from 'react';
import { notesApi } from '../services/tauri-api';

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

export function AppFooter({ theme, themeId, config, onDirectoryLoad }: AppFooterProps) {
  const [currentDirectory, setCurrentDirectory] = useState<string>('~/Notes');
  const [isLoading, setIsLoading] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    // Load current notes directory on mount
    const loadCurrentDirectory = async () => {
      try {
        const directory = await notesApi.getCurrentNotesDirectory();
        // Show a simplified path for display
        const simplifiedPath = directory.replace(/\/Users\/[^/]+/, '~').replace(/.*\/([^/]+\/[^/]+)$/, '.../$1');
        setCurrentDirectory(simplifiedPath);
      } catch (error) {
        console.error('Failed to load current directory:', error);
      }
    };
    loadCurrentDirectory();
  }, []);

  const handleDirectoryClick = async () => {
    setIsLoading(true);
    try {
      // Try to use native directory dialog first
      const newDirectory = await notesApi.openDirectoryDialog();
      
      if (newDirectory && newDirectory.trim()) {
        await notesApi.setNotesDirectory(newDirectory.trim());
        const notes = await notesApi.reloadNotesFromDirectory();
        
        // Update the display
        const simplifiedPath = newDirectory.replace(/\/Users\/[^/]+/, '~').replace(/.*\/([^/]+\/[^/]+)$/, '.../$1');
        setCurrentDirectory(simplifiedPath);
        
        // Notify parent component
        if (onDirectoryLoad) {
          onDirectoryLoad(notes.length);
        }
        
        console.log(`Successfully loaded ${notes.length} notes from ${newDirectory}`);
      }
    } catch (error) {
      console.error('Failed to load directory:', error);
      // Fallback to prompt if native dialog fails
      const newDirectory = prompt('Enter the path to your notes directory:', currentDirectory.replace('~', '/Users/' + (process.env.USER || 'user')));
      
      if (newDirectory && newDirectory.trim()) {
        try {
          await notesApi.setNotesDirectory(newDirectory.trim());
          const notes = await notesApi.reloadNotesFromDirectory();
          
          // Update the display
          const simplifiedPath = newDirectory.replace(/\/Users\/[^/]+/, '~').replace(/.*\/([^/]+\/[^/]+)$/, '.../$1');
          setCurrentDirectory(simplifiedPath);
          
          // Notify parent component
          if (onDirectoryLoad) {
            onDirectoryLoad(notes.length);
          }
          
          console.log(`Successfully loaded ${notes.length} notes from ${newDirectory}`);
        } catch (fallbackError) {
          console.error('Failed to load directory (fallback):', fallbackError);
          alert('Failed to load directory: ' + fallbackError);
        }
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
      
      <button 
        onClick={handleDirectoryClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        disabled={isLoading}
        className="flex items-center gap-2 text-foreground/90 hover:text-primary transition-colors cursor-pointer px-2 py-1 rounded-xl hover:bg-background/40 disabled:opacity-50"
        title="Click to change notes directory"
      >
        {isLoading ? (
          <div className="w-4 h-4 flex-shrink-0 animate-spin">
            <div className="w-full h-full border-2 border-muted-foreground/30 border-t-primary rounded-full"></div>
          </div>
        ) : isHovered ? (
          <FolderOpen className="w-4 h-4 flex-shrink-0" />
        ) : (
          <Folder className="w-4 h-4 flex-shrink-0" />
        )}
        <span className="truncate max-w-[200px]">{currentDirectory}</span>
      </button>
    </footer>
  );
}