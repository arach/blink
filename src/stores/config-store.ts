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

export const useConfigStore = create<ConfigStore>((set, get) => {
  console.log('[BLINK] [CONFIG] 🏗️  Config store initialized with default config:', defaultConfig);
  
  return {
    config: defaultConfig,
    isLoading: false,
    error: null,

  loadConfig: async () => {
    console.log('[BLINK] [CONFIG] 🔄 loadConfig called');
    set({ isLoading: true, error: null });
    try {
      // Try to load config from Tauri - if this fails, we'll use defaults
      console.log('[BLINK] [CONFIG] 🖥️  Attempting to load config from Tauri backend...');
      const rawConfig = await configApi.getConfig();
      console.log('[BLINK] [CONFIG] 📥 Raw config loaded from backend:', rawConfig);
      
      // Ensure we always have a valid config
      if (!rawConfig) {
        console.warn('[BLINK] [CONFIG] ⚠️  Received null/undefined config from backend, using defaults');
        set({ config: defaultConfig, isLoading: false });
        return;
      }
      
      const config = migrateConfig(rawConfig);
      console.log('[BLINK] [CONFIG] 🔄 Migrated config:', config);
      
      // Extra safety check
      if (!config || !config.appearance) {
        console.warn('[BLINK] [CONFIG] ⚠️  Migration resulted in invalid config, using defaults');
        set({ config: defaultConfig, isLoading: false });
        return;
      }
      
      console.log('[BLINK] [CONFIG] ✅ Setting valid config in store');
      set({ config, isLoading: false });
    } catch (error) {
      console.warn('[BLINK] [CONFIG] ❌ Failed to load config from Tauri, using defaults:', error);
      // Browser mode or Tauri failed - use defaults
      console.log('[BLINK] [CONFIG] 🌐 Using default config (browser mode or Tauri unavailable)');
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
    console.log('[BLINK] [CONFIG] 🔄 updateConfig called with:', configUpdate);
    const { config } = get();
    console.log('[BLINK] [CONFIG] 📋 Current config in store:', config);
    
    // Ensure we have a valid config before merging
    if (!config) {
      console.error('[BLINK] [CONFIG] ❌ Current config is null! Using defaults');
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
    
    console.log('[BLINK] [CONFIG] 📤 Sending merged config to backend:', updatedConfig);
    
    try {
      const newConfig = await configApi.updateConfig(updatedConfig);
      console.log('[BLINK] [CONFIG] 📥 Received response from backend:', newConfig);
      
      // Critical: Handle null response from backend
      if (!newConfig) {
        console.error('[BLINK] [CONFIG] ❌ Backend returned null! Keeping current config');
        set({ 
          error: 'Backend returned null config - using current config'
        });
        return;
      }
      
      // Validate the response has required fields
      if (!newConfig.appearance) {
        console.error('[BLINK] [CONFIG] ❌ Backend returned config without appearance! Using defaults');
        set({ 
          config: { ...defaultConfig, ...newConfig },
          error: 'Backend returned invalid config - merged with defaults'
        });
        return;
      }
      
      console.log('[BLINK] [CONFIG] ✅ Setting valid config from backend response');
      set({ config: newConfig });
    } catch (error) {
      console.error('[BLINK] [CONFIG] ❌ Error updating config:', error);
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
}});