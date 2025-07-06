import { ReactNode } from 'react';
import { useConfigStore } from '../stores/config-store';

interface WindowWrapperProps {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function WindowWrapper({ children, className = '', style }: WindowWrapperProps) {
  const { config } = useConfigStore();
  const windowOpacity = config.appearance?.windowOpacity;
  
  return (
    <div 
      className={`w-full h-full text-foreground flex flex-col bg-background rounded-2xl overflow-hidden border border-border/30 shadow-xl ${className}`}
      style={{ 
        backgroundColor: windowOpacity !== undefined 
          ? `hsl(var(--background) / ${windowOpacity})` 
          : `hsl(var(--background))`, // Ensure background is always visible
        minHeight: '100vh',
        ...style,
      }}
    >
      {children}
    </div>
  );
}