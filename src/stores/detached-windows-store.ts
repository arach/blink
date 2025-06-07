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
  updateWindowPosition: (windowLabel: string, x: number, y: number) => Promise<void>;
  updateWindowSize: (windowLabel: string, width: number, height: number) => Promise<void>;
  isWindowOpen: (noteId: string) => boolean;
  getWindowByNoteId: (noteId: string) => DetachedWindow | undefined;
}

export const useDetachedWindowsStore = create<DetachedWindowsState>((set, get) => ({
  windows: [],
  loading: false,
  error: null,

  loadWindows: async () => {
    set({ loading: true, error: null });
    try {
      const windows = await DetachedWindowsAPI.getDetachedWindows();
      set({ windows, loading: false });
    } catch (error) {
      console.error('Failed to load detached windows:', error);
      set({ error: error as string, loading: false });
    }
  },

  createWindow: async (noteId: string, x?: number, y?: number, width?: number, height?: number): Promise<DetachedWindow | null> => {
    const { windows } = get();
    
    // Check if window already exists
    if (windows.some(w => w.note_id === noteId)) {
      set({ error: 'Window already exists for this note' });
      return null;
    }

    set({ loading: true, error: null });
    try {
      const newWindow = await DetachedWindowsAPI.createDetachedWindow({
        note_id: noteId,
        x,
        y,
        width,
        height
      });
      
      set({ 
        windows: [...windows, newWindow], 
        loading: false 
      });
      
      return newWindow;
    } catch (error) {
      console.error('Failed to create detached window:', error);
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
    return windows.some(w => w.note_id === noteId);
  },

  getWindowByNoteId: (noteId: string): DetachedWindow | undefined => {
    const { windows } = get();
    return windows.find(w => w.note_id === noteId);
  },
}));