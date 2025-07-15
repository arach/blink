import { useState, useCallback } from 'react';

interface ModifiedState {
  isModified: boolean;
  lastContent: string | null;
}

export function useModifiedState() {
  const [state, setState] = useState<ModifiedState>({
    isModified: false,
    lastContent: null,
  });

  const markModified = useCallback(() => {
    setState(prev => ({ ...prev, isModified: true }));
  }, []);

  const markSaved = useCallback((content: string) => {
    setState({
      isModified: false,
      lastContent: content,
    });
  }, []);

  const checkIfModified = useCallback((currentContent: string): boolean => {
    if (state.lastContent === null) return false;
    return currentContent !== state.lastContent;
  }, [state.lastContent]);

  return {
    isModified: state.isModified,
    markModified,
    markSaved,
    checkIfModified,
  };
}