import { useState, useCallback, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { createRoot } from 'react-dom/client';
import { DragCancelEffect } from '../components/windows';

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
}

// Helper function to show drag cancel effect
const showDragCancelEffect = (x: number, y: number) => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  
  root.render(
    <DragCancelEffect 
      x={x} 
      y={y} 
      onComplete={() => {
        root.unmount();
        document.body.removeChild(container);
      }}
    />
  );
};

export function useDragToDetach({ onDrop, dragThreshold = 5 }: UseDragToDetachOptions) {
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    noteId: null,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
  });

  const [isOutsideSidebar, setIsOutsideSidebar] = useState(false);
  const [realWindowCreated, setRealWindowCreated] = useState(false);

  const dragRef = useRef<{
    hasMovedEnough: boolean;
    realWindowLabel: string | null;
    lastMousePosition: { x: number; y: number };
    wasOutsideSidebar: boolean;
  }>({ hasMovedEnough: false, realWindowLabel: null, lastMousePosition: { x: 0, y: 0 }, wasOutsideSidebar: false });

  // Start drag operation
  const startDrag = useCallback((e: React.MouseEvent, noteId: string) => {
    // Only handle left click
    if (e.button !== 0) return;
    
    e.preventDefault();
    
    // Set grabbing cursor immediately on mousedown
    document.body.style.cursor = 'grabbing';
    document.body.classList.add('is-dragging');
    
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
    setRealWindowCreated(false);
    dragRef.current.hasMovedEnough = false;
    
    // Clean up any existing hybrid drag window for this note first
    if (dragRef.current.realWindowLabel) {
      console.log('[DRAG] Cleaning up existing hybrid window before creating new one');
      invoke('close_hybrid_drag_window', {
        windowLabel: dragRef.current.realWindowLabel,
      }).catch(() => {}); // Ignore errors
    }
    
    dragRef.current.realWindowLabel = null;
    dragRef.current.lastMousePosition = { x: e.screenX, y: e.screenY };
    dragRef.current.wasOutsideSidebar = false;
    
    // Pre-create the window immediately on mousedown (hidden)
    console.log('[DRAG] Mouse down - pre-creating hidden window');
    // Position window so cursor appears to be dragging from the title bar
    // Cursor should be at top of window, about 20px down from top edge
    const screenX = e.screenX - 200; // Center horizontally (half of 400px width)
    const screenY = e.screenY - 20;  // Position cursor 20px from top edge
    
    console.log('[DRAG] Initial window position (screen coords):', { 
      screenX, 
      screenY, 
      mouseScreenX: e.screenX, 
      mouseScreenY: e.screenY,
      clientX: e.clientX,
      clientY: e.clientY,
      windowScreenX: window.screenX,
      windowScreenY: window.screenY
    });
    
    invoke<string>('create_hybrid_drag_window', {
      noteId: noteId,
      x: screenX,
      y: screenY,
      hidden: true, // Create hidden
    }).then(windowLabel => {
      dragRef.current.realWindowLabel = windowLabel;
      console.log('[DRAG] Hidden window pre-created on mousedown:', windowLabel);
    }).catch(async (error) => {
      console.error('[DRAG] Failed to pre-create window:', error);
      
      // If window already exists, try to close it first and retry
      if (error.toString().includes('already exists')) {
        const existingLabel = `hybrid-drag-${noteId}`;
        console.log('[DRAG] Window already exists, closing it first:', existingLabel);
        
        try {
          await invoke('close_hybrid_drag_window', { windowLabel: existingLabel });
          console.log('[DRAG] Closed existing window, retrying creation...');
          
          // Retry creation
          const windowLabel = await invoke<string>('create_hybrid_drag_window', {
            noteId: noteId,
            x: screenX,
            y: screenY,
            hidden: true,
          });
          dragRef.current.realWindowLabel = windowLabel;
          console.log('[DRAG] Successfully created window on retry:', windowLabel);
        } catch (retryError) {
          console.error('[DRAG] Failed to create window even after cleanup:', retryError);
        }
      }
    });
  }, []);

  // Handle drag end
  useEffect(() => {
    if (!dragState.noteId) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragState.noteId) return;
      
      // Ensure cursor stays as grabbing during drag
      if (document.body.style.cursor !== 'grabbing') {
        document.body.style.cursor = 'grabbing';
      }
      
      const deltaX = Math.abs(e.clientX - dragState.startX);
      const deltaY = Math.abs(e.clientY - dragState.startY);
      
      // Update current position
      setDragState(prev => ({
        ...prev,
        currentX: e.clientX,
        currentY: e.clientY,
      }));
      
      // Store last mouse position for window creation
      dragRef.current.lastMousePosition = { x: e.screenX, y: e.screenY };
      
      // If real window is visible, update its position too
      if (realWindowCreated && dragRef.current.realWindowLabel) {
        // Position window so cursor appears to be dragging from the title bar
        const screenX = e.screenX - 200; // Center horizontally (half of 400px width)
        const screenY = e.screenY - 20;  // Position cursor 20px from top edge
        
        invoke('update_hybrid_drag_position', {
          windowLabel: dragRef.current.realWindowLabel,
          x: screenX,
          y: screenY,
        }).catch(() => {});
      }
      
      // Check if we've moved enough to start dragging
      if (!dragRef.current.hasMovedEnough && (deltaX > dragThreshold || deltaY > dragThreshold)) {
        dragRef.current.hasMovedEnough = true;
        setDragState(prev => ({ ...prev, isDragging: true }));
        
        // Add visual feedback
        const draggedElement = document.querySelector(`[data-note-id="${dragState.noteId}"]`);
        if (draggedElement) {
          draggedElement.classList.add('dragging');
        }
        
        // Show the pre-created window
        if (dragRef.current.realWindowLabel) {
          console.log('[DRAG] Threshold met, showing pre-created window');
          // Position window so cursor appears to be dragging from the title bar
          const screenX = e.screenX - 200; // Center horizontally (half of 400px width)
          const screenY = e.screenY - 20;  // Position cursor 20px from top edge
          
          console.log('[DRAG] Showing window at:', { 
            screenX, 
            screenY, 
            mouseScreenX: e.screenX, 
            mouseScreenY: e.screenY,
            clientX: e.clientX,
            clientY: e.clientY,
            windowScreenX: window.screenX,
            windowScreenY: window.screenY
          });
          
          invoke('show_hybrid_drag_window', {
            windowLabel: dragRef.current.realWindowLabel,
            x: screenX,
            y: screenY,
          }).then(() => {
            setRealWindowCreated(true);
            console.log('[DRAG] Window shown successfully');
          }).catch(err => {
            console.error('[DRAG] Error showing window:', err);
          });
        } else {
          console.warn('[DRAG] No pre-created window available');
        }
      }
      
      // Check if cursor is outside sidebar (any direction)
      if (dragRef.current.hasMovedEnough) {
        const sidebar = document.querySelector('[data-notes-sidebar]');
        const rect = sidebar?.getBoundingClientRect();
        
        if (rect) {
          // Check if cursor is outside sidebar boundaries in any direction
          const outside = 
            e.clientX < rect.left ||    // Left of sidebar
            e.clientX > rect.right ||   // Right of sidebar
            e.clientY < rect.top ||     // Above sidebar
            e.clientY > rect.bottom;    // Below sidebar
          
          setIsOutsideSidebar(outside);
          
          // Reduce excessive logging - only log boundary changes, not every mouse move
          if (outside !== dragRef.current.wasOutsideSidebar) {
            console.log('[DRAG] Boundary change:', {
              mouseX: e.clientX,
              mouseY: e.clientY,
              sidebarLeft: rect.left,
              sidebarRight: rect.right,
              sidebarTop: rect.top,
              sidebarBottom: rect.bottom,
              outside
            });
          }
          
          // Log only when transitioning from inside to outside
          if (outside && !dragRef.current.wasOutsideSidebar) {
            console.log('[DRAG] Cursor left sidebar boundary:', {
              mouseX: e.clientX,
              mouseY: e.clientY,
              sidebarBounds: {
                left: rect.left,
                right: rect.right,
                top: rect.top,
                bottom: rect.bottom
              },
              exitDirection: 
                e.clientX < rect.left ? 'left' :
                e.clientX > rect.right ? 'right' :
                e.clientY < rect.top ? 'top' :
                'bottom'
            });
          }
          
          dragRef.current.wasOutsideSidebar = outside;
        }
      }
    };

    const handleMouseUp = async (_e: MouseEvent) => {
      console.log('[DRAG] Mouse up - drop detection:', {
        isDragging: dragState.isDragging,
        isOutsideSidebar,
        wasOutsideSidebar: dragRef.current.wasOutsideSidebar,
        hasRealWindow: !!dragRef.current.realWindowLabel
      });
      
      if (dragState.noteId && dragRef.current.realWindowLabel) {
        if (dragState.isDragging && isOutsideSidebar) {
          // Actually dragged and dropped outside sidebar - finalize the window in place
          try {
            await invoke('finalize_hybrid_drag_window', {
              windowLabel: dragRef.current.realWindowLabel,
              noteId: dragState.noteId,
            });
            console.log('[DRAG] Window finalized in place, updating frontend store directly');
            
            // Import and update the window positions store directly
            const { useWindowPositionsStore } = await import('../stores/window-positions-store');
            const store = useWindowPositionsStore.getState();
            
            // Add the window to our positions map
            const newPositions = new Map(store.windowPositions);
            newPositions.set(dragState.noteId, {
              position: [dragRef.current.lastMousePosition.x - 200, dragRef.current.lastMousePosition.y - 20],
              size: [800, 600] // Default size
            });
            
            // Update the store
            useWindowPositionsStore.setState({ windowPositions: newPositions });
            
            console.log('[DRAG] Frontend store updated directly');
          } catch (error) {
            console.error('[DRAG] Failed to finalize window:', error);
          }
        } else {
          // Either didn't drag or dropped inside sidebar - close the window
          console.log('[DRAG] Closing pre-created window (not dropped outside)');
          
          // Show cancel effect if we actually dragged but dropped inside sidebar
          if (dragState.isDragging && !isOutsideSidebar) {
            const mouseEvent = _e;
            showDragCancelEffect(mouseEvent.clientX, mouseEvent.clientY);
          }
          
          await invoke('close_hybrid_drag_window', {
            windowLabel: dragRef.current.realWindowLabel,
          }).catch(() => {});
        }
      }
      
      // Cleanup
      document.body.style.cursor = '';
      document.body.classList.remove('is-dragging');
      
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
      setRealWindowCreated(false);
      
      // Always clean up the hybrid window reference
      if (dragRef.current.realWindowLabel) {
        console.log('[DRAG] Cleaning up hybrid window reference after drag end');
        dragRef.current.realWindowLabel = null;
      }
      
      dragRef.current.wasOutsideSidebar = false;
    };

    // No longer needed - we show the real window immediately

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dragState.noteId) {
        // Cancel drag and close any pre-created window
        if (dragRef.current.realWindowLabel) {
          console.log('[DRAG] Escape pressed - cleaning up hybrid window');
          invoke('close_hybrid_drag_window', {
            windowLabel: dragRef.current.realWindowLabel,
          }).catch(() => {});
          dragRef.current.realWindowLabel = null;
        }
        
        document.body.style.cursor = '';
        document.body.classList.remove('is-dragging');
        
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
        setRealWindowCreated(false);
        setIsOutsideSidebar(false);
        dragRef.current.wasOutsideSidebar = false;
      }
    };

    // Add listeners
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('keydown', handleKeyDown);
    
    // Also add global mouseup to catch drops outside window
    window.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, dragThreshold, onDrop]);

  return {
    dragState,
    startDrag,
    isDragging: dragState.isDragging,
  };
}