import { useState, useEffect } from 'react';
import { useConfigStore } from '../stores/config-store';

type SettingsSection = 'general' | 'notes' | 'ai';

export function SettingsPanel() {
  const { config, updateConfig, loadConfig, isLoading } = useConfigStore();
  const [activeSection, setActiveSection] = useState<SettingsSection>('general');
  const [localConfig, setLocalConfig] = useState(config);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  useEffect(() => {
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
    console.log('Saving config:', localConfig);
    setSaveStatus('saving');
    try {
      await updateConfig(localConfig);
      await loadConfig(); // Reload to ensure UI reflects saved state
      setSaveStatus('saved');
      console.log('Config saved successfully');
      
      // Reset status after 2 seconds
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      console.error('Failed to save config:', error);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  const sections = [
    {
      id: 'general' as SettingsSection,
      name: 'General',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3"/>
          <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1"/>
        </svg>
      )
    },
    {
      id: 'notes' as SettingsSection,
      name: 'Notes',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14,2 14,8 20,8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
          <line x1="10" y1="9" x2="8" y2="9"/>
        </svg>
      )
    },
    {
      id: 'ai' as SettingsSection,
      name: 'AI & Plugins',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
        </svg>
      )
    }
  ];

  const renderGeneralSection = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-medium text-foreground mb-4">About</h3>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between items-center p-3 bg-background/30 rounded border border-border/20">
            <span className="text-muted-foreground">Application</span>
            <span className="text-foreground">Tauri Notes</span>
          </div>
          <div className="flex justify-between items-center p-3 bg-background/30 rounded border border-border/20">
            <span className="text-muted-foreground">Version</span>
            <span className="text-foreground">1.0.0</span>
          </div>
          <div className="flex justify-between items-center p-3 bg-background/30 rounded border border-border/20">
            <span className="text-muted-foreground">Author</span>
            <span className="text-foreground">AI-Native Spatial Notes</span>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-base font-medium text-foreground mb-4">Window</h3>
        <div className="space-y-4">
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
                onChange={(e) => {
                  const newConfig = { ...localConfig, opacity: parseFloat(e.target.value) };
                  setLocalConfig(newConfig);
                  updateConfig(newConfig); // Apply immediately for opacity
                }}
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
              onClick={() => {
                const newConfig = { ...localConfig, alwaysOnTop: !localConfig.alwaysOnTop };
                setLocalConfig(newConfig);
                updateConfig(newConfig);
              }}
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
  );

  const renderNotesSection = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-medium text-foreground mb-4">Appearance</h3>
        <div className="space-y-6">
          {/* Font Size */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-3">
              Font Size
            </label>
            <select
              value={localConfig.appearance?.fontSize ?? 15}
              onChange={(e) => setLocalConfig({
                ...localConfig,
                appearance: {
                  ...localConfig.appearance,
                  fontSize: parseInt(e.target.value)
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
              <option value="8">8px - Tiny</option>
              <option value="9">9px - Very Small</option>
              <option value="10">10px - Small</option>
              <option value="11">11px</option>
              <option value="12">12px</option>
              <option value="13">13px</option>
              <option value="14">14px - Default</option>
              <option value="15">15px</option>
              <option value="16">16px - Large</option>
              <option value="18">18px</option>
              <option value="20">20px - Extra Large</option>
              <option value="24">24px</option>
              <option value="28">28px</option>
              <option value="32">32px - Huge</option>
              <option value="36">36px</option>
              <option value="48">48px - Massive</option>
            </select>
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

          {/* Theme - Future */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-3">
              Theme
            </label>
            <div className="flex gap-2">
              <button 
                className="flex-1 p-3 bg-background/40 border border-primary/40 rounded text-sm"
                disabled
              >
                Dark
              </button>
              <button 
                className="flex-1 p-3 bg-background/20 border border-border/20 rounded text-sm text-muted-foreground/50"
                disabled
              >
                Light (Coming Soon)
              </button>
            </div>
          </div>

          {/* Accent Color */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-3">
              Accent Color
            </label>
            <div className="flex gap-2">
              {['#3b82f6', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#ef4444'].map(color => (
                <button
                  key={color}
                  onClick={() => setLocalConfig({
                    ...localConfig,
                    appearance: {
                      ...localConfig.appearance,
                      accentColor: color
                    }
                  })}
                  className={`w-10 h-10 rounded-lg border-2 transition-all ${
                    localConfig.appearance?.accentColor === color 
                      ? 'border-white scale-110' 
                      : 'border-transparent hover:border-white/40'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderAISection = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-medium text-foreground mb-4">AI Integration</h3>
        <div className="p-4 bg-background/30 rounded border border-border/20 text-center">
          <div className="w-12 h-12 mx-auto mb-3 bg-primary/10 rounded-lg flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary">
              <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
            </svg>
          </div>
          <h4 className="text-sm font-medium text-foreground mb-2">AI Features Coming Soon</h4>
          <p className="text-xs text-muted-foreground/70 leading-relaxed">
            AI-powered note understanding, conversational interfaces, and intelligent spatial organization will be available in Phase 2.
          </p>
        </div>
      </div>

      <div>
        <h3 className="text-base font-medium text-foreground mb-4">Plugins</h3>
        <div className="p-4 bg-background/30 rounded border border-border/20 text-center">
          <div className="w-12 h-12 mx-auto mb-3 bg-muted/10 rounded-lg flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground">
              <circle cx="12" cy="12" r="3"/>
              <path d="M3 12h3m12 0h3M12 3v3m0 12v3"/>
            </svg>
          </div>
          <h4 className="text-sm font-medium text-foreground mb-2">Plugin System</h4>
          <p className="text-xs text-muted-foreground/70 leading-relaxed">
            Extensible plugin architecture for custom integrations and workflows.
          </p>
        </div>
      </div>
    </div>
  );

  const renderSectionContent = () => {
    switch (activeSection) {
      case 'general':
        return renderGeneralSection();
      case 'notes':
        return renderNotesSection();
      case 'ai':
        return renderAISection();
      default:
        return renderGeneralSection();
    }
  };

  return (
    <div className="flex h-full">
      {/* Settings Navigation Sidebar */}
      <div className="w-48 bg-card border-r border-border/30 p-4 flex flex-col">
        <div className="mb-6">
          <h2 className="text-sm font-medium text-foreground">Settings</h2>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Customize your experience
          </p>
        </div>
        
        <nav className="space-y-1 flex-1">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded transition-colors ${
                activeSection === section.id
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/60'
              }`}
            >
              {section.icon}
              {section.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Settings Content */}
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-2xl">
          {renderSectionContent()}
          
          {/* Save Button */}
          {activeSection === 'notes' && (
            <div className="mt-8 pt-6 border-t border-border/20">
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
                 'Save Changes'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}