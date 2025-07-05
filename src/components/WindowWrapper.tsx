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
      className={`w-full h-full text-foreground flex flex-col bg-background ${className}`}
      style={{ 
        backgroundColor: windowOpacity !== undefined && windowOpacity > 0
          ? `hsl(var(--background) / ${windowOpacity})` 
          : 'hsl(var(--background) / 0.95)',
        minHeight: '100vh',
        ...style,
      }}
    >
      {children}
    </div>
  );
}