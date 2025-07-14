import { invoke } from '@tauri-apps/api/core';
import { AppConfig } from '../types/config';

export const configApi = {
  async getConfig(): Promise<AppConfig> {
    try {
      const config = await invoke<AppConfig>('get_config');
      
      if (!config) {
        throw new Error('Backend returned null config');
      }
      
      if (!config.appearance) {
        throw new Error('Backend returned invalid config - missing appearance');
      }
      
      return config;
    } catch (error) {
      console.error('[BLINK] Error getting config:', error);
      throw error;
    }
  },

  async updateConfig(config: AppConfig): Promise<AppConfig> {
    try {
      const result = await invoke<AppConfig>('update_config', { newConfig: config });
      
      if (!result) {
        throw new Error('Backend returned null on config update');
      }
      
      if (!result.appearance) {
        throw new Error('Backend returned invalid config on update - missing appearance');
      }
      
      return result;
    } catch (error) {
      console.error('[BLINK] Error updating config:', error);
      throw error;
    }
  },

  async toggleWindowVisibility(): Promise<boolean> {
    try {
      return await invoke('toggle_window_visibility');
    } catch (error) {
      console.error('[BLINK] Error toggling window visibility:', error);
      throw error;
    }
  },
};