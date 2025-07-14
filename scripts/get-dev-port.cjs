#!/usr/bin/env node

/**
 * Developer-specific port assignment for Blink
 * Each developer gets their own port to avoid conflicts
 */

const fs = require('fs');
const path = require('path');

// Developer port mapping
const DEV_PORTS = {
  'arach': 5173,
  'claude': 5174,
  'default': 5175
};

// Process name mapping for clarity
const DEV_PROCESS_NAMES = {
  'arach': 'blink.vite.arach',
  'claude': 'blink.vite.claude',
  'default': 'blink.vite.dev'
};

function getDevConfig() {
  const projectRoot = path.join(__dirname, '..');
  const envFile = path.join(projectRoot, '.env.local');
  
  let developer = 'default';
  let customPort = null;
  
  // Try to read .env.local
  if (fs.existsSync(envFile)) {
    const envContent = fs.readFileSync(envFile, 'utf8');
    
    // Parse BLINK_DEVELOPER
    const devMatch = envContent.match(/BLINK_DEVELOPER\s*=\s*([^\s#]+)/);
    if (devMatch) {
      developer = devMatch[1].trim();
    }
    
    // Parse custom VITE_PORT
    const portMatch = envContent.match(/VITE_PORT\s*=\s*(\d+)/);
    if (portMatch) {
      customPort = parseInt(portMatch[1], 10);
    }
  }
  
  // Environment variable override
  if (process.env.BLINK_DEVELOPER) {
    developer = process.env.BLINK_DEVELOPER;
  }
  
  if (process.env.VITE_PORT) {
    customPort = parseInt(process.env.VITE_PORT, 10);
  }
  
  // Determine final port
  const port = customPort || DEV_PORTS[developer] || DEV_PORTS.default;
  const processName = DEV_PROCESS_NAMES[developer] || DEV_PROCESS_NAMES.default;
  
  return {
    developer,
    port,
    processName,
    isCustomPort: !!customPort
  };
}

// CLI interface
if (require.main === module) {
  const config = getDevConfig();
  
  const arg = process.argv[2];
  switch (arg) {
    case 'port':
      console.log(config.port);
      break;
    case 'process-name':
      console.log(config.processName);
      break;
    case 'developer':
      console.log(config.developer);
      break;
    case 'json':
      console.log(JSON.stringify(config, null, 2));
      break;
    default:
      console.log(`Developer: ${config.developer}`);
      console.log(`Port: ${config.port}${config.isCustomPort ? ' (custom)' : ''}`);
      console.log(`Process Name: ${config.processName}`);
      break;
  }
}

module.exports = { getDevConfig, DEV_PORTS, DEV_PROCESS_NAMES };