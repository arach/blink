import { invoke } from '@tauri-apps/api/core';

export interface DetachedWindow {
  note_id: string;
  window_label: string;
  position: [number, number];
  size: [number, number];
  always_on_top: boolean;
  opacity: number;
  is_shaded?: boolean;
  original_height?: number;
}

export interface CreateDetachedWindowRequest {
  note_id: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export class DetachedWindowsAPI {
  static async createDetachedWindow(request: CreateDetachedWindowRequest): Promise<DetachedWindow> {
    return await invoke<DetachedWindow>('create_detached_window', { request });
  }

  static async closeDetachedWindow(noteId: string): Promise<boolean> {
    return await invoke<boolean>('close_detached_window', { noteId });
  }

  static async getDetachedWindows(): Promise<DetachedWindow[]> {
    const result = await invoke<{[key: string]: DetachedWindow}>('get_detached_windows');
    
    // Convert HashMap to array and filter out hybrid-drag windows (just in case backend didn't filter)
    const windowsArray = Object.values(result).filter(window => 
      window.window_label.startsWith('note-')
    );
    
    return windowsArray;
  }

  static async updateWindowPosition(windowLabel: string, x: number, y: number): Promise<void> {
    return await invoke('update_detached_window_position', { windowLabel, x, y });
  }

  static async updateWindowSize(windowLabel: string, width: number, height: number): Promise<void> {
    return await invoke('update_detached_window_size', { windowLabel, width, height });
  }

  static async toggleWindowShade(windowLabel: string): Promise<boolean> {
    return await invoke<boolean>('toggle_window_shade', { windowLabel });
  }

  static async toggleMainWindowShade(): Promise<boolean> {
    return await invoke<boolean>('toggle_main_window_shade');
  }

  static async focusDetachedWindow(noteId: string): Promise<boolean> {
    return await invoke<boolean>('focus_detached_window', { noteId });
  }

  static async restoreDetachedWindows(): Promise<string[]> {
    return await invoke<string[]>('restore_detached_windows');
  }

  static async clearAllDetachedWindows(): Promise<number> {
    return await invoke<number>('clear_all_detached_windows');
  }
}