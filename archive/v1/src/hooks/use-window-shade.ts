import { useState, useEffect } from 'react';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { listen } from '@tauri-apps/api/event';

export function useWindowShade() {
  const [isShaded, setIsShaded] = useState(false);
  
  useEffect(() => {
    // Only run in Tauri context
    if (typeof window === 'undefined' || !window.__TAURI__) {
      return;
    }
    
    const appWindow = getCurrentWebviewWindow();
    
    // Check initial window height to determine if shaded
    const checkShadeState = async () => {
      try {
        const size = await appWindow.innerSize();
        // Window is considered shaded if height is 48px or less
        setIsShaded(size.height <= 48);
      } catch (error) {
        console.error('Failed to check window size:', error);
      }
    };
    
    // Check initial state
    checkShadeState();
    
    // Listen for window resize events
    const unlisten = appWindow.onResized(() => {
      checkShadeState();
    });
    
    // Also listen for custom shade toggle events if we emit them
    const unlistenShade = listen('window-shade-toggled', (event) => {
      setIsShaded(event.payload as boolean);
    });
    
    return () => {
      unlisten.then(fn => fn());
      unlistenShade.then(fn => fn());
    };
  }, []);
  
  return isShaded;
}