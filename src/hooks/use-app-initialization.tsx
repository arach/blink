import { useEffect } from 'react';
import { useConfigStore } from '../stores/config-store';
import { useDetachedWindowsStore } from '../stores/detached-windows-store';
import { applyTheme, getThemeById } from '../types';
import { listen } from '@tauri-apps/api/event';

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
      // Just request the data - backend will load it asynchronously
      console.log('[BLINK] [FRONTEND] Requesting initial data...');
      Promise.all([
        loadConfig().catch(err => console.warn('[BLINK] Config load failed:', err)),
        loadWindows().catch(err => console.warn('[BLINK] Windows load failed:', err))
      ]);
      
      // Listen for data-loaded event from backend
      const unlisten = await listen('data-loaded', () => {
        console.log('[BLINK] [FRONTEND] ✅ Backend data loaded, refreshing...');
        loadConfig();
        loadWindows();
      });
      
      // Clean up listener on unmount
      return () => {
        unlisten();
      };
    };
    
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
    
    let cleanup: (() => void) | undefined;
    initializeApp().then(cleanupFn => {
      cleanup = cleanupFn;
    });
    
    return () => {
      if (cleanup) cleanup();
    };
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