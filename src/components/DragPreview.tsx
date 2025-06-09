import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface DragPreviewProps {
  title: string;
  content: string;
  position: { x: number; y: number };
  isOutsideSidebar: boolean;
}

export function DragPreview({ title, content, position, isOutsideSidebar }: DragPreviewProps) {
  const previewRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (previewRef.current) {
      // Use transform for GPU-accelerated positioning
      const x = Math.max(0, Math.min(position.x, window.innerWidth - 320));
      const y = Math.max(0, Math.min(position.y, window.innerHeight - 200));
      
      previewRef.current.style.transform = `translate(${x}px, ${y}px)`;
    }
  }, [position]);
  
  // Extract first few lines of content for preview
  const previewContent = content
    .split('\n')
    .slice(0, 3)
    .join('\n')
    .substring(0, 150) + (content.length > 150 ? '...' : '');
  
  return createPortal(
    <div
      ref={previewRef}
      className={`drag-preview ${isOutsideSidebar ? 'outside-sidebar' : ''}`}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '320px',
        pointerEvents: 'none',
        zIndex: 9999,
      }}
    >
      <div className="drag-preview-content">
        <div className="drag-preview-header">
          <span className="drag-preview-title">{title || 'Untitled'}</span>
          {isOutsideSidebar && (
            <span className="drag-preview-badge">Release to create window</span>
          )}
        </div>
        <div className="drag-preview-body">
          <pre className="drag-preview-text">{previewContent}</pre>
        </div>
      </div>
    </div>,
    document.body
  );
}