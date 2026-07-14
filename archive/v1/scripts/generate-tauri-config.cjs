#!/usr/bin/env node

/**
 * Generates tauri.conf.json with developer-specific configuration
 * Updates the devUrl to use the correct port for the current developer
 */

const fs = require('fs');
const path = require('path');
// Robust fallback for getting dev config
const getDevConfig = () => {
  try {
    const { getDevConfig } = require('./get-dev-port.cjs');
    return getDevConfig();
  } catch (error) {
    console.warn('Falling back to default port configuration');
    return { developer: 'default', port: 5173, isCustomPort: false };
  }
};

function generateTauriConfig() {
  const projectRoot = path.join(__dirname, '..');
  const configTemplatePath = path.join(projectRoot, 'src-tauri', 'tauri.conf.template.json');
  const configOutputPath = path.join(projectRoot, 'src-tauri', 'tauri.conf.json');
  
  // Get developer-specific configuration
  const devConfig = getDevConfig();
  
  // Read the existing config as a template
  let configTemplate;
  if (fs.existsSync(configTemplatePath)) {
    configTemplate = JSON.parse(fs.readFileSync(configTemplatePath, 'utf8'));
  } else {
    // Use the current config as template if template doesn't exist
    configTemplate = JSON.parse(fs.readFileSync(configOutputPath, 'utf8'));
  }
  
  // Update the devUrl with the dynamic port
  configTemplate.build.devUrl = `http://localhost:${devConfig.port}`;
  
  // Write the updated config
  fs.writeFileSync(configOutputPath, JSON.stringify(configTemplate, null, 2));
  
  console.log(`🔧 Updated Tauri config for developer: ${devConfig.developer}`);
  console.log(`📡 devUrl set to: http://localhost:${devConfig.port}`);
  
  return configTemplate;
}

// CLI interface
if (require.main === module) {
  try {
    generateTauriConfig();
  } catch (error) {
    console.error('Failed to generate Tauri config:', error.message);
    process.exit(1);
  }
}

module.exports = { generateTauriConfig };