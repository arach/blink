import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';

interface WindowPosition {
  position: [number, number];
  size: [number, number];
}

interface WindowPositionsState {
  // Core state - just a map of noteId -> position/size
  windowPositions: Map<string, WindowPosition>;
  
  // Simple operations
  openWindow: (noteId: string, x?: number, y?: number, width?: number, height?: number) => Promise<boolean>;
  closeWindow: (noteId: string) => Promise<void>;
  moveWindow: (noteId: string, x: number, y: number) => void;
  resizeWindow: (noteId: string, width: number, height: number) => void;
  isOpen: (noteId: string) => boolean;
  getPosition: (noteId: string) => WindowPosition | undefined;
  focusWindow: (noteId: string) => Promise<boolean>;
  
  // Initialization
  loadPositions: () => Promise<void>;
}

export const useWindowPositionsStore = create<WindowPositionsState>((set, get) => ({
  windowPositions: new Map(),

  loadPositions: async () => {
    try {
      // Load existing window positions from backend on startup
      const windows = await invoke<{[key: string]: any}>('get_detached_windows');
      const positions = new Map<string, WindowPosition>();
      
      Object.values(windows).forEach((window: any) => {
        if (window.note_id && window.position && window.size) {
          positions.set(window.note_id, {
            position: window.position,
            size: window.size
          });
        }
      });
      
      set({ windowPositions: positions });
      console.log('[WINDOW-POSITIONS] Loaded', positions.size, 'window positions');
    } catch (error) {
      console.error('[WINDOW-POSITIONS] Failed to load positions:', error);
    }
  },

  openWindow: async (noteId: string, x = 100, y = 100, width = 800, height = 600): Promise<boolean> => {
    try {
      // Create the actual window via backend
      await invoke('create_detached_window', {
        request: { note_id: noteId, x, y, width, height }
      });
      
      // Add to our position map
      const { windowPositions } = get();
      const newPositions = new Map(windowPositions);
      newPositions.set(noteId, { 
        position: [x, y], 
        size: [width, height] 
      });
      
      set({ windowPositions: newPositions });
      console.log('[WINDOW-POSITIONS] Window opened for note:', noteId, { x, y, width, height });
      return true;
    } catch (error) {
      console.error('[WINDOW-POSITIONS] Failed to open window:', error);
      return false;
    }
  },

  closeWindow: async (noteId: string): Promise<void> => {
    try {
      // Close the actual window via backend
      await invoke('close_detached_window', { noteId });
      
      // Remove from our position map
      const { windowPositions } = get();
      const newPositions = new Map(windowPositions);
      newPositions.delete(noteId);
      
      set({ windowPositions: newPositions });
      console.log('[WINDOW-POSITIONS] Window closed for note:', noteId);
    } catch (error) {
      console.error('[WINDOW-POSITIONS] Failed to close window:', error);
      // Remove from local state anyway
      const { windowPositions } = get();
      const newPositions = new Map(windowPositions);
      newPositions.delete(noteId);
      set({ windowPositions: newPositions });
    }
  },

  moveWindow: (noteId: string, x: number, y: number): void => {
    const { windowPositions } = get();
    const current = windowPositions.get(noteId);
    
    if (current) {
      const newPositions = new Map(windowPositions);
      newPositions.set(noteId, {
        ...current,
        position: [x, y]
      });
      set({ windowPositions: newPositions });
      
      // Update backend position (fire and forget)
      invoke('update_detached_window_position', {
        windowLabel: `note-${noteId}`,
        x,
        y
      }).catch(() => {}); // Ignore errors
    }
  },

  resizeWindow: (noteId: string, width: number, height: number): void => {
    const { windowPositions } = get();
    const current = windowPositions.get(noteId);
    
    if (current) {
      const newPositions = new Map(windowPositions);
      newPositions.set(noteId, {
        ...current,
        size: [width, height]
      });
      set({ windowPositions: newPositions });
      
      // Update backend size (fire and forget)
      invoke('update_detached_window_size', {
        windowLabel: `note-${noteId}`,
        width,
        height
      }).catch(() => {}); // Ignore errors
    }
  },

  isOpen: (noteId: string): boolean => {
    return get().windowPositions.has(noteId);
  },

  getPosition: (noteId: string): WindowPosition | undefined => {
    return get().windowPositions.get(noteId);
  },

  focusWindow: async (noteId: string): Promise<boolean> => {
    try {
      return await invoke<boolean>('focus_detached_window', { noteId });
    } catch (error) {
      console.error('[WINDOW-POSITIONS] Failed to focus window:', error);
      return false;
    }
  },
}));