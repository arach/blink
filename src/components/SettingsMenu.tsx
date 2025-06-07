import { useState, useEffect } from 'react';
import { useConfigStore } from '../stores/config-store';

interface SettingsMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsMenu({ isOpen, onClose }: SettingsMenuProps) {
  const { config, updateConfig, loadConfig, isLoading } = useConfigStore();
  const [localConfig, setLocalConfig] = useState(config);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  useEffect(() => {
    if (isOpen) {
      console.log('Settings menu opened, loading config...');
      loadConfig();
    }
  }, [isOpen, loadConfig]);

  useEffect(() => {
    console.log('Config changed:', config);
    // Ensure config has proper structure with safe defaults
    const safeConfig = {
      ...config,
      appearance: {
        ...(config.appearance || {}),
        fontSize: config.appearance?.fontSize || 15,
        theme: config.appearance?.theme || 'dark',
        editorFontFamily: config.appearance?.editorFontFamily || 'system-ui',
        lineHeight: config.appearance?.lineHeight || 1.6,
        accentColor: config.appearance?.accentColor || '#3b82f6',
      },
    };
    setLocalConfig(safeConfig);
  }, [config]);

  const handleSave = async () => {
    setSaveStatus('saving');
    try {
      await updateConfig(localConfig);
      await loadConfig(); // Reload to ensure UI reflects saved state
      setSaveStatus('saved');
      setTimeout(() => {
        onClose();
        setSaveStatus('idle');
      }, 500);
    } catch (error) {
      console.error('Failed to save config:', error);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  const handleReset = () => {
    setLocalConfig(config);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="glass-panel w-full max-w-2xl mx-4 max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-border/20">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Settings</h2>
              <p className="text-sm text-muted-foreground/70 mt-1">
                Customize your notes app experience
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center text-muted-foreground/60 hover:text-foreground hover:bg-white/10 transition-colors rounded"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-8">
          
          {/* Appearance Section */}
          <div>
            <h3 className="text-base font-medium text-foreground mb-4 flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary">
                <circle cx="12" cy="12" r="3"/>
                <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1"/>
              </svg>
              Appearance
            </h3>
            
            <div className="space-y-6">
              {/* Font Size */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-3">
                  Font Size
                </label>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-muted-foreground/60 w-8">12px</span>
                  <input
                    type="range"
                    min="12"
                    max="24"
                    step="1"
                    value={localConfig.appearance?.fontSize ?? 15}
                    onChange={(e) => setLocalConfig({
                      ...localConfig,
                      appearance: {
                        ...localConfig.appearance,
                        fontSize: parseInt(e.target.value)
                      }
                    })}
                    className="flex-1 h-2 bg-background/40 rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                  <span className="text-xs text-muted-foreground/60 w-8">24px</span>
                  <span className="text-sm text-foreground min-w-[3rem] text-center">
                    {localConfig.appearance?.fontSize ?? 15}px
                  </span>
                </div>
                <div className="mt-3 p-3 bg-background/30 rounded border border-border/20">
                  <div 
                    className="text-muted-foreground/80"
                    style={{ fontSize: `${localConfig.appearance?.fontSize ?? 15}px` }}
                  >
                    Sample text at current font size
                  </div>
                </div>
              </div>

              {/* Line Height */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-3">
                  Line Height
                </label>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-muted-foreground/60 w-8">1.2</span>
                  <input
                    type="range"
                    min="1.2"
                    max="2.0"
                    step="0.1"
                    value={localConfig.appearance?.lineHeight ?? 1.6}
                    onChange={(e) => setLocalConfig({
                      ...localConfig,
                      appearance: {
                        ...localConfig.appearance,
                        lineHeight: parseFloat(e.target.value)
                      }
                    })}
                    className="flex-1 h-2 bg-background/40 rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                  <span className="text-xs text-muted-foreground/60 w-8">2.0</span>
                  <span className="text-sm text-foreground min-w-[2.5rem] text-center">
                    {localConfig.appearance?.lineHeight ?? 1.6}
                  </span>
                </div>
              </div>

              {/* Font Family */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-3">
                  Editor Font
                </label>
                <select
                  value={localConfig.appearance?.editorFontFamily ?? 'system-ui'}
                  onChange={(e) => setLocalConfig({
                    ...localConfig,
                    appearance: {
                      ...localConfig.appearance,
                      editorFontFamily: e.target.value
                    }
                  })}
                  className="w-full p-3 bg-background/20 border border-border/20 rounded text-foreground text-sm focus:outline-none focus:border-primary/40 hover:bg-background/30 transition-colors appearance-none cursor-pointer"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                    backgroundPosition: 'right 0.5rem center',
                    backgroundRepeat: 'no-repeat',
                    backgroundSize: '1.5em 1.5em',
                    paddingRight: '2.5rem'
                  }}
                >
                  <option value="system-ui">System Default</option>
                  <option value="ui-monospace">Monospace</option>
                  <option value="'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace">SF Mono</option>
                  <option value="'JetBrains Mono', monospace">JetBrains Mono</option>
                  <option value="'Fira Code', monospace">Fira Code</option>
                </select>
              </div>
            </div>
          </div>

          {/* Window Section */}
          <div>
            <h3 className="text-base font-medium text-foreground mb-4 flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <line x1="9" y1="9" x2="15" y2="9"/>
                <line x1="9" y1="15" x2="15" y2="15"/>
              </svg>
              Window
            </h3>
            
            <div className="space-y-6">
              {/* Opacity */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-3">
                  Window Opacity
                </label>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-muted-foreground/60 w-8">30%</span>
                  <input
                    type="range"
                    min="0.3"
                    max="1.0"
                    step="0.05"
                    value={localConfig.opacity}
                    onChange={(e) => setLocalConfig({
                      ...localConfig,
                      opacity: parseFloat(e.target.value)
                    })}
                    className="flex-1 h-2 bg-background/40 rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                  <span className="text-xs text-muted-foreground/60 w-8">100%</span>
                  <span className="text-sm text-foreground min-w-[3rem] text-center">
                    {Math.round(localConfig.opacity * 100)}%
                  </span>
                </div>
              </div>

              {/* Always on Top */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-foreground">
                    Always on Top
                  </label>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    Keep the main window above other applications
                  </p>
                </div>
                <button
                  onClick={() => setLocalConfig({
                    ...localConfig,
                    alwaysOnTop: !localConfig.alwaysOnTop
                  })}
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    localConfig.alwaysOnTop ? 'bg-primary' : 'bg-background/40 border border-border/40'
                  }`}
                >
                  <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                    localConfig.alwaysOnTop ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-6 border-t border-border/20 flex items-center justify-between">
          <button
            onClick={handleReset}
            className="px-4 py-2 text-sm text-muted-foreground/70 hover:text-foreground transition-colors"
          >
            Reset Changes
          </button>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-muted-foreground/70 hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isLoading || saveStatus === 'saving'}
              className={`px-4 py-2 text-sm rounded transition-all disabled:opacity-50 ${
                saveStatus === 'saved' 
                  ? 'bg-green-600 text-white' 
                  : saveStatus === 'error'
                  ? 'bg-red-600 text-white'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90'
              }`}
            >
              {saveStatus === 'saving' ? 'Saving...' : 
               saveStatus === 'saved' ? '✓ Saved' :
               saveStatus === 'error' ? 'Error' :
               'Save Settings'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}