import { useState, useRef, useEffect, ReactNode } from 'react';

interface ResizablePanelProps {
  children: ReactNode;
  minWidth?: number;
  maxWidth?: number;
  defaultWidth?: number;
  onResize?: (width: number) => void;
  className?: string;
}

export function ResizablePanel({
  children,
  minWidth = 200,
  maxWidth = 500,
  defaultWidth = 256,
  onResize,
  className = ''
}: ResizablePanelProps) {
  const [width, setWidth] = useState(defaultWidth);
  const [isResizing, setIsResizing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      
      const newWidth = e.clientX;
      const clampedWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
      setWidth(clampedWidth);
      onResize?.(clampedWidth);
    };
    
    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing, minWidth, maxWidth, onResize]);

  return (
    <div 
      ref={panelRef}
      className={`relative ${className}`}
      style={{ width: `${width}px` }}
    >
      {children}
      
      {/* Resize handle */}
      <div
        className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors group"
        onMouseDown={(e) => {
          e.preventDefault();
          setIsResizing(true);
        }}
      >
        <div className="absolute top-1/2 right-0 w-3 h-8 -translate-y-1/2 translate-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="flex flex-col items-center justify-center h-full gap-0.5">
            <div className="w-0.5 h-0.5 bg-muted-foreground/60 rounded-full"></div>
            <div className="w-0.5 h-0.5 bg-muted-foreground/60 rounded-full"></div>
            <div className="w-0.5 h-0.5 bg-muted-foreground/60 rounded-full"></div>
          </div>
        </div>
      </div>
    </div>
  );
}