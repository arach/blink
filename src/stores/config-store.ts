import { create } from 'zustand';
import { AppConfig, defaultConfig, migrateConfig } from '../types/config';
import { configApi } from '../services/config-api';

interface ConfigStore {
  config: AppConfig;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  loadConfig: () => Promise<void>;
  updateOpacity: (opacity: number) => Promise<void>;
  updateAlwaysOnTop: (alwaysOnTop: boolean) => Promise<void>;
  updateConfig: (config: Partial<AppConfig>) => Promise<void>;
  updateAppearance: (appearance: Partial<AppConfig['appearance']>) => Promise<void>;
  updateFontSize: (fontSize: number) => Promise<void>;
  updateTheme: (theme: 'dark' | 'light' | 'system') => Promise<void>;
}

export const useConfigStore = create<ConfigStore>((set, get) => ({
  config: defaultConfig,
  isLoading: false,
  error: null,

  loadConfig: async () => {
    set({ isLoading: true, error: null });
    try {
      const rawConfig = await configApi.getConfig();
      
      if (!rawConfig) {
        console.warn('[BLINK] Received null config from backend, using defaults');
        set({ config: defaultConfig, isLoading: false });
        return;
      }
      
      const config = migrateConfig(rawConfig);
      
      if (!config || !config.appearance) {
        console.warn('[BLINK] Invalid config structure, using defaults');
        set({ config: defaultConfig, isLoading: false });
        return;
      }
      
      set({ config, isLoading: false });
    } catch (error) {
      console.warn('[BLINK] Failed to load config, using defaults:', error);
      set({ 
        config: defaultConfig,
        isLoading: false,
        error: null
      });
    }
  },

  updateOpacity: async (opacity: number) => {
    const { config } = get();
    const updatedConfig = { ...config, opacity };
    
    try {
      const newConfig = await configApi.updateConfig(updatedConfig);
      set({ config: newConfig });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to update opacity'
      });
    }
  },

  updateAlwaysOnTop: async (alwaysOnTop: boolean) => {
    const { config } = get();
    const updatedConfig = { ...config, alwaysOnTop };
    
    try {
      const newConfig = await configApi.updateConfig(updatedConfig);
      set({ config: newConfig });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to update always on top'
      });
    }
  },

  updateConfig: async (configUpdate: Partial<AppConfig>) => {
    const { config } = get();
    
    if (!config) {
      console.error('[BLINK] Current config is null! Using defaults');
      const newConfig = { ...defaultConfig, ...configUpdate };
      set({ config: newConfig });
      return;
    }
    
    // Deep merge to handle nested objects properly
    const updatedConfig: AppConfig = {
      ...config,
      ...configUpdate,
      appearance: {
        ...config.appearance,
        ...(configUpdate.appearance || {})
      },
      shortcuts: {
        ...config.shortcuts,
        ...(configUpdate.shortcuts || {})
      },
      window: {
        ...config.window,
        ...(configUpdate.window || {})
      }
    };
    
    try {
      const newConfig = await configApi.updateConfig(updatedConfig);
      
      if (!newConfig) {
        console.error('[BLINK] Backend returned null config');
        set({ error: 'Backend returned null config' });
        return;
      }
      
      if (!newConfig.appearance) {
        console.error('[BLINK] Backend returned invalid config structure');
        set({ 
          config: { ...defaultConfig, ...newConfig },
          error: 'Invalid config structure received'
        });
        return;
      }
      
      set({ config: newConfig });
    } catch (error) {
      console.error('[BLINK] Error updating config:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Failed to update config'
      });
    }
  },

  updateAppearance: async (appearance: Partial<AppConfig['appearance']>) => {
    const { config } = get();
    const updatedConfig = { 
      ...config, 
      appearance: { ...config.appearance, ...appearance }
    };
    
    try {
      const newConfig = await configApi.updateConfig(updatedConfig);
      set({ config: newConfig });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to update appearance'
      });
    }
  },

  updateFontSize: async (fontSize: number) => {
    const { updateAppearance } = get();
    await updateAppearance({ fontSize });
  },

  updateTheme: async (theme: 'dark' | 'light' | 'system') => {
    const { updateAppearance } = get();
    await updateAppearance({ theme });
  },
}));