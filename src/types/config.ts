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
  opacity: 0.55,
  alwaysOnTop: false,
  shortcuts: {
    toggleVisibility: 'Cmd+Ctrl+Alt+Shift+N',
  },
  window: {
    width: 1000,
    height: 700,
  },
};