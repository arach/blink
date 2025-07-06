import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface DragCancelEffectProps {
  x: number;
  y: number;
  onComplete: () => void;
}

export function DragCancelEffect({ x, y, onComplete }: DragCancelEffectProps) {
  const [opacity, setOpacity] = useState(0.8);
  const [scale, setScale] = useState(1.2);
  const [translateX, setTranslateX] = useState(0);
  const [showTooltip, setShowTooltip] = useState(true);

  useEffect(() => {
    // Start visible, then animate to shrink back toward sidebar (left)
    const timer = setTimeout(() => {
      setOpacity(0);
      setScale(0.3);
      setTranslateX(-150); // Move left toward sidebar
    }, 100);

    // Hide tooltip after showing it for a bit
    const tooltipTimer = setTimeout(() => {
      setShowTooltip(false);
    }, 1500);

    // Remove the component after animation completes
    const cleanupTimer = setTimeout(() => {
      onComplete();
    }, 800);

    return () => {
      clearTimeout(timer);
      clearTimeout(tooltipTimer);
      clearTimeout(cleanupTimer);
    };
  }, [onComplete]);

  return createPortal(
    <div
      className="pointer-events-none fixed z-[9999]"
      style={{
        left: x - 30,
        top: y - 30,
        opacity,
        transform: `scale(${scale}) translateX(${translateX}px)`,
        transition: 'all 600ms cubic-bezier(0.4, 0, 0.6, 1)',
      }}
    >
      {/* Poof cloud effect */}
      <div className="relative w-[60px] h-[60px]">
        {/* Multiple cloud particles for poof effect */}
        {[...Array(8)].map((_, i) => {
          const angle = (i * 45) * Math.PI / 180;
          const distance = 15;
          return (
            <div
              key={i}
              className="absolute w-3 h-3 bg-white/20 rounded-full blur-sm"
              style={{
                left: '50%',
                top: '50%',
                transform: `translate(-50%, -50%) translate(${Math.cos(angle) * distance * (scale - 1)}px, ${Math.sin(angle) * distance * (scale - 1)}px)`,
                opacity: opacity * 0.6,
              }}
            />
          );
        })}
        
        {/* Center poof */}
        <div 
          className="absolute inset-0 flex items-center justify-center"
          style={{ opacity: opacity * 0.8 }}
        >
          <div className="w-8 h-8 bg-white/15 rounded-full blur-md" />
        </div>
        
        {/* X icon in center */}
        <div 
          className="absolute inset-0 flex items-center justify-center"
          style={{ opacity }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/40">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </div>
      </div>
      
      {/* Tooltip message */}
      {showTooltip && (
        <div 
          className="absolute left-1/2 -translate-x-1/2 -bottom-10 whitespace-nowrap"
          style={{
            opacity: showTooltip ? 1 : 0,
            transition: 'opacity 800ms cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          <div className="bg-black/80 text-white/90 text-xs px-3 py-1.5 rounded-2xl shadow-lg">
            Drag outside sidebar to detach
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}