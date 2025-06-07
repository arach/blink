import { useState, useEffect } from 'react';
import { useConfigStore } from '../stores/config-store';
import { invoke } from '@tauri-apps/api/core';

type SettingsSection = 'general' | 'appearance' | 'ai';

export function SettingsPanel() {
  const { config, updateConfig, loadConfig, isLoading } = useConfigStore();
  const [activeSection, setActiveSection] = useState<SettingsSection>('general');
  const [localConfig, setLocalConfig] = useState(config);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  useEffect(() => {
    // Set localConfig to match the loaded config directly
    setLocalConfig(config);
  }, [config]);

  const handleSave = async () => {
    console.log('Saving config:', localConfig);
    setSaveStatus('saving');
    try {
      await updateConfig(localConfig);
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
      id: 'appearance' as SettingsSection,
      name: 'Appearance',
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
    <div className="space-y-6 pb-8">
      <div className="bg-card/20 rounded p-4 border border-border/10">
        <h3 className="text-xs font-medium text-foreground/90 mb-4 flex items-center gap-2 uppercase tracking-wide">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground/70">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 8v4l3 3"/>
          </svg>
          About
        </h3>
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

    </div>
  );

  const renderAppearanceSection = () => (
    <div className="w-full">
      <div className="space-y-6">
        {/* Typography Group */}
        <div className="bg-card/20 rounded p-4 border border-border/10">
          <h3 className="text-xs font-medium text-foreground/90 mb-4 flex items-center gap-2 uppercase tracking-wide">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground/70">
              <path d="M4 7V4h16v3M9 20h6M12 4v16"/>
            </svg>
            Typography
          </h3>
          <div className="space-y-3">
            
            {/* Editor Font Size - Single Line */}
            <div className="flex items-center gap-3">
              <label className="text-xs text-foreground/80 w-28 font-mono">Editor Font Size</label>
              <div className="flex-1 flex items-center gap-3">
                <span className="text-xs text-muted-foreground/70" style={{ fontSize: '11px' }}>A</span>
                <div className="flex-1 relative h-5 slider-container">
                  <div className="slider-track"></div>
                  <div className="slider-ticks">
                    <div className="slider-tick" style={{ left: '9%' }}></div>
                    <div className="slider-tick" style={{ left: '27%' }}></div>
                    <div className="slider-tick" style={{ left: '50%' }}></div>
                    <div className="slider-tick" style={{ left: '77%' }}></div>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="32"
                    step="1"
                    value={localConfig.appearance?.fontSize ?? 15}
                    onChange={(e) => setLocalConfig({
                      ...localConfig,
                      appearance: {
                        ...localConfig.appearance,
                        fontSize: parseInt(e.target.value)
                      }
                    })}
                    className="slider-input"
                  />
                </div>
                <span className="text-muted-foreground/70" style={{ fontSize: '20px' }}>A</span>
              </div>
              <span className="text-xs text-muted-foreground/70 min-w-[2.5rem] text-right font-mono">
                {localConfig.appearance?.fontSize ?? 15}px
              </span>
            </div>

            {/* Content Font Size - Single Line */}
            <div className="flex items-center gap-3">
              <label className="text-xs text-foreground/80 w-28 font-mono">Content Font Size</label>
              <div className="flex-1 flex items-center gap-3">
                <span className="text-xs text-muted-foreground/70" style={{ fontSize: '11px' }}>A</span>
                <div className="flex-1 relative h-5 slider-container">
                  <div className="slider-track"></div>
                  <div className="slider-ticks">
                    <div className="slider-tick" style={{ left: '9%' }}></div>
                    <div className="slider-tick" style={{ left: '27%' }}></div>
                    <div className="slider-tick" style={{ left: '50%' }}></div>
                    <div className="slider-tick" style={{ left: '77%' }}></div>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="32"
                    step="1"
                    value={localConfig.appearance?.contentFontSize ?? 16}
                    onChange={(e) => setLocalConfig({
                      ...localConfig,
                      appearance: {
                        ...localConfig.appearance,
                        contentFontSize: parseInt(e.target.value)
                      }
                    })}
                    className="slider-input"
                  />
                </div>
                <span className="text-muted-foreground/70" style={{ fontSize: '20px' }}>A</span>
              </div>
              <span className="text-xs text-muted-foreground/70 min-w-[2.5rem] text-right font-mono">
                {localConfig.appearance?.contentFontSize ?? 16}px
              </span>
            </div>

            {/* Editor Font - Single Line */}
            <div className="flex items-center gap-3">
              <label className="text-xs text-foreground/80 w-28 font-mono">Editor Font</label>
              <div className="flex items-center gap-3 flex-1">
                <div className="flex-1"></div>
                <select
                value={localConfig.appearance?.editorFontFamily ?? 'system-ui'}
                onChange={(e) => setLocalConfig({
                  ...localConfig,
                  appearance: {
                    ...localConfig.appearance,
                    editorFontFamily: e.target.value
                  }
                })}
                className="w-48 px-2 py-1 bg-background/20 border border-border/20 rounded text-foreground text-xs focus:outline-none focus:border-primary/40 hover:bg-background/30 transition-colors appearance-none cursor-pointer font-mono"
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

            {/* Content Font - Single Line */}
            <div className="flex items-center gap-3">
              <label className="text-xs text-foreground/80 w-28 font-mono">Content Font</label>
              <div className="flex items-center gap-3 flex-1">
                <div className="flex-1"></div>
                <select
                value={localConfig.appearance?.previewFontFamily ?? 'Inter, -apple-system, BlinkMacSystemFont, sans-serif'}
                onChange={(e) => setLocalConfig({
                  ...localConfig,
                  appearance: {
                    ...localConfig.appearance,
                    previewFontFamily: e.target.value
                  }
                })}
                className="w-48 px-2 py-1 bg-background/20 border border-border/20 rounded text-foreground text-xs focus:outline-none focus:border-primary/40 hover:bg-background/30 transition-colors appearance-none cursor-pointer font-mono"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                  backgroundPosition: 'right 0.5rem center',
                  backgroundRepeat: 'no-repeat',
                  backgroundSize: '1.5em 1.5em',
                  paddingRight: '2.5rem'
                }}
              >
                <option value="Inter, -apple-system, BlinkMacSystemFont, sans-serif">Inter</option>
                <option value="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif">System Sans</option>
                <option value="Georgia, 'Times New Roman', serif">Georgia</option>
                <option value="'Crimson Text', Georgia, serif">Crimson Text</option>
                <option value="'Merriweather', Georgia, serif">Merriweather</option>
              </select>
              </div>
            </div>

            {/* Line Height - Single Line */}
            <div className="flex items-center gap-3">
              <label className="text-xs text-foreground/80 w-28 font-mono">Line Height</label>
              <div className="flex-1 flex items-center gap-3">
                <span className="text-xs text-muted-foreground/70">1.2</span>
                <div className="flex-1 relative h-5 slider-container">
                  <div className="slider-track"></div>
                  <div className="slider-ticks">
                    <div className="slider-tick" style={{ left: '0%' }}></div>
                    <div className="slider-tick" style={{ left: '25%' }}></div>
                    <div className="slider-tick" style={{ left: '50%' }}></div>
                    <div className="slider-tick" style={{ left: '100%' }}></div>
                  </div>
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
                    className="slider-input"
                  />
                </div>
                <span className="text-xs text-muted-foreground/70">2.0</span>
              </div>
              <span className="text-xs text-muted-foreground/70 min-w-[2.5rem] text-right font-mono">
                {(localConfig.appearance?.lineHeight ?? 1.6).toFixed(1)}
              </span>
            </div>

            {/* Typography Preview */}
            <div className="mt-6">
              <label className="block text-xs text-muted-foreground mb-2">Typography Preview</label>
              <div className="flex gap-3">
                {/* Editor Preview */}
                <div className="flex-1">
                  <div className="text-xs text-muted-foreground/60 mb-1">Editor View</div>
                  <div 
                    className="p-4 bg-background/40 rounded-lg border border-border/30 h-64 overflow-auto"
                    style={{ 
                      fontFamily: localConfig.appearance?.editorFontFamily ?? 'system-ui',
                      fontSize: `${localConfig.appearance?.fontSize ?? 15}px`,
                      lineHeight: localConfig.appearance?.lineHeight ?? 1.6
                    }}
                  >
                    <div className="text-muted-foreground whitespace-pre-wrap">{`# Meeting Notes

## Project Updates
The team made significant progress on the new **dashboard feature**. We completed:

- User authentication flow
- Data visualization components  
- Performance optimizations

### Next Steps
1. Review the pull request for the API integration
2. Schedule user testing sessions
3. Update documentation

> "The best way to predict the future is to invent it." - Alan Kay

\`\`\`javascript
// Example code snippet
function calculateMetrics(data) {
  return data.reduce((acc, val) => {
    return acc + val.score;
  }, 0);
}
\`\`\`

Remember to check the [project roadmap](https://example.com) for updates.`}</div>
                  </div>
                </div>

                {/* Preview Mode */}
                <div className="flex-1">
                  <div className="text-xs text-muted-foreground/60 mb-1">Preview Mode</div>
                  <div 
                    className="p-4 bg-background/40 rounded-lg border border-border/30 h-64 overflow-auto prose prose-invert prose-sm max-w-none"
                    style={{ 
                      fontFamily: localConfig.appearance?.previewFontFamily ?? 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
                      fontSize: `${localConfig.appearance?.contentFontSize ?? localConfig.appearance?.fontSize ?? 15}px`,
                      lineHeight: localConfig.appearance?.lineHeight ?? 1.6
                    }}
                  >
                    <h1 style={{ fontSize: `${(localConfig.appearance?.contentFontSize ?? localConfig.appearance?.fontSize ?? 15) * 1.5}px`, marginTop: 0 }}>Meeting Notes</h1>
                    <h2 style={{ fontSize: `${(localConfig.appearance?.contentFontSize ?? localConfig.appearance?.fontSize ?? 15) * 1.3}px` }}>Project Updates</h2>
                    <p>The team made significant progress on the new <strong>dashboard feature</strong>. We completed:</p>
                    <ul>
                      <li>User authentication flow</li>
                      <li>Data visualization components</li>
                      <li>Performance optimizations</li>
                    </ul>
                    <h3 style={{ fontSize: `${(localConfig.appearance?.contentFontSize ?? localConfig.appearance?.fontSize ?? 15) * 1.15}px` }}>Next Steps</h3>
                    <ol>
                      <li>Review the pull request for the API integration</li>
                      <li>Schedule user testing sessions</li>
                      <li>Update documentation</li>
                    </ol>
                    <blockquote style={{ borderLeftColor: 'hsl(var(--border))', paddingLeft: '1rem', marginLeft: 0 }}>
                      <p>"The best way to predict the future is to invent it." - Alan Kay</p>
                    </blockquote>
                    <pre style={{ 
                      backgroundColor: 'hsl(var(--background) / 0.5)', 
                      padding: '0.75rem', 
                      borderRadius: '0.375rem',
                      fontSize: `${(localConfig.appearance?.contentFontSize ?? localConfig.appearance?.fontSize ?? 15) * 0.9}px`
                    }}>
                      <code>{`// Example code snippet
function calculateMetrics(data) {
  return data.reduce((acc, val) => {
    return acc + val.score;
  }, 0);
}`}</code>
                    </pre>
                    <p>Remember to check the <a href="#" style={{ color: 'hsl(var(--primary))' }}>project roadmap</a> for updates.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Visual Group */}
        <div className="bg-card/20 rounded p-4 border border-border/10">
          <h3 className="text-xs font-medium text-foreground/90 mb-4 flex items-center gap-2 uppercase tracking-wide">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground/70">
              <circle cx="12" cy="12" r="10"/>
              <circle cx="12" cy="12" r="4"/>
              <line x1="21.17" y1="8" x2="12" y2="8"/>
              <line x1="3.95" y1="6.06" x2="8.54" y2="14"/>
              <line x1="10.88" y1="21.94" x2="15.46" y2="14"/>
            </svg>
            Visual
          </h3>
          <div className="space-y-3">
            
            {/* Theme */}
            <div className="flex items-center gap-3">
              <label className="text-xs text-foreground/80 w-28 font-mono">Theme</label>
              <div className="flex gap-1 flex-1">
                <button 
                  className="flex-1 px-2 py-1 bg-background/40 border border-primary/40 rounded text-xs font-medium font-mono"
                  disabled
                >
                  dark
                </button>
                <button 
                  className="flex-1 px-2 py-1 bg-background/20 border border-border/20 rounded text-xs text-muted-foreground/50 opacity-50 font-mono"
                  disabled
                >
                  light
                </button>
              </div>
            </div>

            {/* Accent Color */}
            <div className="flex items-center gap-3">
              <label className="text-xs text-foreground/80 w-28 font-mono">Accent Color</label>
              <div className="flex gap-1 flex-1">
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
                    className={`w-6 h-6 rounded border transition-all ${
                      localConfig.appearance?.accentColor === color 
                        ? 'border-white/60 scale-105' 
                        : 'border-transparent hover:border-white/30'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
            
            {/* Background Pattern */}
            <div className="flex items-center gap-3">
              <label className="text-xs text-foreground/80 w-28 font-mono">Note Background</label>
              <div className="flex items-center gap-3 flex-1">
                <div className="flex-1"></div>
                <select
                  value={localConfig.appearance?.backgroundPattern ?? 'none'}
                  onChange={(e) => setLocalConfig({
                    ...localConfig,
                    appearance: {
                      ...localConfig.appearance,
                      backgroundPattern: e.target.value as any
                    }
                  })}
                  className="w-32 px-2 py-1 bg-background/20 border border-border/20 rounded text-foreground text-xs focus:outline-none focus:border-primary/40 hover:bg-background/30 transition-colors appearance-none cursor-pointer font-mono"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                    backgroundPosition: 'right 0.5rem center',
                    backgroundRepeat: 'no-repeat',
                    backgroundSize: '1.5em 1.5em',
                    paddingRight: '2.5rem'
                  }}
                >
                  <option value="none">none</option>
                  <option value="paper">paper</option>
                  <option value="canvas">canvas</option>
                  <option value="grid">grid</option>
                  <option value="dots">dots</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Window Group */}
        <div className="bg-card/20 rounded p-4 border border-border/10">
          <h3 className="text-xs font-medium text-foreground/90 mb-4 flex items-center gap-2 uppercase tracking-wide">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground/70">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <circle cx="9" cy="9" r="2"/>
              <path d="M21 15l-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
            </svg>
            Window
          </h3>
          <div className="space-y-3">
            
            {/* Window Opacity */}
            <div className="flex items-center gap-3">
              <label className="text-xs text-foreground/80 w-28 font-mono">Window Opacity</label>
              <div className="flex-1 flex items-center gap-3">
                <span className="text-xs text-muted-foreground/70">30%</span>
                <div className="flex-1 relative h-5 slider-container">
                  <div className="slider-track"></div>
                  <div className="slider-ticks">
                    <div className="slider-tick" style={{ left: '0%' }}></div>
                    <div className="slider-tick" style={{ left: '25%' }}></div>
                    <div className="slider-tick" style={{ left: '50%' }}></div>
                    <div className="slider-tick" style={{ left: '75%' }}></div>
                    <div className="slider-tick" style={{ left: '100%' }}></div>
                  </div>
                  <input
                    type="range"
                    min="0.3"
                    max="1.0"
                    step="0.05"
                    value={localConfig.opacity}
                    onChange={async (e) => {
                      const newOpacity = parseFloat(e.target.value);
                      const newConfig = { ...localConfig, opacity: newOpacity };
                      setLocalConfig(newConfig);
                      // Apply opacity immediately
                      try {
                        await invoke('set_window_opacity', { opacity: newOpacity });
                      } catch (error) {
                        console.error('Failed to set window opacity:', error);
                      }
                    }}
                    onMouseUp={async () => {
                      // Save to config on mouse up
                      await updateConfig(localConfig);
                    }}
                    className="slider-input"
                  />
                </div>
                <span className="text-xs text-muted-foreground/70">100%</span>
              </div>
              <span className="text-xs text-muted-foreground/70 min-w-[2.5rem] text-right font-mono">
                {Math.round(localConfig.opacity * 100)}%
              </span>
            </div>

            {/* Always on Top */}
            <div className="flex items-center gap-3">
              <label className="text-xs text-foreground/80 w-28 font-mono">Always on Top</label>
              <div className="flex items-center gap-3 flex-1">
                <span className="text-xs text-muted-foreground/60 flex-1">keep window above others</span>
                <button
                  onClick={async () => {
                    const newAlwaysOnTop = !localConfig.alwaysOnTop;
                    const newConfig = { ...localConfig, alwaysOnTop: newAlwaysOnTop };
                    setLocalConfig(newConfig);
                    // Apply immediately
                    try {
                      await invoke('set_window_always_on_top', { alwaysOnTop: newAlwaysOnTop });
                    } catch (error) {
                      console.error('Failed to set always on top:', error);
                    }
                    await updateConfig(newConfig);
                  }}
                  className={`relative w-8 h-4 rounded-full transition-colors ${
                    localConfig.alwaysOnTop ? 'bg-primary' : 'bg-background/40 border border-border/40'
                  }`}
                >
                  <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${
                    localConfig.alwaysOnTop ? 'translate-x-4' : 'translate-x-0'
                  }`} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Features Group */}
        <div className="bg-card/20 rounded p-4 border border-border/10">
          <h3 className="text-xs font-medium text-foreground/90 mb-4 flex items-center gap-2 uppercase tracking-wide">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground/70">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <line x1="9" y1="9" x2="15" y2="9"/>
              <line x1="9" y1="12" x2="15" y2="12"/>
              <line x1="9" y1="15" x2="12" y2="15"/>
            </svg>
            Features
          </h3>
          <div className="space-y-3">
            
            {/* Focus Mode */}
            <div className="flex items-center gap-3">
              <label className="text-xs text-foreground/80 w-28 font-mono">Focus Mode</label>
              <div className="flex items-center gap-3 flex-1">
                <span className="text-xs text-muted-foreground/60 flex-1">distraction-free writing</span>
                <button
                  onClick={() => setLocalConfig({
                    ...localConfig,
                    appearance: {
                      ...localConfig.appearance,
                      focusMode: !localConfig.appearance?.focusMode
                    }
                  })}
                  className={`relative w-8 h-4 rounded-full transition-colors ${
                    localConfig.appearance?.focusMode ? 'bg-primary' : 'bg-background/40 border border-border/40'
                  }`}
                >
                  <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${
                    localConfig.appearance?.focusMode ? 'translate-x-4' : 'translate-x-0'
                  }`} />
                </button>
              </div>
            </div>

            {/* Syntax Highlighting */}
            <div className="flex items-center gap-3">
              <label className="text-xs text-foreground/80 w-28 font-mono">Syntax Highlighting</label>
              <div className="flex items-center gap-3 flex-1">
                <span className="text-xs text-muted-foreground/60 flex-1">code syntax colors</span>
                <button
                  onClick={() => setLocalConfig({
                    ...localConfig,
                    appearance: {
                      ...localConfig.appearance,
                      syntaxHighlighting: !localConfig.appearance?.syntaxHighlighting
                    }
                  })}
                  className={`relative w-8 h-4 rounded-full transition-colors ${
                    localConfig.appearance?.syntaxHighlighting ? 'bg-primary' : 'bg-background/40 border border-border/40'
                  }`}
                >
                  <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${
                    localConfig.appearance?.syntaxHighlighting ? 'translate-x-4' : 'translate-x-0'
                  }`} />
                </button>
              </div>
            </div>

            {/* Typewriter Mode */}
            <div className="flex items-center gap-3">
              <label className="text-xs text-foreground/80 w-28 font-mono">Typewriter Mode</label>
              <div className="flex items-center gap-3 flex-1">
                <span className="text-xs text-muted-foreground/60 flex-1">center current line</span>
                <button
                  onClick={() => setLocalConfig({
                    ...localConfig,
                    appearance: {
                      ...localConfig.appearance,
                      typewriterMode: !localConfig.appearance?.typewriterMode
                    }
                  })}
                  className={`relative w-8 h-4 rounded-full transition-colors ${
                    localConfig.appearance?.typewriterMode ? 'bg-primary' : 'bg-background/40 border border-border/40'
                  }`}
                >
                  <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${
                    localConfig.appearance?.typewriterMode ? 'translate-x-4' : 'translate-x-0'
                  }`} />
                </button>
              </div>
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
      case 'appearance':
        return renderAppearanceSection();
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
      <div className="flex-1 flex flex-col">
        <div className="flex-1 p-6 overflow-y-auto scrollbar-thin" style={{ maxHeight: 'calc(100vh - 140px)' }}>
          <div className="w-full">
            {renderSectionContent()}
          </div>
        </div>
        
        {/* Save Button - Always visible at bottom */}
        {activeSection === 'appearance' && (
          <div className="fixed bottom-5 right-2 border-t border-border/20 px-2 py-1 bg-card/95 backdrop-blur-md">
            <div className="flex justify-end">
              <button
                onClick={handleSave}
                disabled={isLoading || saveStatus === 'saving'}
                className={`px-3 py-1.5 text-xs rounded transition-all disabled:opacity-50 font-mono ${
                  saveStatus === 'saved' 
                    ? 'bg-green-600/80 text-white' 
                    : saveStatus === 'error'
                    ? 'bg-red-600/80 text-white'
                    : 'bg-primary/80 text-primary-foreground hover:bg-primary/90'
                }`}
              >
                {saveStatus === 'saving' ? 'saving...' : 
                 saveStatus === 'saved' ? '✓ saved' :
                 saveStatus === 'error' ? 'error' :
                 'save'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}