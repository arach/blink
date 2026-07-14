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
    themeId?: string; // ID of the selected theme preset
    customTheme?: { // Custom theme overrides
      fonts?: {
        editor?: string;
        preview?: string;
        ui?: string;
      };
      colors?: Record<string, string>;
      backgroundTexture?: {
        type: 'none' | 'paper' | 'canvas' | 'grid' | 'dots' | 'noise' | 'gradient';
        opacity?: number;
        scale?: number;
        color?: string;
      };
    };
    editorFontFamily: string;
    previewFontFamily?: string;
    lineHeight: number;
    accentColor: string;
    backgroundPattern?: 'none' | 'paper' | 'canvas' | 'grid' | 'dots';
    notePaperStyle?: 'none' | 'dotted-grid' | 'lines' | 'ruled';
    syntaxHighlighting?: boolean;
    focusMode?: boolean;
    typewriterMode?: boolean;
    vimMode?: boolean;
    wordWrap?: boolean;
    showNotePreviews?: boolean;
    windowOpacity?: number; // Background transparency (0-1)
    appFontFamily: string;
  };
  editor?: {
    fontSize?: number;
    lineHeight?: number;
  };
  advanced?: {
    developerMode?: boolean;
    autoUpdate?: boolean;
  };
  storage?: {
    notesDirectory?: string; // Custom directory for notes, defaults to app data directory
    useCustomDirectory?: boolean; // Whether to use custom directory or default
  };
}

export const defaultConfig: AppConfig = {
  opacity: 1,
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
    notePaperStyle: 'none',
    syntaxHighlighting: true,
    focusMode: false,
    typewriterMode: false,
    vimMode: false,
    showNotePreviews: false,
    appFontFamily: 'system-ui',
  },
  editor: {
    fontSize: 16,
    lineHeight: 1.6,
  },
  advanced: {
    developerMode: false,
    autoUpdate: true,
  },
  storage: {
    notesDirectory: undefined, // Will use default app data directory
    useCustomDirectory: false,
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
    storage: {
      ...defaultConfig.storage,
      ...(config.storage || {}),
    },
  };
};