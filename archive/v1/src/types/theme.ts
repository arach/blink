export interface Theme {
  id: string;
  name: string;
  description?: string;
  fonts: {
    editor: string;
    preview: string;
    ui: string;
  };
  colors: {
    // Core colors
    background: string;
    foreground: string;
    
    // UI colors
    card: string;
    cardForeground: string;
    
    // Interactive colors
    primary: string;
    primaryForeground: string;
    
    // State colors
    muted: string;
    mutedForeground: string;
    
    // Borders and dividers
    border: string;
    
    // Accent colors
    accent: string;
    accentForeground: string;
    
    // Semantic colors
    destructive: string;
    destructiveForeground: string;
  };
  backgroundTexture?: {
    type: 'none' | 'paper' | 'canvas' | 'grid' | 'dots' | 'noise' | 'gradient';
    opacity?: number;
    scale?: number;
    color?: string;
  };
  codeTheme?: 'github-dark' | 'github-light' | 'dracula' | 'monokai' | 'nord' | 'one-dark';
}

export interface ThemePreset extends Theme {
  readonly preset: true;
}

// Built-in theme presets
export const themes: Record<string, ThemePreset> = {
  // Dark themes
  midnightInk: {
    id: 'midnight-ink',
    preset: true,
    name: 'Midnight Ink',
    description: 'Deep blues with paper texture for late night writing',
    fonts: {
      editor: 'JetBrains Mono, monospace',
      preview: 'Inter, -apple-system, sans-serif',
      ui: 'system-ui',
    },
    colors: {
      background: '#0a0f1c',
      foreground: '#e1e7f0',
      card: '#111827',
      cardForeground: '#e1e7f0',
      primary: '#60a5fa',
      primaryForeground: '#030711',
      muted: '#1e293b',
      mutedForeground: '#94a3b8',
      border: '#1e293b',
      accent: '#60a5fa',
      accentForeground: '#030711',
      destructive: '#ef4444',
      destructiveForeground: '#fef2f2',
    },
    backgroundTexture: {
      type: 'paper',
      opacity: 0.03,
    },
    codeTheme: 'github-dark',
  },

  darkForest: {
    id: 'dark-forest',
    preset: true,
    name: 'Dark Forest',
    description: 'Deep greens inspired by dense forests',
    fonts: {
      editor: 'Fira Code, monospace',
      preview: 'Merriweather, Georgia, serif',
      ui: 'system-ui',
    },
    colors: {
      background: '#0d1117',
      foreground: '#c9d1d9',
      card: '#161b22',
      cardForeground: '#c9d1d9',
      primary: '#34d399',
      primaryForeground: '#022c22',
      muted: '#21262d',
      mutedForeground: '#8b949e',
      border: '#30363d',
      accent: '#059669',
      accentForeground: '#ecfdf5',
      destructive: '#f87171',
      destructiveForeground: '#fef2f2',
    },
    backgroundTexture: {
      type: 'canvas',
      opacity: 0.02,
    },
    codeTheme: 'one-dark',
  },

  cosmicDusk: {
    id: 'cosmic-dusk',
    preset: true,
    name: 'Cosmic Dusk',
    description: 'Purple hues with a starry gradient',
    fonts: {
      editor: 'SF Mono, Monaco, monospace',
      preview: 'Inter, -apple-system, sans-serif',
      ui: 'system-ui',
    },
    colors: {
      background: '#13111c',
      foreground: '#e4e4e7',
      card: '#1e1b2e',
      cardForeground: '#e4e4e7',
      primary: '#a78bfa',
      primaryForeground: '#1a0f2e',
      muted: '#2e2a3e',
      mutedForeground: '#a1a1aa',
      border: '#3b3547',
      accent: '#c084fc',
      accentForeground: '#1a0f2e',
      destructive: '#f87171',
      destructiveForeground: '#fef2f2',
    },
    backgroundTexture: {
      type: 'gradient',
      opacity: 0.1,
    },
    codeTheme: 'dracula',
  },

  // Light themes
  morningMist: {
    id: 'morning-mist',
    preset: true,
    name: 'Morning Mist',
    description: 'Soft grays with subtle paper texture',
    fonts: {
      editor: 'JetBrains Mono, monospace',
      preview: 'Inter, -apple-system, sans-serif',
      ui: 'system-ui',
    },
    colors: {
      background: '#fafafa',
      foreground: '#18181b',
      card: '#ffffff',
      cardForeground: '#18181b',
      primary: '#3b82f6',
      primaryForeground: '#ffffff',
      muted: '#f4f4f5',
      mutedForeground: '#71717a',
      border: '#e4e4e7',
      accent: '#2563eb',
      accentForeground: '#ffffff',
      destructive: '#dc2626',
      destructiveForeground: '#ffffff',
    },
    backgroundTexture: {
      type: 'paper',
      opacity: 0.05,
    },
    codeTheme: 'github-light',
  },

  warmParchment: {
    id: 'warm-parchment',
    preset: true,
    name: 'Warm Parchment',
    description: 'Cream tones reminiscent of aged paper',
    fonts: {
      editor: 'Fira Code, monospace',
      preview: 'Crimson Text, Georgia, serif',
      ui: 'system-ui',
    },
    colors: {
      background: '#faf8f3',
      foreground: '#3d2e1f',
      card: '#ffffff',
      cardForeground: '#3d2e1f',
      primary: '#d97706',
      primaryForeground: '#ffffff',
      muted: '#f3f1ea',
      mutedForeground: '#78716c',
      border: '#e7e5db',
      accent: '#f59e0b',
      accentForeground: '#451a03',
      destructive: '#dc2626',
      destructiveForeground: '#ffffff',
    },
    backgroundTexture: {
      type: 'canvas',
      opacity: 0.08,
      color: '#d4a574',
    },
    codeTheme: 'github-light',
  },

  // Monochrome themes
  pureMono: {
    id: 'pure-mono',
    preset: true,
    name: 'Pure Mono',
    description: 'Classic black on white for ultimate clarity',
    fonts: {
      editor: 'ui-monospace, monospace',
      preview: '-apple-system, system-ui, sans-serif',
      ui: 'system-ui',
    },
    colors: {
      background: '#ffffff',
      foreground: '#000000',
      card: '#fafafa',
      cardForeground: '#000000',
      primary: '#000000',
      primaryForeground: '#ffffff',
      muted: '#f5f5f5',
      mutedForeground: '#525252',
      border: '#e5e5e5',
      accent: '#171717',
      accentForeground: '#ffffff',
      destructive: '#dc2626',
      destructiveForeground: '#ffffff',
    },
    backgroundTexture: {
      type: 'none',
    },
    codeTheme: 'github-light',
  },

  inverseVoid: {
    id: 'inverse-void',
    preset: true,
    name: 'Inverse Void',
    description: 'White on black for focused night writing',
    fonts: {
      editor: 'ui-monospace, monospace',
      preview: '-apple-system, system-ui, sans-serif',
      ui: 'system-ui',
    },
    colors: {
      background: '#000000',
      foreground: '#ffffff',
      card: '#0a0a0a',
      cardForeground: '#ffffff',
      primary: '#ffffff',
      primaryForeground: '#000000',
      muted: '#171717',
      mutedForeground: '#a3a3a3',
      border: '#262626',
      accent: '#fafafa',
      accentForeground: '#000000',
      destructive: '#ef4444',
      destructiveForeground: '#ffffff',
    },
    backgroundTexture: {
      type: 'none',
    },
    codeTheme: 'github-dark',
  },

  // Unique themes
  terminalGreen: {
    id: 'terminal-green',
    preset: true,
    name: 'Terminal Green',
    description: 'Classic terminal phosphor green',
    fonts: {
      editor: 'JetBrains Mono, Consolas, monospace',
      preview: 'JetBrains Mono, Consolas, monospace',
      ui: 'JetBrains Mono, monospace',
    },
    colors: {
      background: '#0c0c0c',
      foreground: '#00ff00',
      card: '#1a1a1a',
      cardForeground: '#00ff00',
      primary: '#00ff00',
      primaryForeground: '#000000',
      muted: '#1a1a1a',
      mutedForeground: '#00cc00',
      border: '#00ff00',
      accent: '#00ff88',
      accentForeground: '#000000',
      destructive: '#ff0040',
      destructiveForeground: '#000000',
    },
    backgroundTexture: {
      type: 'grid',
      opacity: 0.03,
      color: '#00ff00',
    },
    codeTheme: 'monokai',
  },

  cyberpunkNeon: {
    id: 'cyberpunk-neon',
    preset: true,
    name: 'Cyberpunk Neon',
    description: 'Vibrant neons on dark backgrounds',
    fonts: {
      editor: 'Fira Code, monospace',
      preview: 'Inter, -apple-system, sans-serif',
      ui: 'system-ui',
    },
    colors: {
      background: '#0a0014',
      foreground: '#ff0080',
      card: '#1a0028',
      cardForeground: '#ff0080',
      primary: '#00ffff',
      primaryForeground: '#000000',
      muted: '#2d0042',
      mutedForeground: '#ff66b3',
      border: '#ff0080',
      accent: '#ffff00',
      accentForeground: '#000000',
      destructive: '#ff0040',
      destructiveForeground: '#000000',
    },
    backgroundTexture: {
      type: 'dots',
      opacity: 0.05,
      color: '#ff0080',
    },
    codeTheme: 'dracula',
  },

  // Professional themes
  executiveSuite: {
    id: 'executive-suite',
    preset: true,
    name: 'Executive Suite',
    description: 'Professional blues and grays',
    fonts: {
      editor: 'SF Mono, Monaco, monospace',
      preview: 'Georgia, Times New Roman, serif',
      ui: '-apple-system, system-ui',
    },
    colors: {
      background: '#f8fafc',
      foreground: '#1e293b',
      card: '#ffffff',
      cardForeground: '#1e293b',
      primary: '#1e40af',
      primaryForeground: '#ffffff',
      muted: '#f1f5f9',
      mutedForeground: '#64748b',
      border: '#e2e8f0',
      accent: '#3b82f6',
      accentForeground: '#ffffff',
      destructive: '#dc2626',
      destructiveForeground: '#ffffff',
    },
    backgroundTexture: {
      type: 'none',
    },
    codeTheme: 'github-light',
  },

  // Creative themes
  pastelDream: {
    id: 'pastel-dream',
    preset: true,
    name: 'Pastel Dream',
    description: 'Soft pastels for creative writing',
    fonts: {
      editor: 'Comic Neue, cursive',
      preview: 'Inter, -apple-system, sans-serif',
      ui: 'system-ui',
    },
    colors: {
      background: '#fef3f8',
      foreground: '#701a75',
      card: '#ffffff',
      cardForeground: '#701a75',
      primary: '#ec4899',
      primaryForeground: '#ffffff',
      muted: '#fce7f3',
      mutedForeground: '#a21caf',
      border: '#fbcfe8',
      accent: '#f472b6',
      accentForeground: '#500724',
      destructive: '#dc2626',
      destructiveForeground: '#ffffff',
    },
    backgroundTexture: {
      type: 'noise',
      opacity: 0.02,
    },
    codeTheme: 'github-light',
  },

  // Minimalist themes
  zenGarden: {
    id: 'zen-garden',
    preset: true,
    name: 'Zen Garden',
    description: 'Minimal greens and natural tones',
    fonts: {
      editor: 'system-ui',
      preview: 'Inter, -apple-system, sans-serif',
      ui: 'system-ui',
    },
    colors: {
      background: '#f0fdf4',
      foreground: '#14532d',
      card: '#ffffff',
      cardForeground: '#14532d',
      primary: '#16a34a',
      primaryForeground: '#ffffff',
      muted: '#dcfce7',
      mutedForeground: '#166534',
      border: '#bbf7d0',
      accent: '#22c55e',
      accentForeground: '#052e16',
      destructive: '#dc2626',
      destructiveForeground: '#ffffff',
    },
    backgroundTexture: {
      type: 'none',
    },
    codeTheme: 'github-light',
  },

  // High contrast themes
  highContrastDark: {
    id: 'high-contrast-dark',
    preset: true,
    name: 'High Contrast Dark',
    description: 'Maximum contrast for accessibility',
    fonts: {
      editor: 'ui-monospace, monospace',
      preview: '-apple-system, system-ui, sans-serif',
      ui: 'system-ui',
    },
    colors: {
      background: '#000000',
      foreground: '#ffffff',
      card: '#000000',
      cardForeground: '#ffffff',
      primary: '#ffffff',
      primaryForeground: '#000000',
      muted: '#000000',
      mutedForeground: '#ffffff',
      border: '#ffffff',
      accent: '#ffffff',
      accentForeground: '#000000',
      destructive: '#ff6b6b',
      destructiveForeground: '#000000',
    },
    backgroundTexture: {
      type: 'none',
    },
    codeTheme: 'github-dark',
  },

  // Seasonal themes
  autumnHarvest: {
    id: 'autumn-harvest',
    preset: true,
    name: 'Autumn Harvest',
    description: 'Warm oranges and browns of fall',
    fonts: {
      editor: 'Fira Code, monospace',
      preview: 'Merriweather, Georgia, serif',
      ui: 'system-ui',
    },
    colors: {
      background: '#1a0f0a',
      foreground: '#fde68a',
      card: '#2d1810',
      cardForeground: '#fde68a',
      primary: '#f97316',
      primaryForeground: '#1a0f0a',
      muted: '#451a03',
      mutedForeground: '#fbbf24',
      border: '#78350f',
      accent: '#fb923c',
      accentForeground: '#1a0f0a',
      destructive: '#dc2626',
      destructiveForeground: '#ffffff',
    },
    backgroundTexture: {
      type: 'canvas',
      opacity: 0.04,
      color: '#f97316',
    },
    codeTheme: 'monokai',
  },

  arcticFrost: {
    id: 'arctic-frost',
    preset: true,
    name: 'Arctic Frost',
    description: 'Cool blues and whites of winter',
    fonts: {
      editor: 'JetBrains Mono, monospace',
      preview: 'Inter, -apple-system, sans-serif',
      ui: 'system-ui',
    },
    colors: {
      background: '#f0f9ff',
      foreground: '#0c4a6e',
      card: '#ffffff',
      cardForeground: '#0c4a6e',
      primary: '#0ea5e9',
      primaryForeground: '#ffffff',
      muted: '#e0f2fe',
      mutedForeground: '#0369a1',
      border: '#bae6fd',
      accent: '#38bdf8',
      accentForeground: '#082f49',
      destructive: '#dc2626',
      destructiveForeground: '#ffffff',
    },
    backgroundTexture: {
      type: 'dots',
      opacity: 0.02,
      color: '#0ea5e9',
    },
    codeTheme: 'nord',
  },
};

// Helper function to convert hex to HSL for Tailwind
function hexToHSL(hex: string): string {
  // Remove the # if present
  hex = hex.replace('#', '');
  
  // Convert hex to RGB
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  
  h = Math.round(h * 360);
  s = Math.round(s * 100);
  l = Math.round(l * 100);
  
  // Return in Tailwind's expected format
  return `${h} ${s}% ${l}%`;
}

// Helper function to apply theme to CSS variables
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  
  console.log('[THEME] Applying theme colors:', theme.name);
  
  // Apply colors (convert hex to HSL for Tailwind)
  Object.entries(theme.colors).forEach(([key, value]) => {
    const cssVarName = `--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
    const hslValue = hexToHSL(value);
    console.log('[THEME] Setting', cssVarName, '=', hslValue, '(from', value, ')');
    root.style.setProperty(cssVarName, hslValue);
    
    // Verify it was set
    const actualValue = root.style.getPropertyValue(cssVarName);
    console.log('[THEME] Verified', cssVarName, 'is now:', actualValue);
  });
  
  // Apply fonts
  root.style.setProperty('--font-editor', theme.fonts.editor);
  root.style.setProperty('--font-preview', theme.fonts.preview);
  root.style.setProperty('--font-ui', theme.fonts.ui);
  
  // Apply background texture
  if (theme.backgroundTexture && theme.backgroundTexture.type !== 'none') {
    root.classList.add(`bg-texture-${theme.backgroundTexture.type}`);
    if (theme.backgroundTexture.opacity) {
      root.style.setProperty('--texture-opacity', theme.backgroundTexture.opacity.toString());
    }
    if (theme.backgroundTexture.color) {
      root.style.setProperty('--texture-color', theme.backgroundTexture.color);
    }
  } else {
    // Remove all texture classes
    ['paper', 'canvas', 'grid', 'dots', 'noise', 'gradient'].forEach(texture => {
      root.classList.remove(`bg-texture-${texture}`);
    });
  }
}

// Get theme by ID (searches by theme.id property, not object key)
export function getThemeById(id: string): Theme | undefined {
  return Object.values(themes).find(theme => theme.id === id);
}

// Get all theme IDs
export function getAllThemeIds(): string[] {
  return Object.keys(themes);
}

// Get all themes as array
export function getAllThemes(): ThemePreset[] {
  return Object.values(themes);
}