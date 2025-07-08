import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { DetachedWindowsAPI } from '../services/detached-windows-api';

interface CustomTitleBarProps {
  title: string;
  isMainWindow?: boolean;
  noteId?: string;
  showTrafficLights?: boolean;
  rightContent?: React.ReactNode;
  onClose?: () => Promise<void>;
  isShaded?: boolean;
  stats?: {
    wordCount?: number;
    lastSaved?: string;
  };
}

export function CustomTitleBar({ 
  title, 
  isMainWindow = false, 
  noteId,
  showTrafficLights = true,
  rightContent,
  onClose,
  isShaded = false,
  stats
}: CustomTitleBarProps) {
  // Check if we're running in Tauri context
  const isTauri = typeof window !== 'undefined' && window.__TAURI__;
  const appWindow = isTauri ? getCurrentWebviewWindow() : null;

  const handleClose = async () => {
    if (onClose) {
      await onClose();
    } else if (appWindow) {
      await appWindow.close();
    }
  };

  const handleMinimize = async () => {
    if (appWindow) {
      await appWindow.minimize();
    }
  };

  const handleMaximize = async () => {
    if (appWindow) {
      const isMaximized = await appWindow.isMaximized();
      if (isMaximized) {
        await appWindow.unmaximize();
      } else {
        await appWindow.maximize();
      }
    }
  };

  const handleDoubleClick = async () => {
    await handleMaximize();
  };

  const handleMiddleClick = async (e: React.MouseEvent) => {
    if (e.button === 1) {
      e.preventDefault();
      try {
        if (isMainWindow) {
          await DetachedWindowsAPI.toggleMainWindowShade();
        } else if (noteId) {
          // Get the current window label - it might be note-* or hybrid-drag-*
          const currentWindow = getCurrentWebviewWindow();
          const windowLabel = currentWindow.label;
          await DetachedWindowsAPI.toggleWindowShade(windowLabel);
        }
      } catch (error) {
        console.error('Failed to toggle shade:', error);
      }
    }
  };

  return (
    <div 
      className="h-8 flex items-center px-4 border-b border-border/30 bg-background/90 backdrop-blur-sm"
      data-tauri-drag-region
      style={{ 
        userSelect: 'none', 
        WebkitUserSelect: 'none',
        cursor: 'grab'
      }}
      onDoubleClick={handleDoubleClick}
      onMouseDown={(e) => {
        // Handle middle click on the entire title bar
        if (e.button === 1) {
          e.preventDefault();
          e.stopPropagation();
          handleMiddleClick(e);
          return;
        }
        
        // Prevent drag interference from child elements
        if ((e.target as HTMLElement).hasAttribute('data-tauri-drag-region')) {
          e.preventDefault();
          // Force grabbing cursor during drag
          document.body.style.cursor = 'grabbing';
          
          // Reset cursor on mouse up
          const handleMouseUp = () => {
            document.body.style.cursor = '';
            document.removeEventListener('mouseup', handleMouseUp);
          };
          document.addEventListener('mouseup', handleMouseUp);
        }
      }}
    >
      {/* Window controls (traffic lights on macOS) */}
      {showTrafficLights && (
        <div className="flex items-center gap-2.5" onMouseDown={(e) => e.stopPropagation()}>
          {/* Close button */}
          <button
            onClick={handleClose}
            onMouseDown={(e) => e.stopPropagation()}
            className="w-3.5 h-3.5 rounded-full bg-red-500/90 hover:bg-red-500 transition-all duration-200 group relative shadow-sm"
            title="Close"
          >
            <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 text-red-900 font-bold transition-opacity duration-150" style={{ fontSize: '9px' }}>
              ×
            </span>
          </button>
          
          {/* Minimize button */}
          <button
            onClick={handleMinimize}
            onMouseDown={(e) => e.stopPropagation()}
            className="w-3.5 h-3.5 rounded-full bg-yellow-500/90 hover:bg-yellow-500 transition-all duration-200 group relative shadow-sm"
            title="Minimize"
          >
            <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 text-yellow-900 font-bold transition-opacity duration-150" style={{ fontSize: '9px' }}>
              −
            </span>
          </button>
          
          {/* Maximize button */}
          <button
            onClick={handleMaximize}
            onMouseDown={(e) => e.stopPropagation()}
            className="w-3.5 h-3.5 rounded-full bg-green-500/90 hover:bg-green-500 transition-all duration-200 group relative shadow-sm"
            title="Maximize"
          >
            <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 text-green-900 font-bold transition-opacity duration-150" style={{ fontSize: '9px' }}>
              +
            </span>
          </button>
        </div>
      )}
      
      {/* Center title area */}
      <div 
        className="flex-1 flex items-center justify-center"
        data-tauri-drag-region
      >
        {isShaded && stats ? (
          <div className="flex items-center gap-4 text-xs text-foreground/70 font-medium select-none">
            <span title="Middle-click to unshade">{title}</span>
            <div className="flex items-center gap-3 text-[10px] text-foreground/50">
              {stats.wordCount !== undefined && (
                <span>{stats.wordCount} words</span>
              )}
              {stats.lastSaved && (
                <span>• Saved {stats.lastSaved}</span>
              )}
            </div>
          </div>
        ) : (
          <span className="text-foreground/80 font-semibold select-none tracking-wide" style={{ fontSize: '13px' }} title="Middle-click to shade">
            {title}
          </span>
        )}
      </div>
      
      {/* Right side content */}
      {rightContent && (
        <div className="flex items-center gap-2" onMouseDown={(e) => e.stopPropagation()}>
          {rightContent}
        </div>
      )}
    </div>
  );
}