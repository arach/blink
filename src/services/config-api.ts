import { invoke } from '@tauri-apps/api/core';
import { AppConfig } from '../types/config';

export const configApi = {
  async getConfig(): Promise<AppConfig> {
    const config = await invoke<AppConfig>('get_config');
    console.log('Loaded config from backend:', JSON.stringify(config, null, 2));
    return config;
  },

  async updateConfig(config: AppConfig): Promise<AppConfig> {
    console.log('Sending config to backend:', JSON.stringify(config, null, 2));
    const result = await invoke<AppConfig>('update_config', { newConfig: config });
    console.log('Received from backend:', JSON.stringify(result, null, 2));
    return result;
  },

  async toggleWindowVisibility(): Promise<boolean> {
    return await invoke('toggle_window_visibility');
  },
};