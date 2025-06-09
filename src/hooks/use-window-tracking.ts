import { useEffect, useRef } from 'react';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { invoke } from '@tauri-apps/api/core';

// Debounce intervals - much less frequent as requested
const POSITION_UPDATE_DELAY = process.env.NODE_ENV === 'production' ? 60000 : 10000; // 60s prod, 10s dev
const SIZE_UPDATE_DELAY = process.env.NODE_ENV === 'production' ? 60000 : 10000; // 60s prod, 10s dev

export function useWindowTracking(noteId: string) {
  // Refs to store debounce timers and last known values
  const positionTimerRef = useRef<NodeJS.Timeout>();
  const sizeTimerRef = useRef<NodeJS.Timeout>();
  const lastPositionRef = useRef<{ x: number; y: number }>();
  const lastSizeRef = useRef<{ width: number; height: number }>();
  
  useEffect(() => {
    const appWindow = getCurrentWebviewWindow();
    
    console.log('[WINDOW-TRACKING] Setting up debounced position/size tracking for note:', noteId);
    
    // Debounced position update function
    const debouncedPositionUpdate = (position: { x: number; y: number }) => {
      // Clear existing timer
      if (positionTimerRef.current) {
        clearTimeout(positionTimerRef.current);
      }
      
      // Store the latest position
      lastPositionRef.current = position;
      
      // Set new timer
      positionTimerRef.current = setTimeout(async () => {
        if (lastPositionRef.current) {
          console.log('[WINDOW-TRACKING] Saving window position (debounced):', lastPositionRef.current);
          try {
            await invoke('update_detached_window_position', {
              windowLabel: appWindow.label,
              x: lastPositionRef.current.x,
              y: lastPositionRef.current.y,
            });
          } catch (error) {
            console.error('[WINDOW-TRACKING] Failed to save position:', error);
          }
        }
      }, POSITION_UPDATE_DELAY);
    };
    
    // Debounced size update function
    const debouncedSizeUpdate = (size: { width: number; height: number }) => {
      // Clear existing timer
      if (sizeTimerRef.current) {
        clearTimeout(sizeTimerRef.current);
      }
      
      // Store the latest size
      lastSizeRef.current = size;
      
      // Set new timer
      sizeTimerRef.current = setTimeout(async () => {
        if (lastSizeRef.current) {
          console.log('[WINDOW-TRACKING] Saving window size (debounced):', lastSizeRef.current);
          try {
            await invoke('update_detached_window_size', {
              windowLabel: appWindow.label,
              width: lastSizeRef.current.width,
              height: lastSizeRef.current.height,
            });
          } catch (error) {
            console.error('[WINDOW-TRACKING] Failed to save size:', error);
          }
        }
      }, SIZE_UPDATE_DELAY);
    };
    
    // Listen for window move events
    const unlistenMove = appWindow.onMoved(({ payload: position }) => {
      // Only log occasionally to avoid spam
      if (Math.random() < 0.1) { // Log ~10% of moves
        console.log('[WINDOW-TRACKING] Window move detected (debouncing):', position);
      }
      debouncedPositionUpdate(position);
    });
    
    // Listen for window resize events
    const unlistenResize = appWindow.onResized(({ payload: size }) => {
      console.log('[WINDOW-TRACKING] Window resize detected (debouncing):', size);
      debouncedSizeUpdate(size);
    });
    
    // Cleanup
    return () => {
      // Clear any pending timers
      if (positionTimerRef.current) {
        clearTimeout(positionTimerRef.current);
      }
      if (sizeTimerRef.current) {
        clearTimeout(sizeTimerRef.current);
      }
      
      // Save final position/size immediately on cleanup
      if (lastPositionRef.current) {
        invoke('update_detached_window_position', {
          windowLabel: appWindow.label,
          x: lastPositionRef.current.x,
          y: lastPositionRef.current.y,
        }).catch(() => {});
      }
      if (lastSizeRef.current) {
        invoke('update_detached_window_size', {
          windowLabel: appWindow.label,
          width: lastSizeRef.current.width,
          height: lastSizeRef.current.height,
        }).catch(() => {});
      }
      
      // Remove event listeners
      unlistenMove.then(fn => fn());
      unlistenResize.then(fn => fn());
    };
  }, [noteId]);
}