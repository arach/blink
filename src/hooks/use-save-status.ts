import { useState, useEffect, useRef } from 'react';

interface SaveStatus {
  isSaving: boolean;
  lastSaved: Date | null;
  saveError: string | null;
}

export function useSaveStatus() {
  const [status, setStatus] = useState<SaveStatus>({
    isSaving: false,
    lastSaved: null,
    saveError: null,
  });

  const timeoutRef = useRef<NodeJS.Timeout>();

  const startSaving = () => {
    setStatus(prev => ({ ...prev, isSaving: true, saveError: null }));
  };

  const saveSuccess = () => {
    setStatus({
      isSaving: false,
      lastSaved: new Date(),
      saveError: null,
    });

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  };

  const setSaveError = (error: string) => {
    setStatus(prev => ({ 
      ...prev, 
      isSaving: false, 
      saveError: error 
    }));
  };

  // Format relative time (e.g., "2 minutes ago")
  const getRelativeTime = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);

    if (diffSecs < 10) return 'just now';
    if (diffSecs < 60) return `${diffSecs}s ago`;
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    ...status,
    startSaving,
    saveSuccess,
    setSaveError,
    getRelativeTime: status.lastSaved ? getRelativeTime(status.lastSaved) : null,
  };
}