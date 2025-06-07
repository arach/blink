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
    theme: 'dark' | 'light' | 'system';
    editorFontFamily: string;
    lineHeight: number;
    accentColor: string;
  };
}

export const defaultConfig: AppConfig = {
  opacity: 0.55,
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
    theme: 'dark',
    editorFontFamily: 'system-ui',
    lineHeight: 1.6,
    accentColor: '#3b82f6',
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