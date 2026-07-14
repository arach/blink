import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface UsePermissionsReturn {
  // State
  showPermissionPrompt: boolean;
  
  // Actions
  requestPermissions: () => void;
  dismissPermissionPrompt: () => void;
  openSystemSettings: () => Promise<void>;
}

export function usePermissions(): UsePermissionsReturn {
  const [showPermissionPrompt, setShowPermissionPrompt] = useState(false);

  // Request permissions with a delay to let the app settle
  const requestPermissions = useCallback(() => {
    console.log('[BLINK] Requesting permissions...');
    
    // Show permission prompt after a short delay to let the app settle
    setTimeout(() => {
      setShowPermissionPrompt(true);
    }, 2000);
  }, []);

  // Dismiss the permission prompt
  const dismissPermissionPrompt = useCallback(() => {
    setShowPermissionPrompt(false);
  }, []);

  // Open system settings for accessibility permissions
  const openSystemSettings = useCallback(async () => {
    try {
      await invoke('open_system_settings');
      console.log('[BLINK] Opened system settings');
    } catch (error) {
      console.error('[BLINK] Failed to open system settings:', error);
    }
  }, []);

  return {
    // State
    showPermissionPrompt,
    
    // Actions
    requestPermissions,
    dismissPermissionPrompt,
    openSystemSettings,
  };
}