import { useState, useEffect } from 'react';
import { useConfigStore } from '../stores/config-store';
import { invoke } from '@tauri-apps/api/core';
import { ThemeSelector } from './ThemeSelector';

interface SettingsPanelProps {
  selectedSection: 'general' | 'appearance' | 'shortcuts' | 'editor' | 'advanced';
}

export function SettingsPanel({ selectedSection }: SettingsPanelProps) {
  const { config, updateConfig, isLoading } = useConfigStore();
  const [localConfig, setLocalConfig] = useState(config);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [shortcutStatus, setShortcutStatus] = useState<'idle' | 'registering' | 'success' | 'error'>('idle');
  const [shortcutMessage, setShortcutMessage] = useState<string>('');
  const [previewMode, setPreviewMode] = useState<'editor' | 'preview'>('preview');

  useEffect(() => {
    // Set localConfig to match the loaded config directly
    console.log('Config changed in SettingsPanel:', JSON.stringify(config, null, 2));
    setLocalConfig(config);
  }, [config]);

  const handleSave = async () => {
    console.log('Saving config:', JSON.stringify(localConfig, null, 2));
    console.log('Appearance being saved:', JSON.stringify(localConfig.appearance, null, 2));
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

  const renderGeneralSection = () => (
    <div data-section="general" className="space-y-4">
      {/* Section Header - Standardized 76px height to match notes sidebar */}
      <div className="h-[76px] flex flex-col justify-center">
        <h2 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary/70">
            <circle cx="12" cy="12" r="3"/>
            <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1"/>
          </svg>
          General
        </h2>
        <p className="text-xs text-muted-foreground/60">The essentials • who we are, what we do</p>
      </div>

      <div className="bg-card/20 rounded-lg p-4 border border-border/10">
        <h3 className="text-xs font-medium text-foreground/90 mb-3 flex items-center gap-2 uppercase tracking-wide">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground/70">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 8v4l3 3"/>
          </svg>
          About
        </h3>
        <div className="space-y-3 text-xs">
          <div className="flex justify-between items-center gap-3">
            <span className="text-muted-foreground/80 font-mono w-24">Application</span>
            <div className="flex-1"></div>
            <span className="text-foreground font-mono">Blink</span>
          </div>
          <div className="flex justify-between items-center gap-3">
            <span className="text-muted-foreground/80 font-mono w-24">Version</span>
            <div className="flex-1"></div>
            <span className="text-foreground font-mono">1.0.0</span>
          </div>
          <div className="flex justify-between items-center gap-3">
            <span className="text-muted-foreground/80 font-mono w-24">Author</span>
            <div className="flex-1"></div>
            <span className="text-foreground font-mono">AI-Native Spatial Notes ✨</span>
          </div>
        </div>
      </div>

      <div className="bg-card/20 rounded-lg p-4 border border-border/10">
        <h3 className="text-xs font-medium text-foreground/90 mb-3 flex items-center gap-2 uppercase tracking-wide">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground/70">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9,22 9,12 15,12 15,22"/>
          </svg>
          Interface
        </h3>
        <div className="space-y-3 text-xs">
          
          {/* Show Note Previews Toggle */}
          <div className="flex justify-between items-center gap-3">
            <div className="flex flex-col">
              <span className="text-foreground/90 font-mono text-xs">Note Previews</span>
              <span className="text-muted-foreground/60 text-xs">Peek at note content without opening</span>
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="note-previews"
                checked={localConfig.appearance?.showNotePreviews ?? false}
                onChange={(e) => setLocalConfig({
                  ...localConfig,
                  appearance: {
                    ...localConfig.appearance,
                    showNotePreviews: e.target.checked
                  }
                })}
                className="w-4 h-4 text-primary bg-background border border-border/30 rounded focus:ring-primary/50 focus:ring-2 cursor-pointer"
              />
            </div>
          </div>
          
          {/* Window Opacity Slider */}
          <div className="flex items-center gap-3">
            <div className="flex flex-col w-28">
              <span className="text-foreground/90 font-mono text-xs">Window Opacity</span>
              <span className="text-muted-foreground/60 text-xs">Background transparency</span>
            </div>
            <div className="flex-1 flex items-center gap-3">
              <span className="text-xs text-muted-foreground/70">🫥</span>
              <div className="flex-1 relative h-5 slider-container">
                <div className="slider-track"></div>
                <div className="slider-ticks">
                  <div className="slider-tick" style={{ left: '10%' }}></div>
                  <div className="slider-tick" style={{ left: '30%' }}></div>
                  <div className="slider-tick" style={{ left: '50%' }}></div>
                  <div className="slider-tick" style={{ left: '70%' }}></div>
                  <div className="slider-tick" style={{ left: '90%' }}></div>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={localConfig.appearance?.windowOpacity}
                  onChange={(e) => setLocalConfig({
                    ...localConfig,
                    appearance: {
                      ...localConfig.appearance,
                      windowOpacity: parseFloat(e.target.value)
                    }
                  })}
                  className="slider-input"
                />
              </div>
              <span className="text-xs text-muted-foreground/70">🫧</span>
            </div>
            <span className="text-xs text-muted-foreground/70 min-w-[3rem] text-right font-mono">
              {Math.round((localConfig.appearance?.windowOpacity ?? 1) * 100)}%
            </span>
          </div>
          
        </div>
      </div>

    </div>
  );

  const renderAppearanceSection = () => (
    <div data-section="appearance" className="space-y-4">
      {/* Section Header - Standardized spacing */}
      <div className="h-[76px] flex flex-col justify-center">
        <h2 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary/70">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14,2 14,8 20,8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <line x1="10" y1="9" x2="8" y2="9"/>
          </svg>
          Appearance
        </h2>
        <p className="text-xs text-muted-foreground/60">Make Blink uniquely yours • fonts, colors & textures</p>
      </div>

      <div className="space-y-4">
        {/* Theme Selector */}
        <div className="bg-card/20 rounded-lg p-4 border border-border/10">
          <h3 className="text-xs font-medium text-foreground/90 mb-3 flex items-center gap-2 uppercase tracking-wide">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground/70">
              <path d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M19.07 4.93L4.93 19.07"/>
            </svg>
            Themes
          </h3>
          <ThemeSelector onSave={() => {
            // Theme changes are handled directly by ThemeSelector
            // No need to trigger main save since themes auto-save
            console.log('[SETTINGS] Theme applied successfully');
          }} />
        </div>

        {/* Typography Group */}
        <div className="bg-card/20 rounded-lg p-4 border border-border/10">
          <h3 className="text-xs font-medium text-foreground/90 mb-3 flex items-center gap-2 uppercase tracking-wide">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground/70">
              <path d="M4 7V4h16v3M9 20h6M12 4v16"/>
            </svg>
            Typography
          </h3>
          <div className="space-y-3">
            
            {/* Editor Font Size - Single Line */}
            <div className="flex items-center gap-3">
              <label className="text-xs text-foreground/80 w-24 font-mono">Editor Font Size</label>
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
              <label className="text-xs text-foreground/80 w-24 font-mono">Content Font Size</label>
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
              <label className="text-xs text-foreground/80 w-24 font-mono">Editor Font</label>
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
              <label className="text-xs text-foreground/80 w-24 font-mono">Content Font</label>
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
              <label className="text-xs text-foreground/80 w-24 font-mono">Line Height</label>
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
              <label className="block text-xs text-muted-foreground mb-3 flex items-center gap-2">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground/70">
                  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                  <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                </svg>
                Typography Preview
              </label>
              
              {/* Preview Toggle Buttons */}
              <div className="flex gap-1 mb-4 bg-background/30 p-1 rounded-lg w-fit">
                <button 
                  onClick={() => setPreviewMode('editor')}
                  className={`px-3 py-1.5 text-xs font-mono rounded transition-all ${
                    previewMode === 'editor' 
                      ? 'bg-primary/80 text-primary-foreground shadow-sm' 
                      : 'text-muted-foreground/70 hover:text-foreground hover:bg-background/40'
                  }`}
                >
                  Editor View
                </button>
                <button 
                  onClick={() => setPreviewMode('preview')}
                  className={`px-3 py-1.5 text-xs font-mono rounded transition-all ${
                    previewMode === 'preview' 
                      ? 'bg-primary/80 text-primary-foreground shadow-sm' 
                      : 'text-muted-foreground/70 hover:text-foreground hover:bg-background/40'
                  }`}
                >
                  Preview Mode
                </button>
              </div>

              {/* Single Preview Container */}
              <div className="relative">
                {previewMode === 'editor' ? (
                  <div 
                    className="p-6 bg-card/40 rounded-xl border border-border/40 h-80 overflow-auto shadow-lg backdrop-blur-sm"
                    style={{ 
                      fontFamily: localConfig.appearance?.editorFontFamily ?? 'system-ui',
                      fontSize: `${localConfig.appearance?.fontSize ?? 15}px`,
                      lineHeight: localConfig.appearance?.lineHeight ?? 1.6
                    }}
                  >
                    <div className="text-foreground/90 whitespace-pre-wrap font-mono leading-relaxed">{`# Meeting Notes

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
                ) : (
                  <div 
                    className="p-6 bg-card/60 rounded-xl border border-primary/20 h-80 overflow-auto prose prose-invert prose-sm max-w-none shadow-xl backdrop-blur-sm ring-1 ring-primary/10"
                    style={{ 
                      fontFamily: localConfig.appearance?.previewFontFamily ?? 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
                      fontSize: `${localConfig.appearance?.contentFontSize ?? localConfig.appearance?.fontSize ?? 15}px`,
                      lineHeight: localConfig.appearance?.lineHeight ?? 1.6
                    }}
                  >
                    <h1 style={{ 
                      fontSize: `${(localConfig.appearance?.contentFontSize ?? localConfig.appearance?.fontSize ?? 15) * 1.8}px`, 
                      marginTop: 0,
                      color: 'hsl(var(--foreground) / 1)',
                      fontWeight: '700'
                    }}>Meeting Notes</h1>
                    <h2 style={{ 
                      fontSize: `${(localConfig.appearance?.contentFontSize ?? localConfig.appearance?.fontSize ?? 15) * 1.4}px`,
                      color: 'hsl(var(--foreground) / 1)',
                      fontWeight: '600'
                    }}>Project Updates</h2>
                    <p style={{ color: 'hsl(var(--foreground) / 0.85)' }}>The team made significant progress on the new <strong style={{ color: 'hsl(var(--primary))' }}>dashboard feature</strong>. We completed:</p>
                    <ul style={{ color: 'hsl(var(--foreground) / 0.8)' }}>
                      <li>User authentication flow</li>
                      <li>Data visualization components</li>
                      <li>Performance optimizations</li>
                    </ul>
                    <h3 style={{ 
                      fontSize: `${(localConfig.appearance?.contentFontSize ?? localConfig.appearance?.fontSize ?? 15) * 1.2}px`,
                      color: 'hsl(var(--foreground) / 1)',
                      fontWeight: '600'
                    }}>Next Steps</h3>
                    <ol style={{ color: 'hsl(var(--foreground) / 0.8)' }}>
                      <li>Review the pull request for the API integration</li>
                      <li>Schedule user testing sessions</li>
                      <li>Update documentation</li>
                    </ol>
                    <blockquote style={{ 
                      borderLeftColor: 'hsl(var(--primary) / 0.6)', 
                      borderLeftWidth: '3px',
                      paddingLeft: '1.5rem', 
                      marginLeft: 0,
                      backgroundColor: 'hsl(var(--primary) / 0.05)',
                      borderRadius: '0 0.5rem 0.5rem 0',
                      padding: '1rem 1.5rem',
                      fontStyle: 'italic',
                      color: 'hsl(var(--foreground) / 0.85)'
                    }}>
                      <p style={{ margin: 0 }}>"The best way to predict the future is to invent it." - Alan Kay</p>
                    </blockquote>
                    <pre style={{ 
                      backgroundColor: 'hsl(var(--muted) / 0.8)', 
                      padding: '1rem', 
                      borderRadius: '0.75rem',
                      fontSize: `${(localConfig.appearance?.contentFontSize ?? localConfig.appearance?.fontSize ?? 15) * 0.85}px`,
                      border: '1px solid hsl(var(--border) / 0.5)',
                      fontFamily: 'ui-monospace, "SF Mono", Monaco, monospace'
                    }}>
                      <code style={{ color: 'hsl(var(--foreground) / 0.9)' }}>{`// Example code snippet
function calculateMetrics(data) {
  return data.reduce((acc, val) => {
    return acc + val.score;
  }, 0);
}`}</code>
                    </pre>
                    <p style={{ color: 'hsl(var(--foreground) / 0.8)' }}>Remember to check the <a href="#" style={{ color: 'hsl(var(--primary))', textDecoration: 'underline', fontWeight: '500' }}>project roadmap</a> for updates.</p>
                  </div>
                )}
                
                {/* Preview Mode Indicator */}
                <div className="absolute top-3 right-3">
                  <div className={`px-2 py-1 text-xs font-mono rounded-full ${
                    previewMode === 'preview' 
                      ? 'bg-primary/20 text-primary border border-primary/30' 
                      : 'bg-muted/40 text-muted-foreground border border-border/30'
                  }`}>
                    {previewMode === 'preview' ? 'rendered' : 'markdown'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Visual Group */}
        <div className="bg-card/20 rounded-lg p-4 border border-border/10">
          <h3 className="text-xs font-medium text-foreground/90 mb-3 flex items-center gap-2 uppercase tracking-wide">
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
        <div className="bg-card/20 rounded-lg p-4 border border-border/10">
          <h3 className="text-xs font-medium text-foreground/90 mb-3 flex items-center gap-2 uppercase tracking-wide">
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
        <div className="bg-card/20 rounded-lg p-4 border border-border/10">
          <h3 className="text-xs font-medium text-foreground/90 mb-3 flex items-center gap-2 uppercase tracking-wide">
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
                  className={`relative w-8 h-4 rounded-full transition-colors flex-shrink-0 ${
                    localConfig.appearance?.focusMode ? 'bg-primary' : 'bg-background/40 border border-border/40'
                  }`}
                >
                  <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-background rounded-full transition-transform border border-border/20 ${
                    localConfig.appearance?.focusMode ? 'translate-x-3.5' : 'translate-x-0'
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
                  className={`relative w-8 h-4 rounded-full transition-colors flex-shrink-0 ${
                    localConfig.appearance?.syntaxHighlighting ? 'bg-primary' : 'bg-background/40 border border-border/40'
                  }`}
                >
                  <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-background rounded-full transition-transform border border-border/20 ${
                    localConfig.appearance?.syntaxHighlighting ? 'translate-x-3.5' : 'translate-x-0'
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
                  className={`relative w-8 h-4 rounded-full transition-colors flex-shrink-0 ${
                    localConfig.appearance?.typewriterMode ? 'bg-primary' : 'bg-background/40 border border-border/40'
                  }`}
                >
                  <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-background rounded-full transition-transform border border-border/20 ${
                    localConfig.appearance?.typewriterMode ? 'translate-x-3.5' : 'translate-x-0'
                  }`} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderShortcutsSection = () => (
    <div data-section="shortcuts" className="space-y-4">
      {/* Section Header - Standardized spacing */}
      <div className="h-[76px] flex flex-col justify-center">
        <h2 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary/70">
            <rect x="2" y="7" width="20" height="10" rx="1"/>
            <path d="M7 21c0-2.5 2-2.5 2-5M15 21c0-2.5 2-2.5 2-5M9 7v-4M15 7v-4"/>
          </svg>
          Shortcuts
        </h2>
        <p className="text-xs text-muted-foreground/60">Global and in-app keyboard shortcuts</p>
      </div>

      <div className="bg-card/20 rounded-lg p-4 border border-border/10">
        <h3 className="text-xs font-medium text-foreground/90 mb-3 flex items-center gap-2 uppercase tracking-wide">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground/70">
            <rect x="2" y="7" width="20" height="10" rx="1"/>
            <path d="M7 21c0-2.5 2-2.5 2-5M15 21c0-2.5 2-2.5 2-5M9 7v-4M15 7v-4"/>
          </svg>
          Global Shortcuts
        </h3>
        <div className="space-y-4">
          <div className="text-xs text-muted-foreground/70 mb-4">
            Global shortcuts allow you to perform actions from anywhere on your system,
            even when the app is in the background.
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-xs text-foreground/80 font-mono w-32">Create New Note</span>
              <div className="flex-1 flex items-center gap-2">
                <kbd className="px-2 py-1 text-xs bg-background/40 border border-border/30 rounded font-mono">⌘</kbd>
                <kbd className="px-2 py-1 text-xs bg-background/40 border border-border/30 rounded font-mono">⌃</kbd>
                <kbd className="px-2 py-1 text-xs bg-background/40 border border-border/30 rounded font-mono">⌥</kbd>
                <kbd className="px-2 py-1 text-xs bg-background/40 border border-border/30 rounded font-mono">⇧</kbd>
                <kbd className="px-2 py-1 text-xs bg-background/40 border border-border/30 rounded font-mono">N</kbd>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <span className="text-xs text-foreground/80 font-mono w-32">Toggle Hover Mode</span>
              <div className="flex-1 flex items-center gap-2">
                <kbd className="px-2 py-1 text-xs bg-background/40 border border-border/30 rounded font-mono">⌘</kbd>
                <kbd className="px-2 py-1 text-xs bg-background/40 border border-border/30 rounded font-mono">⌃</kbd>
                <kbd className="px-2 py-1 text-xs bg-background/40 border border-border/30 rounded font-mono">⌥</kbd>
                <kbd className="px-2 py-1 text-xs bg-background/40 border border-border/30 rounded font-mono">⇧</kbd>
                <kbd className="px-2 py-1 text-xs bg-background/40 border border-border/30 rounded font-mono">H</kbd>
              </div>
            </div>
          </div>
          
          <div className="mt-4 pt-4 border-t border-border/20">
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  setShortcutStatus('registering');
                  setShortcutMessage('');
                  try {
                    const result = await invoke<string>('reregister_global_shortcuts');
                    setShortcutStatus('success');
                    setShortcutMessage(result);
                    setTimeout(() => {
                      setShortcutStatus('idle');
                      setShortcutMessage('');
                    }, 5000);
                  } catch (error: any) {
                    setShortcutStatus('error');
                    setShortcutMessage(error.toString());
                    setTimeout(() => {
                      setShortcutStatus('idle');
                      setShortcutMessage('');
                    }, 10000);
                  }
                }}
                disabled={shortcutStatus === 'registering'}
                className="px-3 py-1.5 text-xs bg-primary/80 text-primary-foreground hover:bg-primary/90 rounded transition-all disabled:opacity-50 font-mono"
              >
                {shortcutStatus === 'registering' ? 'registering...' : 're-register shortcuts'}
              </button>
              
              <button
                onClick={async () => {
                  console.log('[BLINK] [SETTINGS] Testing event emission...');
                  try {
                    const result = await invoke<string>('test_emit_new_note');
                    console.log('[BLINK] [SETTINGS] Test result:', result);
                    setShortcutMessage('Test event emitted successfully');
                    setShortcutStatus('success');
                    setTimeout(() => {
                      setShortcutStatus('idle');
                      setShortcutMessage('');
                    }, 3000);
                  } catch (error: any) {
                    console.error('[BLINK] [SETTINGS] Test failed:', error);
                    setShortcutMessage('Test failed: ' + error.toString());
                    setShortcutStatus('error');
                  }
                }}
                className="px-3 py-1.5 text-xs bg-background/40 border border-border/40 hover:bg-background/60 rounded transition-all font-mono"
              >
                test event
              </button>
              
              <button
                onClick={async () => {
                  console.log('[BLINK] [SETTINGS] Testing hover toggle...');
                  try {
                    const hoverState = await invoke<boolean>('toggle_all_windows_hover');
                    console.log('[BLINK] [SETTINGS] Hover state:', hoverState);
                    setShortcutMessage(`Hover mode ${hoverState ? 'enabled' : 'disabled'} for all windows`);
                    setShortcutStatus('success');
                    setTimeout(() => {
                      setShortcutStatus('idle');
                      setShortcutMessage('');
                    }, 3000);
                  } catch (error: any) {
                    console.error('[BLINK] [SETTINGS] Hover toggle failed:', error);
                    setShortcutMessage('Hover toggle failed: ' + error.toString());
                    setShortcutStatus('error');
                  }
                }}
                className="px-3 py-1.5 text-xs bg-background/40 border border-border/40 hover:bg-background/60 rounded transition-all font-mono"
              >
                test hover
              </button>
            </div>
            
            {shortcutMessage && (
              <div className={`mt-3 text-xs font-mono ${
                shortcutStatus === 'success' ? 'text-green-400' : 'text-red-400'
              }`}>
                {shortcutMessage}
              </div>
            )}
          </div>
          
          <div className="mt-4 pt-4 border-t border-border/20">
            <div className="text-xs text-muted-foreground/60 space-y-3">
              <p className="font-medium text-foreground/80">Required macOS Permissions:</p>
              
              <div className="bg-background/20 border border-border/20 rounded-lg p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 bg-primary/60 rounded-full mt-1.5 flex-shrink-0"></div>
                  <div>
                    <p className="font-medium text-foreground/90 mb-1">Accessibility Access</p>
                    <p className="text-muted-foreground/70 leading-relaxed">
                      Required for global shortcuts (⌘⌃⌥⇧N, ⌘⌃⌥⇧H) to work system-wide. 
                      Allows Blink to capture key combinations even when the app is not in focus.
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 bg-primary/60 rounded-full mt-1.5 flex-shrink-0"></div>
                  <div>
                    <p className="font-medium text-foreground/90 mb-1">Input Monitoring</p>
                    <p className="text-muted-foreground/70 leading-relaxed">
                      Enables detection of keyboard events for global shortcuts. 
                      This permission may be automatically granted with Accessibility.
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                <p className="font-medium text-amber-400/90 mb-1 flex items-center gap-2">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/>
                  </svg>
                  Setup Steps
                </p>
                <ol className="text-amber-300/80 leading-relaxed space-y-1 ml-4 list-decimal">
                  <li>Click "open accessibility settings" below</li>
                  <li>Find "Blink" in the app list and enable it</li>
                  <li>Quit and restart Blink completely</li>
                  <li>Test shortcuts with the buttons above</li>
                </ol>
              </div>
              
              <div className="text-muted-foreground/50 text-[11px] leading-relaxed">
                <p className="font-medium mb-1">Why these permissions?</p>
                <p>Global shortcuts allow you to create notes instantly from anywhere on your system - 
                whether you're browsing, coding, or in a meeting. The "Hyperkey" (⌘⌃⌥⇧) combination 
                is specifically chosen to avoid conflicts with existing shortcuts.</p>
              </div>
              
              <button
                onClick={() => invoke('open_system_settings')}
                className="mt-3 text-xs text-primary/80 hover:text-primary underline font-mono"
              >
                open accessibility settings →
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <div className="bg-card/20 rounded-lg p-4 border border-border/10">
        <h3 className="text-xs font-medium text-foreground/90 mb-3 flex items-center gap-2 uppercase tracking-wide">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground/70">
            <rect x="2" y="7" width="20" height="10" rx="1"/>
            <path d="M5 12h14M7 12l2-2M7 12l2 2"/>
          </svg>
          In-App Shortcuts
        </h3>
        <div className="space-y-3 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-foreground/80 font-mono">Command Palette</span>
            <div className="flex items-center gap-1">
              <kbd className="px-2 py-1 text-xs bg-background/40 border border-border/30 rounded font-mono">⌘</kbd>
              <kbd className="px-2 py-1 text-xs bg-background/40 border border-border/30 rounded font-mono">K</kbd>
            </div>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-foreground/80 font-mono">New Note</span>
            <div className="flex items-center gap-1">
              <kbd className="px-2 py-1 text-xs bg-background/40 border border-border/30 rounded font-mono">⌘</kbd>
              <kbd className="px-2 py-1 text-xs bg-background/40 border border-border/30 rounded font-mono">N</kbd>
            </div>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-foreground/80 font-mono">Toggle Preview</span>
            <div className="flex items-center gap-1">
              <kbd className="px-2 py-1 text-xs bg-background/40 border border-border/30 rounded font-mono">⌘</kbd>
              <kbd className="px-2 py-1 text-xs bg-background/40 border border-border/30 rounded font-mono">⇧</kbd>
              <kbd className="px-2 py-1 text-xs bg-background/40 border border-border/30 rounded font-mono">P</kbd>
            </div>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-foreground/80 font-mono">Open Settings</span>
            <div className="flex items-center gap-1">
              <kbd className="px-2 py-1 text-xs bg-background/40 border border-border/30 rounded font-mono">⌘</kbd>
              <kbd className="px-2 py-1 text-xs bg-background/40 border border-border/30 rounded font-mono">,</kbd>
            </div>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-foreground/80 font-mono">Focus Mode</span>
            <div className="flex items-center gap-1">
              <kbd className="px-2 py-1 text-xs bg-background/40 border border-border/30 rounded font-mono">⌘</kbd>
              <kbd className="px-2 py-1 text-xs bg-background/40 border border-border/30 rounded font-mono">.</kbd>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderAISection = () => (
    <div data-section="ai" className="space-y-4">
      {/* Section Header - Standardized spacing */}
      <div className="h-[76px] flex flex-col justify-center">
        <h2 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary/70">
            <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
          </svg>
          AI & Plugins
        </h2>
        <p className="text-xs text-muted-foreground/60">AI integration and extensibility (coming soon)</p>
      </div>

      <div className="bg-card/20 rounded-lg p-4 border border-border/10">
        <h3 className="text-xs font-medium text-foreground/90 mb-3 flex items-center gap-2 uppercase tracking-wide">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground/70">
            <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
          </svg>
          AI Integration
        </h3>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground/80 font-mono w-24">Status</span>
            <div className="flex-1"></div>
            <span className="text-xs text-muted-foreground/60 font-mono">coming soon</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground/80 font-mono w-24">Features</span>
            <div className="flex-1"></div>
            <span className="text-xs text-muted-foreground/60 font-mono">phase 2</span>
          </div>
        </div>
      </div>

      <div className="bg-card/20 rounded-lg p-4 border border-border/10">
        <h3 className="text-xs font-medium text-foreground/90 mb-3 flex items-center gap-2 uppercase tracking-wide">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground/70">
            <circle cx="12" cy="12" r="3"/>
            <path d="M3 12h3m12 0h3M12 3v3m0 12v3"/>
          </svg>
          Plugins
        </h3>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground/80 font-mono w-24">System</span>
            <div className="flex-1"></div>
            <span className="text-xs text-muted-foreground/60 font-mono">extensible</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground/80 font-mono w-24">Integrations</span>
            <div className="flex-1"></div>
            <span className="text-xs text-muted-foreground/60 font-mono">custom workflows</span>
          </div>
        </div>
      </div>
    </div>
  );


  const renderEditorSection = () => (
    <div data-section="editor" className="space-y-6">
      <div className="h-[76px] flex flex-col justify-center">
        <h2 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary/70">
            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
            <path d="m15 5 4 4"/>
          </svg>
          Editor
        </h2>
        <p className="text-xs text-muted-foreground/60">Customize your writing experience</p>
      </div>
      
      <div className="space-y-4">
        <div>
          <label className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">Font Size</span>
            <input
              type="range"
              min="12"
              max="24"
              value={localConfig.editor?.fontSize || 16}
              onChange={(e) => setLocalConfig({
                ...localConfig,
                editor: {
                  ...localConfig.editor,
                  fontSize: parseInt(e.target.value, 10)
                }
              })}
              className="w-32 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-sm text-muted-foreground w-8 text-right">
              {localConfig.editor?.fontSize || 16}px
            </span>
          </label>
        </div>
        
        <div>
          <label className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">Line Height</span>
            <input
              type="range"
              min="1"
              max="3"
              step="0.1"
              value={localConfig.editor?.lineHeight || 1.6}
              onChange={(e) => setLocalConfig({
                ...localConfig,
                editor: {
                  ...localConfig.editor,
                  lineHeight: parseFloat(e.target.value)
                }
              })}
              className="w-32 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-sm text-muted-foreground w-8 text-right">
              {localConfig.editor?.lineHeight || 1.6}
            </span>
          </label>
        </div>
      </div>
    </div>
  );


  const renderAdvancedSection = () => (
    <div data-section="advanced" className="space-y-6">
      <div className="h-[76px] flex flex-col justify-center">
        <h2 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary/70">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            <path d="M12 8v4"/>
            <path d="M12 16h.01"/>
          </svg>
          Advanced
        </h2>
        <p className="text-xs text-muted-foreground/60">Advanced application settings</p>
      </div>
      
      <div className="space-y-4">
        <div>
          <label className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-foreground">Developer Mode</div>
              <div className="text-xs text-muted-foreground/60">Enable developer tools and features</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={localConfig.advanced?.developerMode || false}
                onChange={(e) => setLocalConfig({
                  ...localConfig,
                  advanced: {
                    ...localConfig.advanced,
                    developerMode: e.target.checked
                  }
                })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </label>
        </div>
        
        <div>
          <label className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-foreground">Auto Update</div>
              <div className="text-xs text-muted-foreground/60">Automatically download and install updates</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={localConfig.advanced?.autoUpdate !== false}
                onChange={(e) => setLocalConfig({
                  ...localConfig,
                  advanced: {
                    ...localConfig.advanced,
                    autoUpdate: e.target.checked
                  }
                })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </label>
        </div>
      </div>
    </div>
  );


  const renderSection = () => {
    switch (selectedSection) {
      case 'general':
        return renderGeneralSection();
      case 'appearance':
        return renderAppearanceSection();
      case 'shortcuts':
        return renderShortcutsSection();
      case 'editor':
        return renderEditorSection();
      case 'advanced':
        return renderAdvancedSection();
      default:
        return renderAppearanceSection();
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto p-5">
        {renderSection()}
      </div>
      <div className="border-t border-border/20 p-5 bg-background/90 backdrop-blur-sm flex-shrink-0 sticky bottom-0 z-10">
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saveStatus === 'saving'}
            className="inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium text-white bg-primary rounded hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saveStatus === 'saving' ? (
              <>
                <svg className="w-4 h-4 mr-2 -ml-1 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Saving...
              </>
            ) : saveStatus === 'saved' ? (
              <>
                <svg className="w-3 h-3 mr-2 -ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                </svg>
                Saved
              </>
            ) : saveStatus === 'error' ? (
              <>
                <svg className="w-3 h-3 mr-2 -ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
                Error
              </>
            ) : (
              'Save Changes'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}