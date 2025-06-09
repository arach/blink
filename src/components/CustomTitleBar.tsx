import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { DetachedWindowsAPI } from '../services/detached-windows-api';

interface CustomTitleBarProps {
  title: string;
  isMainWindow?: boolean;
  noteId?: string;
  showTrafficLights?: boolean;
  rightContent?: React.ReactNode;
  onClose?: () => Promise<void>;
}

export function CustomTitleBar({ 
  title, 
  isMainWindow = false, 
  noteId,
  showTrafficLights = true,
  rightContent,
  onClose
}: CustomTitleBarProps) {
  const appWindow = getCurrentWebviewWindow();

  const handleClose = async () => {
    if (onClose) {
      await onClose();
    } else {
      await appWindow.close();
    }
  };

  const handleMinimize = async () => {
    await appWindow.minimize();
  };

  const handleMaximize = async () => {
    const isMaximized = await appWindow.isMaximized();
    if (isMaximized) {
      await appWindow.unmaximize();
    } else {
      await appWindow.maximize();
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
          const windowLabel = `note-${noteId}`;
          await DetachedWindowsAPI.toggleWindowShade(windowLabel);
        }
      } catch (error) {
        console.error('Failed to toggle shade:', error);
      }
    }
  };

  return (
    <div 
      className="h-10 flex items-center px-4 border-b border-border/30"
      data-tauri-drag-region
      style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
      onDoubleClick={handleDoubleClick}
      onMouseDown={(e) => {
        // Prevent drag interference from child elements
        if ((e.target as HTMLElement).hasAttribute('data-tauri-drag-region')) {
          e.preventDefault();
        }
      }}
    >
      {/* Window controls (traffic lights on macOS) */}
      {showTrafficLights && (
        <div className="flex items-center gap-2" onMouseDown={(e) => e.stopPropagation()}>
          {/* Close button */}
          <button
            onClick={handleClose}
            onMouseDown={(e) => e.stopPropagation()}
            className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-600 transition-colors group relative"
            title="Close"
          >
            <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 text-red-900 font-bold" style={{ fontSize: '8px' }}>
              ×
            </span>
          </button>
          
          {/* Minimize button */}
          <button
            onClick={handleMinimize}
            onMouseDown={(e) => e.stopPropagation()}
            className="w-3 h-3 rounded-full bg-yellow-500 hover:bg-yellow-600 transition-colors group relative"
            title="Minimize"
          >
            <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 text-yellow-900 font-bold" style={{ fontSize: '8px' }}>
              −
            </span>
          </button>
          
          {/* Maximize button */}
          <button
            onClick={handleMaximize}
            onMouseDown={(e) => e.stopPropagation()}
            className="w-3 h-3 rounded-full bg-green-500 hover:bg-green-600 transition-colors group relative"
            title="Maximize"
          >
            <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 text-green-900 font-bold" style={{ fontSize: '8px' }}>
              +
            </span>
          </button>
        </div>
      )}
      
      {/* Center title area */}
      <div 
        className="flex-1 flex items-center justify-center"
        data-tauri-drag-region
        onMouseDown={(e) => {
          // Only handle middle click, let normal clicks pass through for dragging
          if (e.button === 1) {
            e.preventDefault();
            e.stopPropagation();
            handleMiddleClick(e);
          }
        }}
      >
        <span className="text-xs text-foreground/70 font-medium select-none" title="Middle-click to shade">
          {title}
        </span>
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