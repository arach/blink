import { useEffect, useCallback } from 'react';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { invoke } from '@tauri-apps/api/core';
import { useConfigStore } from '../stores/config-store';

export const useWindowTransparency = () => {
  const { config, updateOpacity: updateOpacityConfig, updateAlwaysOnTop } = useConfigStore();

  // Ensure window is visible on mount
  useEffect(() => {
    const ensureVisible = async () => {
      try {
        // Only run in Tauri context
        if (typeof window !== 'undefined' && window.__TAURI__) {
          const appWindow = getCurrentWebviewWindow();
          await appWindow.show();
          await appWindow.center();
        }
      } catch (error) {
        console.error('Failed to ensure window visibility:', error);
      }
    };
    
    ensureVisible();
  }, []);

  // Apply opacity to window when config changes
  useEffect(() => {
    const applyOpacity = async () => {
      try {
        // Only run in Tauri context and when config is available
        if (typeof window !== 'undefined' && window.__TAURI__ && config && typeof config.opacity === 'number') {
          console.log('Applying opacity:', config.opacity);
          await invoke('set_window_opacity', { opacity: config.opacity });
        }
      } catch (error) {
        console.error('Failed to apply window opacity:', error);
      }
    };
    
    applyOpacity();
  }, [config?.opacity]);

  // Apply always on top when config changes
  useEffect(() => {
    const applyAlwaysOnTop = async () => {
      try {
        // Only run in Tauri context and when config is available
        if (typeof window !== 'undefined' && window.__TAURI__ && config && typeof config.alwaysOnTop === 'boolean') {
          await invoke('set_window_always_on_top', { alwaysOnTop: config.alwaysOnTop });
        }
      } catch (error) {
        console.error('Failed to apply always on top:', error);
      }
    };
    
    applyAlwaysOnTop();
  }, [config?.alwaysOnTop]);

  const updateOpacity = useCallback(async (newOpacity: number) => {
    try {
      await invoke('set_window_opacity', { opacity: newOpacity });
      await updateOpacityConfig(newOpacity);
    } catch (error) {
      console.error('Failed to set window opacity:', error);
    }
  }, [updateOpacityConfig]);

  const toggleAlwaysOnTop = useCallback(async () => {
    try {
      // Only run in Tauri context
      if (typeof window !== 'undefined' && window.__TAURI__) {
        const appWindow = getCurrentWebviewWindow();
        const current = await appWindow.isAlwaysOnTop();
        await invoke('set_window_always_on_top', { alwaysOnTop: !current });
        await updateAlwaysOnTop(!current);
        return !current;
      }
      return false;
    } catch (error) {
      console.error('Failed to toggle always on top:', error);
      return false;
    }
  }, [updateAlwaysOnTop]);

  return {
    opacity: config?.opacity ?? 1,
    isTransparent: (config?.opacity ?? 1) < 1.0,
    alwaysOnTop: config?.alwaysOnTop ?? false,
    updateOpacity,
    toggleAlwaysOnTop,
  };
};