import { ReactNode } from 'react';
import { useConfigStore } from '../stores/config-store';

interface WindowWrapperProps {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function WindowWrapper({ children, className = '', style }: WindowWrapperProps) {
  const { config } = useConfigStore();
  
  // Log config state in WindowWrapper
  console.log('[BLINK] [WINDOWWRAPPER] 🔄 WindowWrapper render - config state:', {
    config: config ? 'present' : 'null',
    hasAppearance: config?.appearance ? 'yes' : 'no',
    windowOpacity: config?.appearance?.windowOpacity
  });
  
  // Defensive check for config
  if (!config) {
    console.error('[BLINK] [WINDOWWRAPPER] ❌ Config is null! Using fallback');
    return (
      <div 
        className={`w-full h-full text-foreground flex flex-col rounded-2xl overflow-hidden border border-border/30 shadow-xl ${className}`}
        style={{ 
          backgroundColor: `hsl(var(--background))`,
          height: '100%',
          ...style,
        }}
      >
        {children}
      </div>
    );
  }
  
  const windowOpacity = config.appearance?.windowOpacity;
  
  return (
    <div 
      className={`w-full h-full text-foreground flex flex-col rounded-2xl overflow-hidden border border-border/30 shadow-xl ${className}`}
      style={{ 
        backgroundColor: windowOpacity !== undefined 
          ? `hsl(var(--background) / ${windowOpacity})` 
          : `hsl(var(--background))`, // Ensure background is always visible
        height: '100%', // Use 100% instead of 100vh to match container
        ...style,
      }}
    >
      {children}
    </div>
  );
}