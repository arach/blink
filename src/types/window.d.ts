// Type definitions for Tauri window extensions
declare global {
  interface Window {
    __TAURI__?: boolean;
  }
}

export {};