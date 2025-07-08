import { invoke } from '@tauri-apps/api/core';
import { AppConfig } from '../types/config';

export const configApi = {
  async getConfig(): Promise<AppConfig> {
    console.log('[BLINK] [CONFIG-API] 🔄 Getting config from backend...');
    try {
      const config = await invoke<AppConfig>('get_config');
      console.log('[BLINK] [CONFIG-API] 📥 Loaded config from backend:', JSON.stringify(config, null, 2));
      
      if (!config) {
        console.error('[BLINK] [CONFIG-API] ❌ Backend returned null config!');
        throw new Error('Backend returned null config');
      }
      
      if (!config.appearance) {
        console.error('[BLINK] [CONFIG-API] ❌ Backend returned config without appearance!');
        throw new Error('Backend returned invalid config - missing appearance');
      }
      
      console.log('[BLINK] [CONFIG-API] ✅ Valid config received from backend');
      return config;
    } catch (error) {
      console.error('[BLINK] [CONFIG-API] ❌ Error getting config:', error);
      throw error;
    }
  },

  async updateConfig(config: AppConfig): Promise<AppConfig> {
    console.log('[BLINK] [CONFIG-API] 🔄 Updating config...');
    console.log('[BLINK] [CONFIG-API] 📤 Sending config to backend:', JSON.stringify(config, null, 2));
    
    try {
      const result = await invoke<AppConfig>('update_config', { newConfig: config });
      console.log('[BLINK] [CONFIG-API] 📥 Raw response from backend:', result);
      console.log('[BLINK] [CONFIG-API] 📥 Received from backend:', JSON.stringify(result, null, 2));
      
      if (!result) {
        console.error('[BLINK] [CONFIG-API] ❌ Backend returned null on update!');
        throw new Error('Backend returned null on config update');
      }
      
      if (!result.appearance) {
        console.error('[BLINK] [CONFIG-API] ❌ Backend returned config without appearance on update!');
        throw new Error('Backend returned invalid config on update - missing appearance');
      }
      
      console.log('[BLINK] [CONFIG-API] ✅ Valid config update response received');
      return result;
    } catch (error) {
      console.error('[BLINK] [CONFIG-API] ❌ Error updating config:', error);
      throw error;
    }
  },

  async toggleWindowVisibility(): Promise<boolean> {
    console.log('[BLINK] [CONFIG-API] 🔄 Toggling window visibility...');
    try {
      const result = await invoke('toggle_window_visibility');
      console.log('[BLINK] [CONFIG-API] ✅ Window visibility toggled:', result);
      return result;
    } catch (error) {
      console.error('[BLINK] [CONFIG-API] ❌ Error toggling window visibility:', error);
      throw error;
    }
  },
};