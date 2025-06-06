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
}

export const defaultConfig: AppConfig = {
  opacity: 0.9,
  alwaysOnTop: false,
  shortcuts: {
    toggleVisibility: 'CommandOrControl+Shift+N',
  },
  window: {
    width: 1200,
    height: 800,
  },
};