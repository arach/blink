import { useEffect } from 'react';
import { useConfigStore } from '../stores/config-store';
import { useDetachedWindowsStore } from '../stores/detached-windows-store';
import { applyTheme, getThemeById } from '../types';

interface AppInitializationProps {
  isDetachedWindow: boolean;
}

export function useAppInitialization({ isDetachedWindow }: AppInitializationProps) {
  const { config, loadConfig } = useConfigStore();
  const { loadWindows } = useDetachedWindowsStore();

  // Load config and windows on startup
  useEffect(() => {
    console.log('[BLINK] [FRONTEND] App initialization starting...');
    console.log('[BLINK] [FRONTEND] Tauri detection:', {
      windowExists: typeof window !== 'undefined',
      tauriExists: typeof window !== 'undefined' && !!window.__TAURI__,
      tauriValue: typeof window !== 'undefined' ? window.__TAURI__ : 'window undefined',
      href: window.location.href,
      userAgent: navigator.userAgent.includes('Tauri')
    });
    
    const initializeApp = async () => {
      await loadConfig();
      await loadWindows();
      console.log('[BLINK] [FRONTEND] ✅ App initialization complete');
      
      // DEBUG: Add a global function to test restore
      (window as any).testRestoreWindows = async () => {
        try {
          console.log('Calling restore_detached_windows...');
          const { invoke } = await import('@tauri-apps/api/core');
          const restored = await invoke<string[]>('restore_detached_windows');
          console.log('Restored windows:', restored);
        } catch (error) {
          console.error('Failed to restore windows:', error);
        }
      };
    };
    
    initializeApp();
  }, [isDetachedWindow, loadWindows, loadConfig]);

  // Apply theme on startup and when config changes
  useEffect(() => {
    const themeId = config?.appearance?.themeId || 'midnight-ink';
    const theme = getThemeById(themeId);
    
    if (theme) {
      applyTheme(theme);
    } else {
      console.error('[BLINK] Theme not found:', themeId);
    }
  }, [config]);
}