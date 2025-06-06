import { useEffect, useCallback } from 'react';
import { getCurrent } from '@tauri-apps/api/window';
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
        const window = getCurrent();
        await window.setOpacity(config.opacity);
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
        const window = getCurrent();
        await window.setAlwaysOnTop(config.alwaysOnTop);
      } catch (error) {
        console.error('Failed to apply always on top:', error);
      }
    };
    
    applyAlwaysOnTop();
  }, [config.alwaysOnTop]);

  const updateOpacity = useCallback(async (newOpacity: number) => {
    try {
      const window = getCurrent();
      await window.setOpacity(newOpacity);
      await updateOpacityConfig(newOpacity);
    } catch (error) {
      console.error('Failed to set window opacity:', error);
    }
  }, [updateOpacityConfig]);

  const toggleAlwaysOnTop = useCallback(async () => {
    try {
      const window = getCurrent();
      const current = await window.isAlwaysOnTop();
      await window.setAlwaysOnTop(!current);
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