import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "fs";

// Get developer-specific configuration with robust fallbacks
const getDevConfig = () => {
  // Start with safe defaults
  let developer = "default";
  let port = 5173;
  let isCustomPort = false;
  
  try {
    // First check environment variables (highest priority)
    if (process.env.VITE_PORT) {
      const envPort = parseInt(process.env.VITE_PORT, 10);
      if (!isNaN(envPort) && envPort > 0 && envPort < 65536) {
        port = envPort;
        isCustomPort = true;
      }
    }
    
    if (process.env.BLINK_DEVELOPER) {
      developer = process.env.BLINK_DEVELOPER;
    }
    
    // If no custom port from env, try reading .env.local file
    if (!isCustomPort) {
      try {
        const envPath = path.join(__dirname, ".env.local");
        if (fs.existsSync(envPath)) {
          const envContent = fs.readFileSync(envPath, "utf8");
          
          // Only update developer if not set from environment
          if (!process.env.BLINK_DEVELOPER) {
            const devMatch = envContent.match(/BLINK_DEVELOPER\s*=\s*([^\s#]+)/);
            if (devMatch) {
              developer = devMatch[1].trim();
            }
          }
          
          // Only check file port if not set from environment
          if (!process.env.VITE_PORT) {
            const portMatch = envContent.match(/VITE_PORT\s*=\s*(\d+)/);
            if (portMatch) {
              const filePort = parseInt(portMatch[1], 10);
              if (!isNaN(filePort) && filePort > 0 && filePort < 65536) {
                port = filePort;
                isCustomPort = true;
              }
            }
          }
        }
      } catch (fileError) {
        console.warn("Could not read .env.local, using defaults");
      }
    }
    
    // If still no custom port, use developer-specific defaults
    if (!isCustomPort) {
      const devPorts: Record<string, number> = {
        'arach': 5173,
        'claude': 5174,
        'default': 5175
      };
      
      port = devPorts[developer] || devPorts.default;
    }
    
    return { developer, port, isCustomPort };
  } catch (error) {
    console.warn("Error in dev config, using safe defaults:", (error as Error).message);
    return { developer: "default", port: 5173, isCustomPort: false };
  }
};

// https://vitejs.dev/config/
export default defineConfig(async () => {
  const devConfig = getDevConfig();
  
  console.log(`🔧 Vite configured for developer: ${devConfig.developer}`);
  console.log(`📡 Using port: ${devConfig.port}${devConfig.isCustomPort ? ' (custom)' : ''}`);
  
  return {
    plugins: [react()],

    // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
    //
    // 1. prevent vite from obscuring rust errors
    clearScreen: false,
    // 2. tauri expects a fixed port, fail if that port is not available
    server: {
      port: devConfig.port,
      strictPort: true,
      watch: {
        // 3. tell vite to ignore watching `src-tauri`
        ignored: ["**/src-tauri/**"],
      },
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});