import { useEffect, useState } from 'react';

interface DragGhostProps {
  noteTitle: string;
  distance: number;
  threshold: number;
  isSuccess?: boolean;
}

export function DragGhost({ noteTitle, distance, threshold, isSuccess = false }: DragGhostProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const canDetach = distance > threshold;
  const remaining = Math.max(0, threshold - distance);

  return (
    <div 
      className="w-full h-full flex items-center justify-center"
      style={{ 
        background: 'transparent',
        pointerEvents: 'none'
      }}
    >
      {/* Window preview - inspired by Safari tab dragging */}
      <div 
        className={`relative transition-all duration-300 ${
          mounted ? 'animate-in fade-in slide-in-from-bottom-4' : ''
        } ${
          isSuccess ? 'scale-110' : 'scale-100'
        }`}
        style={{
          transform: `rotate(-2deg) scale(${isSuccess ? 0.9 : 0.8})`,
          transformOrigin: 'center center'
        }}
      >
        {/* Window frame */}
        <div 
          className="bg-background/90 border border-border/40 shadow-2xl overflow-hidden"
          style={{
            width: '280px',
            height: '180px',
            background: 'rgba(18, 19, 23, 0.98)',
            borderRadius: '10px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05)'
          }}
        >
          {/* Window title bar */}
          <div className="h-7 bg-background/80 border-b border-border/30 flex items-center justify-between px-3">
            <div className="flex items-center gap-2">
              {/* Traffic lights */}
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/80"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-green-500/80"></div>
              </div>
            </div>
            
            <div className="flex items-center gap-1">
              {/* Edit/preview buttons */}
              <div className="w-4 h-3 bg-primary/20 rounded-sm"></div>
              <div className="w-4 h-3 bg-background/40 rounded-sm"></div>
            </div>
          </div>
          
          {/* Window content preview */}
          <div className="p-4 h-full">
            <div className="text-xs font-medium text-foreground mb-2 truncate">
              {noteTitle}
            </div>
            
            {/* Simulated content lines */}
            <div className="space-y-1.5">
              <div className="h-1.5 bg-muted-foreground/20 rounded w-full"></div>
              <div className="h-1.5 bg-muted-foreground/15 rounded w-4/5"></div>
              <div className="h-1.5 bg-muted-foreground/10 rounded w-3/4"></div>
              <div className="h-1.5 bg-muted-foreground/10 rounded w-2/3"></div>
            </div>
          </div>
        </div>
        
        {/* Status indicator */}
        <div 
          className={`absolute -bottom-8 left-1/2 transform -translate-x-1/2 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
            canDetach 
              ? 'bg-green-500/20 text-green-400 border border-green-500/40' 
              : 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
          }`}
          style={{
            backdropFilter: 'blur(12px)',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
          }}
        >
          {canDetach 
            ? "✓ Release to create window" 
            : `${Math.round(remaining)}px more`
          }
        </div>
      </div>
    </div>
  );
}