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
      className={`w-full h-full text-foreground flex flex-col bg-background rounded-xl overflow-hidden ${className}`}
      style={{ 
        backgroundColor: windowOpacity !== undefined ? `hsl(var(--background) / ${windowOpacity})` : undefined,
        minHeight: '100vh',
        ...style,
      }}
    >
      {children}
    </div>
  );
}