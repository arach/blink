export interface AppConfig {
  opacity: number;
  alwaysOnTop: boolean;
  shortcuts: {
    toggleVisibility: string;
  };
  window: {
    width: number;
    height: number;
    x?: number;
    y?: number;
  };
  appearance: {
    fontSize: number;
    contentFontSize?: number;
    theme: 'dark' | 'light' | 'system';
    editorFontFamily: string;
    previewFontFamily?: string;
    lineHeight: number;
    accentColor: string;
    backgroundPattern?: 'none' | 'paper' | 'canvas' | 'grid' | 'dots';
    syntaxHighlighting?: boolean;
    focusMode?: boolean;
    typewriterMode?: boolean;
    showNotePreviews?: boolean;
  };
}

export const defaultConfig: AppConfig = {
  opacity: 0.95,
  alwaysOnTop: false,
  shortcuts: {
    toggleVisibility: 'Cmd+Ctrl+Alt+Shift+N',
  },
  window: {
    width: 1000,
    height: 700,
  },
  appearance: {
    fontSize: 15,
    contentFontSize: 16,
    theme: 'dark',
    editorFontFamily: 'system-ui',
    previewFontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    lineHeight: 1.6,
    accentColor: '#3b82f6',
    backgroundPattern: 'none',
    syntaxHighlighting: true,
    focusMode: false,
    typewriterMode: false,
    showNotePreviews: false,
  },
};

// Migration helper for old configs
export const migrateConfig = (config: any): AppConfig => {
  return {
    ...defaultConfig,
    ...config,
    appearance: {
      ...defaultConfig.appearance,
      ...(config.appearance || {}),
    },
  };
};