import { useState, useEffect } from 'react';
import { applyTheme, getAllThemes, getThemeById } from '../../types/theme';
import { useConfigStore } from '../../stores/config-store';
import { Palette } from '../../lib/lucide';

interface ThemeSelectorProps {
  onSave?: () => void;
}

export function ThemeSelector({ onSave }: ThemeSelectorProps) {
  const { config, updateConfig } = useConfigStore();
  // Current saved theme in config
  const savedThemeId = config.appearance?.themeId || 'midnight-ink';
  // Theme that user has clicked to preview (not yet saved)
  const [previewThemeId, setPreviewThemeId] = useState<string | null>(null);
  // Theme being hovered (visual preview only)
  const [hoverThemeId, setHoverThemeId] = useState<string | null>(null);

  // Apply preview theme when it changes
  useEffect(() => {
    const themeToApply = previewThemeId || savedThemeId;
    const theme = getThemeById(themeToApply);
    if (theme) {
      console.log('[THEME] Applying theme:', themeToApply, previewThemeId ? '(preview)' : '(saved)');
      applyTheme(theme);
    }
  }, [previewThemeId, savedThemeId]);

  // Reset preview on unmount
  useEffect(() => {
    return () => {
      if (previewThemeId) {
        const savedTheme = getThemeById(savedThemeId);
        if (savedTheme) {
          applyTheme(savedTheme);
        }
      }
    };
  }, []);

  const handleThemeClick = (themeId: string) => {
    console.log('[THEME] User clicked theme:', themeId);
    if (previewThemeId === themeId) {
      // Clicking same theme again cancels preview
      setPreviewThemeId(null);
    } else {
      // Set as preview theme
      setPreviewThemeId(themeId);
    }
  };
  
  const handleSaveTheme = async () => {
    if (!previewThemeId) return;
    
    console.log('[THEME] Saving theme:', previewThemeId);
    try {
      await updateConfig({
        appearance: {
          ...config.appearance,
          themeId: previewThemeId,
        }
      });
      console.log('[THEME] Theme saved to config successfully');
      setPreviewThemeId(null); // Clear preview since it's now saved
      onSave?.(); // Notify parent component
    } catch (error) {
      console.error('[THEME] Failed to save theme to config:', error);
    }
  };

  const handleThemeHover = (themeId: string | null) => {
    setHoverThemeId(themeId);
    // Visual preview only - no theme application
  };
  
  // Get the display state for a theme
  const getThemeState = (themeId: string) => {
    if (savedThemeId === themeId && !previewThemeId) return 'selected';
    if (previewThemeId === themeId) return 'preview';
    if (hoverThemeId === themeId) return 'hover';
    return 'default';
  };

  const allThemes = getAllThemes();


  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-muted-foreground/70">
          Click to preview theme
        </p>
        {previewThemeId && (
          <button
            onClick={handleSaveTheme}
            className="text-xs px-2 py-1 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
          >
            Apply Theme
          </button>
        )}
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {allThemes.map((theme) => (
          <button
            key={theme.id}
            onClick={() => handleThemeClick(theme.id)}
            onMouseEnter={() => handleThemeHover(theme.id)}
            onMouseLeave={() => handleThemeHover(null)}
            className={`group relative p-1.5 rounded transition-all text-left ${
              getThemeState(theme.id) === 'selected'
                ? 'border-primary border-solid bg-primary/10' 
                : getThemeState(theme.id) === 'preview'
                ? 'border-primary border-dashed bg-primary/5 border-2'
                : getThemeState(theme.id) === 'hover'
                ? 'border-primary/60 bg-primary/5 border-solid'
                : 'border-border/50 hover:border-border bg-card/30 hover:bg-card/50 border-solid'
            }`}
          >
            {/* Theme Preview */}
            <div className="flex flex-col items-center gap-1">
              <div 
                className="w-10 h-10 rounded border border-border/50 relative overflow-hidden"
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
              
              <h4 className="text-[10px] font-medium text-foreground/80 truncate px-1">
                {theme.name}
              </h4>
              {getThemeState(theme.id) === 'selected' && (
                <div className="w-1.5 h-1.5 bg-primary rounded-full mx-auto"></div>
              )}
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