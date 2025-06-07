import { invoke } from '@tauri-apps/api/core';
import { AppConfig } from '../types/config';

export const configApi = {
  async getConfig(): Promise<AppConfig> {
    return await invoke('get_config');
  },

  async updateConfig(config: AppConfig): Promise<AppConfig> {
    return await invoke('update_config', { new_config: config });
  },

  async toggleWindowVisibility(): Promise<boolean> {
    return await invoke('toggle_window_visibility');
  },
};