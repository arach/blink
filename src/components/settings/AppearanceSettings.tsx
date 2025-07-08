import { AppConfig } from '../../types';
import { ThemeSelector } from './ThemeSelector';

interface AppearanceSettingsProps {
  localConfig: AppConfig;
  setLocalConfig: (config: AppConfig) => void;
  previewMode: 'editor' | 'preview';
  setPreviewMode: (mode: 'editor' | 'preview') => void;
}

export function AppearanceSettings({
  localConfig,
  setLocalConfig,
  previewMode,
  setPreviewMode,
}: AppearanceSettingsProps) {
  return (
    <div data-section="appearance" className="space-y-4">
      {/* Section Header - Standardized spacing */}
      <div className="h-[40px] flex flex-col justify-center">
        <h2 className="text-sm font-medium text-foreground mb-1 flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary/70">
            <path d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M19.07 4.93L4.93 19.07"/>
          </svg>
          Appearance
        </h2>
        <p className="text-xs text-muted-foreground/60">Interface looks • how things appear</p>
      </div>

      {/* Theme Section */}
      <div className="bg-card/20 rounded-2xl p-4 border border-border/10">
        <h3 className="text-xs font-medium text-foreground/90 mb-3 flex items-center gap-2 uppercase tracking-wide">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground/70">
            <path d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M19.07 4.93L4.93 19.07"/>
          </svg>
          Theme
        </h3>
        <ThemeSelector 
          selectedTheme={localConfig.appearance?.themeId || 'midnight-ink'}
          onThemeChange={(themeId) => setLocalConfig({
            ...localConfig,
            appearance: {
              ...localConfig.appearance,
              themeId
            }
          })}
        />
      </div>

      {/* Font Settings */}
      <div className="bg-card/20 rounded-2xl p-4 border border-border/10">
        <h3 className="text-xs font-medium text-foreground/90 mb-3 flex items-center gap-2 uppercase tracking-wide">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground/70">
            <path d="M4 7V4h16v3M9 20h6M12 4v16"/>
          </svg>
          Typography
        </h3>
        <div className="space-y-3 text-xs">
          
          {/* Font Size */}
          <div className="flex items-center gap-3">
            <div className="flex flex-col w-28">
              <span className="text-foreground/90 font-mono text-xs">Font Size</span>
              <span className="text-muted-foreground/60 text-xs">Editor text size</span>
            </div>
            <div className="flex-1 flex items-center gap-3">
              <span className="text-xs text-muted-foreground/70">A</span>
              <div className="flex-1 relative h-5 slider-container">
                <input
                  type="range"
                  min="12"
                  max="24"
                  step="1"
                  value={localConfig.appearance?.fontSize || 15}
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
              <span className="text-xs text-muted-foreground/70">𝐀</span>
            </div>
            <span className="text-xs text-muted-foreground/70 min-w-[3rem] text-right font-mono">
              {localConfig.appearance?.fontSize || 15}px
            </span>
          </div>

          {/* Editor Font Family */}
          <div className="flex items-center gap-3">
            <div className="flex flex-col w-28">
              <span className="text-foreground/90 font-mono text-xs">Editor Font</span>
              <span className="text-muted-foreground/60 text-xs">Writing interface</span>
            </div>
            <select
              value={localConfig.appearance?.editorFontFamily || 'system-ui'}
              onChange={(e) => setLocalConfig({
                ...localConfig,
                appearance: {
                  ...localConfig.appearance,
                  editorFontFamily: e.target.value
                }
              })}
              className="flex-1 px-3 py-2 text-xs bg-background/20 border border-border/20 rounded-2xl text-foreground focus:outline-none focus:border-primary/40"
            >
              <option value="system-ui">System UI</option>
              <option value="monospace">Monospace</option>
              <option value="serif">Serif</option>
              <option value="Inter, sans-serif">Inter</option>
              <option value="SF Mono, Monaco, monospace">SF Mono</option>
              <option value="JetBrains Mono, monospace">JetBrains Mono</option>
            </select>
          </div>

        </div>
      </div>

      {/* Preview Settings */}
      <div className="bg-card/20 rounded-2xl p-4 border border-border/10">
        <h3 className="text-xs font-medium text-foreground/90 mb-3 flex items-center gap-2 uppercase tracking-wide">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground/70">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
          Preview
        </h3>
        <div className="space-y-3 text-xs">
          
          {/* Syntax Highlighting */}
          <div className="flex justify-between items-center gap-3">
            <div className="flex flex-col">
              <span className="text-foreground/90 font-mono text-xs">Syntax Highlighting</span>
              <span className="text-muted-foreground/60 text-xs">Color code blocks in preview</span>
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="syntax-highlighting"
                checked={localConfig.appearance?.syntaxHighlighting ?? true}
                onChange={(e) => setLocalConfig({
                  ...localConfig,
                  appearance: {
                    ...localConfig.appearance,
                    syntaxHighlighting: e.target.checked
                  }
                })}
                className="w-4 h-4 text-primary bg-background border border-border/30 rounded-xl focus:ring-primary/50 focus:ring-2 cursor-pointer"
              />
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}