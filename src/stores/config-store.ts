import { create } from 'zustand';
import { AppConfig, defaultConfig } from '../types/config';
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
}

export const useConfigStore = create<ConfigStore>((set, get) => ({
  config: defaultConfig,
  isLoading: false,
  error: null,

  loadConfig: async () => {
    set({ isLoading: true, error: null });
    try {
      const config = await configApi.getConfig();
      set({ config, isLoading: false });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to load config',
        isLoading: false 
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
    const updatedConfig = { ...config, ...configUpdate };
    
    try {
      const newConfig = await configApi.updateConfig(updatedConfig);
      set({ config: newConfig });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to update config'
      });
    }
  },
}));