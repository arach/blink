import { useState, useCallback, useEffect, useRef } from 'react';

interface DragState {
  isDragging: boolean;
  noteId: string | null;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

interface UseDragToDetachOptions {
  onDrop: (noteId: string, x: number, y: number) => Promise<void>;
  dragThreshold?: number;
  extractTitle: (noteId: string) => string;
  extractContent: (noteId: string) => string;
}

export function useDragToDetach({ onDrop, dragThreshold = 5, extractTitle, extractContent }: UseDragToDetachOptions) {
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    noteId: null,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
  });

  const [isOutsideSidebar, setIsOutsideSidebar] = useState(false);

  const dragRef = useRef<{
    hasMovedEnough: boolean;
  }>({ hasMovedEnough: false });

  // Start drag operation
  const startDrag = useCallback((e: React.MouseEvent, noteId: string) => {
    // Only handle left click
    if (e.button !== 0) return;
    
    e.preventDefault();
    
    setDragState({
      isDragging: false, // Don't mark as dragging until threshold is met
      noteId,
      startX: e.clientX,
      startY: e.clientY,
      currentX: e.clientX,
      currentY: e.clientY,
    });
    
    // Reset state
    setIsOutsideSidebar(false);
    dragRef.current.hasMovedEnough = false;
  }, []);

  // Handle drag end
  useEffect(() => {
    if (!dragState.noteId) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragState.noteId) return;
      
      const deltaX = Math.abs(e.clientX - dragState.startX);
      const deltaY = Math.abs(e.clientY - dragState.startY);
      
      // Update current position
      setDragState(prev => ({
        ...prev,
        currentX: e.clientX,
        currentY: e.clientY,
      }));
      
      // Check if we've moved enough to start dragging
      if (!dragRef.current.hasMovedEnough && (deltaX > dragThreshold || deltaY > dragThreshold)) {
        dragRef.current.hasMovedEnough = true;
        setDragState(prev => ({ ...prev, isDragging: true }));
        
        // Add visual feedback
        document.body.style.cursor = 'grabbing';
        const draggedElement = document.querySelector(`[data-note-id="${dragState.noteId}"]`);
        if (draggedElement) {
          draggedElement.classList.add('dragging');
        }
      }
      
      // Check if cursor is outside sidebar
      if (dragRef.current.hasMovedEnough) {
        const sidebar = document.querySelector('.sidebar');
        const rect = sidebar?.getBoundingClientRect();
        
        const outside = rect && e.clientX > rect.right;
        setIsOutsideSidebar(!!outside);
        
        if (outside) {
          document.body.classList.add('will-create-window');
        } else {
          document.body.classList.remove('will-create-window');
        }
      }
    };

    const handleMouseUp = async (e: MouseEvent) => {
      if (dragState.isDragging && dragState.noteId && isOutsideSidebar) {
        // Create window at drop location
        await onDrop(dragState.noteId, e.screenX - 400, e.screenY - 300);
      }
      
      // Cleanup
      document.body.style.cursor = '';
      document.body.classList.remove('will-create-window');
      
      const draggedElement = document.querySelector(`[data-note-id="${dragState.noteId}"]`);
      if (draggedElement) {
        draggedElement.classList.remove('dragging');
      }
      
      setDragState({
        isDragging: false,
        noteId: null,
        startX: 0,
        startY: 0,
        currentX: 0,
        currentY: 0,
      });
      setIsOutsideSidebar(false);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dragState.noteId) {
        // Cancel drag
        document.body.style.cursor = '';
        document.body.classList.remove('will-create-window');
        
        const draggedElement = document.querySelector(`[data-note-id="${dragState.noteId}"]`);
        if (draggedElement) {
          draggedElement.classList.remove('dragging');
        }
        
        setDragState({
          isDragging: false,
          noteId: null,
          startX: 0,
          startY: 0,
        });
      }
    };

    // Add listeners
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [dragState, dragThreshold, onDrop]);

  return {
    dragState,
    startDrag,
    isDragging: dragState.isDragging,
    isOutsideSidebar,
    extractTitle,
    extractContent,
  };
}