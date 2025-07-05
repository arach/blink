import { useState, useEffect } from 'react';
import { themes, applyTheme, getAllThemes, getThemeById } from '../types/theme';
import { useConfigStore } from '../stores/config-store';
import { Check, Palette } from 'lucide-react';

export function ThemeSelector() {
  const { config, updateConfig } = useConfigStore();
  const [selectedThemeId, setSelectedThemeId] = useState(config.appearance?.themeId || 'midnight-ink');
  const [previewThemeId, setPreviewThemeId] = useState<string | null>(null);
  const [originalThemeId, setOriginalThemeId] = useState<string | null>(null);

  // Store original theme on mount and revert on unmount
  useEffect(() => {
    const currentThemeId = config.appearance?.themeId || 'midnight-ink';
    setOriginalThemeId(currentThemeId);
    console.log('[THEME] ThemeSelector mounted, storing original theme:', currentThemeId);
    
    // Cleanup function to revert to original theme if no selection was made
    return () => {
      if (originalThemeId && originalThemeId !== selectedThemeId) {
        console.log('[THEME] ThemeSelector unmounting, reverting to original theme:', originalThemeId);
        const originalTheme = getThemeById(originalThemeId);
        if (originalTheme) {
          applyTheme(originalTheme);
        }
      }
    };
  }, []); // Only run on mount

  // Update selected theme when config changes
  useEffect(() => {
    if (config.appearance?.themeId && config.appearance.themeId !== selectedThemeId) {
      setSelectedThemeId(config.appearance.themeId);
    }
  }, [config.appearance?.themeId, selectedThemeId]);

  // Apply theme preview on hover
  useEffect(() => {
    if (previewThemeId) {
      const theme = getThemeById(previewThemeId);
      console.log('[THEME] Applying preview theme:', previewThemeId);
      if (theme) {
        applyTheme(theme);
      }
    }
  }, [previewThemeId]);

  const handleThemeSelect = async (themeId: string) => {
    console.log('[THEME] User selected theme:', themeId);
    setSelectedThemeId(themeId);
    setPreviewThemeId(null);
    
    // Apply theme immediately
    const theme = getThemeById(themeId);
    if (theme) {
      console.log('[THEME] Applying theme immediately:', theme.name);
      applyTheme(theme);
    }
    
    // Save to config
    try {
      await updateConfig({
        appearance: {
          ...config.appearance,
          themeId: themeId,
        }
      });
      console.log('[THEME] Theme saved to config successfully');
    } catch (error) {
      console.error('[THEME] Failed to save theme to config:', error);
    }
  };

  const handleThemeHover = (themeId: string | null) => {
    setPreviewThemeId(themeId);
    
    // If hovering out, reapply the currently selected/original theme
    if (!themeId) {
      const currentThemeId = config.appearance?.themeId || 'midnight-ink';
      const theme = getThemeById(currentThemeId);
      if (theme) {
        console.log('[THEME] Reapplying current theme:', currentThemeId);
        applyTheme(theme);
      }
    }
  };

  const allThemes = getAllThemes();


  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {allThemes.map((theme) => (
          <button
            key={theme.id}
            onClick={() => handleThemeSelect(theme.id)}
            onMouseEnter={() => handleThemeHover(theme.id)}
            onMouseLeave={() => handleThemeHover(null)}
            className={`group relative p-2 rounded border transition-all text-left ${
              selectedThemeId === theme.id 
                ? 'border-primary bg-primary/10' 
                : 'border-border/50 hover:border-border bg-card/30 hover:bg-card/50'
            }`}
          >
            {/* Theme Preview */}
            <div className="flex items-start gap-2 mb-1.5">
              <div 
                className="w-8 h-8 rounded border border-border/50 relative overflow-hidden flex-shrink-0"
                style={{ 
                  backgroundColor: theme.colors.background,
                  borderColor: theme.colors.border,
                }}
              >
                {/* Mini preview of theme */}
                <div 
                  className="absolute top-0.5 left-0.5 w-2 h-0.5 rounded-full"
                  style={{ backgroundColor: theme.colors.primary }}
                />
                <div 
                  className="absolute top-1.5 left-0.5 right-0.5 h-0.5 rounded-full opacity-50"
                  style={{ backgroundColor: theme.colors.foreground }}
                />
                <div 
                  className="absolute top-2.5 left-0.5 right-1 h-0.5 rounded-full opacity-30"
                  style={{ backgroundColor: theme.colors.foreground }}
                />
                <div 
                  className="absolute bottom-0.5 left-0.5 w-2 h-2 rounded"
                  style={{ backgroundColor: theme.colors.card }}
                />
                {theme.backgroundTexture && theme.backgroundTexture.type !== 'none' && (
                  <div className="absolute top-0.5 right-0.5">
                    <div 
                      className={`w-1 h-1 rounded-full opacity-50`}
                      style={{ backgroundColor: theme.colors.accent }}
                    />
                  </div>
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-medium text-foreground/90 truncate flex items-center gap-1">
                  {theme.name}
                  {selectedThemeId === theme.id && (
                    <Check className="w-2.5 h-2.5 text-primary" />
                  )}
                </h4>
              </div>
            </div>

            {/* Color swatches */}
            <div className="flex gap-0.5">
              <div 
                className="w-3 h-3 rounded border border-border/50"
                style={{ backgroundColor: theme.colors.background }}
                title="Background"
              />
              <div 
                className="w-3 h-3 rounded border border-border/50"
                style={{ backgroundColor: theme.colors.foreground }}
                title="Text"
              />
              <div 
                className="w-3 h-3 rounded border border-border/50"
                style={{ backgroundColor: theme.colors.primary }}
                title="Primary"
              />
              <div 
                className="w-3 h-3 rounded border border-border/50"
                style={{ backgroundColor: theme.colors.accent }}
                title="Accent"
              />
            </div>
          </button>
        ))}
      </div>

      {/* Custom Theme Button (future feature) */}
      <button className="w-full p-2 rounded border border-dashed border-border/50 hover:border-border bg-card/20 hover:bg-card/30 transition-all text-left group">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded border border-dashed border-border/50 flex items-center justify-center bg-background/50">
            <Palette className="w-3 h-3 text-muted-foreground/50 group-hover:text-muted-foreground/70" />
          </div>
          <div>
            <h4 className="text-xs font-medium text-muted-foreground/70 group-hover:text-muted-foreground/90">
              Create Custom Theme
            </h4>
          </div>
        </div>
      </button>
    </div>
  );
}