import { useEffect, useCallback } from 'react';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { invoke } from '@tauri-apps/api/core';
import { useConfigStore } from '../stores/config-store';

export const useWindowTransparency = () => {
  const { config, updateOpacity: updateOpacityConfig, updateAlwaysOnTop, loadConfig } = useConfigStore();

  // Load config on mount
  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // Apply opacity to window when config changes
  useEffect(() => {
    const applyOpacity = async () => {
      try {
        await invoke('set_window_opacity', { opacity: config.opacity });
      } catch (error) {
        console.error('Failed to apply window opacity:', error);
      }
    };
    
    applyOpacity();
  }, [config.opacity]);

  // Apply always on top when config changes
  useEffect(() => {
    const applyAlwaysOnTop = async () => {
      try {
        await invoke('set_window_always_on_top', { alwaysOnTop: config.alwaysOnTop });
      } catch (error) {
        console.error('Failed to apply always on top:', error);
      }
    };
    
    applyAlwaysOnTop();
  }, [config.alwaysOnTop]);

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
      const window = getCurrentWebviewWindow();
      const current = await window.isAlwaysOnTop();
      await invoke('set_window_always_on_top', { alwaysOnTop: !current });
      await updateAlwaysOnTop(!current);
      return !current;
    } catch (error) {
      console.error('Failed to toggle always on top:', error);
      return false;
    }
  }, [updateAlwaysOnTop]);

  return {
    opacity: config.opacity,
    isTransparent: config.opacity < 1.0,
    alwaysOnTop: config.alwaysOnTop,
    updateOpacity,
    toggleAlwaysOnTop,
  };
};