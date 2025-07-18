import { create } from 'zustand';
import { DetachedWindow, DetachedWindowsAPI } from '../services/detached-windows-api';

interface DetachedWindowsState {
  windows: DetachedWindow[];
  loading: boolean;
  error: string | null;
  
  // Actions
  loadWindows: () => Promise<void>;
  createWindow: (noteId: string, x?: number, y?: number, width?: number, height?: number) => Promise<DetachedWindow | null>;
  closeWindow: (noteId: string) => Promise<boolean>;
  forceCloseWindow: (noteId: string) => Promise<void>;
  refreshWindows: () => Promise<void>;
  updateWindowPosition: (windowLabel: string, x: number, y: number) => Promise<void>;
  updateWindowSize: (windowLabel: string, width: number, height: number) => Promise<void>;
  isWindowOpen: (noteId: string) => boolean;
  getWindowByNoteId: (noteId: string) => DetachedWindow | undefined;
  focusWindow: (noteId: string) => Promise<boolean>;
}

export const useDetachedWindowsStore = create<DetachedWindowsState>((set, get) => ({
  windows: [],
  loading: false,
  error: null,

  loadWindows: async () => {
    console.log('[DETACHED-WINDOWS-STORE] 🚀 loadWindows() called - starting window load...');
    set({ loading: true, error: null });
    try {
      // Only load from Tauri in desktop context
      if (typeof window !== 'undefined' && window.__TAURI__) {
        console.log('[DETACHED-WINDOWS-STORE] ✅ Tauri context detected, loading windows...');
        const windows = await DetachedWindowsAPI.getDetachedWindows();
        console.log('[DETACHED-WINDOWS-STORE] ✅ Successfully loaded', windows.length, 'windows on startup:', windows);
        set({ windows, loading: false });
        console.log('[DETACHED-WINDOWS-STORE] ✅ Windows set in store, loading complete');
      } else {
        // Browser mode - no detached windows
        console.log('[BLINK] [WINDOWS] 🌐 No detached windows in browser mode');
        set({ windows: [], loading: false });
      }
    } catch (error) {
      console.error('[DETACHED-WINDOWS-STORE] ❌ Failed to load detached windows on startup:', error);
      set({ error: error as string, loading: false });
    }
  },

  createWindow: async (noteId: string, x?: number, y?: number, width?: number, height?: number): Promise<DetachedWindow | null> => {
    console.log('[DETACHED-WINDOWS] Creating window for note:', noteId, { x, y, width, height });
    const { windows, forceCloseWindow } = get();
    
    // If window already exists, force close it first to allow recreation
    if (Array.isArray(windows) && windows.some(w => w.note_id === noteId)) {
      console.log('[DETACHED-WINDOWS] Window already exists, force closing first...');
      await forceCloseWindow(noteId);
      // Wait a bit for cleanup
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    set({ loading: true, error: null });
    try {
      console.log('[DETACHED-WINDOWS] Calling API to create window...');
      const newWindow = await DetachedWindowsAPI.createDetachedWindow({
        note_id: noteId,
        x,
        y,
        width,
        height
      });
      console.log('[DETACHED-WINDOWS] Window created:', newWindow);
      
      // Refresh windows list to ensure consistency
      await get().refreshWindows();
      
      return newWindow;
    } catch (error) {
      console.error('[DETACHED-WINDOWS] Failed to create detached window:', error);
      console.error('[DETACHED-WINDOWS] Error details:', JSON.stringify(error));
      set({ error: error as string, loading: false });
      return null;
    }
  },

  closeWindow: async (noteId: string): Promise<boolean> => {
    const { windows } = get();
    
    set({ loading: true, error: null });
    try {
      const success = await DetachedWindowsAPI.closeDetachedWindow(noteId);
      
      if (success) {
        set({ 
          windows: windows.filter(w => w.note_id !== noteId), 
          loading: false 
        });
      } else {
        set({ loading: false });
      }
      
      return success;
    } catch (error) {
      console.error('Failed to close detached window:', error);
      set({ error: error as string, loading: false });
      return false;
    }
  },

  forceCloseWindow: async (noteId: string): Promise<void> => {
    const { windows } = get();
    
    try {
      // Try to close via API first
      await DetachedWindowsAPI.closeDetachedWindow(noteId);
    } catch (error) {
      console.log('API close failed, removing from state anyway:', error);
    }
    
    // Always remove from local state regardless of API result
    set({ 
      windows: windows.filter(w => w.note_id !== noteId)
    });
  },

  refreshWindows: async (): Promise<void> => {
    // Disabled to prevent loading loops - will be replaced with simple coordinate system
    console.log('[DETACHED-WINDOWS-STORE] refreshWindows disabled');
  },

  updateWindowPosition: async (windowLabel: string, x: number, y: number) => {
    const { windows } = get();
    
    try {
      await DetachedWindowsAPI.updateWindowPosition(windowLabel, x, y);
      
      // Update local state
      set({
        windows: windows.map(w => 
          w.window_label === windowLabel 
            ? { ...w, position: [x, y] as [number, number] }
            : w
        )
      });
    } catch (error) {
      console.error('Failed to update window position:', error);
      set({ error: error as string });
    }
  },

  updateWindowSize: async (windowLabel: string, width: number, height: number) => {
    const { windows } = get();
    
    try {
      await DetachedWindowsAPI.updateWindowSize(windowLabel, width, height);
      
      // Update local state
      set({
        windows: windows.map(w => 
          w.window_label === windowLabel 
            ? { ...w, size: [width, height] as [number, number] }
            : w
        )
      });
    } catch (error) {
      console.error('Failed to update window size:', error);
      set({ error: error as string });
    }
  },

  isWindowOpen: (noteId: string): boolean => {
    const { windows } = get();
    const isOpen = Array.isArray(windows) ? windows.some(w => w.note_id === noteId) : false;
    // Don't log this - it's called too frequently during renders
    return isOpen;
  },

  getWindowByNoteId: (noteId: string): DetachedWindow | undefined => {
    const { windows } = get();
    return windows.find(w => w.note_id === noteId);
  },

  focusWindow: async (noteId: string): Promise<boolean> => {
    try {
      return await DetachedWindowsAPI.focusDetachedWindow(noteId);
    } catch (error) {
      console.error('Failed to focus detached window:', error);
      return false;
    }
  },
}));