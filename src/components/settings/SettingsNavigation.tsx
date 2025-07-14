import { ResizablePanel } from '../windows/ResizablePanel';

type SettingsSection = 'general' | 'appearance' | 'shortcuts' | 'editor' | 'advanced';

interface SettingsNavigationProps {
  sidebarVisible: boolean;
  selectedSection: SettingsSection;
  onSectionChange: (section: SettingsSection) => void;
}

export function SettingsNavigation({
  sidebarVisible,
  selectedSection,
  onSectionChange
}: SettingsNavigationProps) {
  return (
    <div className={`h-full overflow-hidden transition-all duration-300 ease-out ${
      sidebarVisible ? 'w-80' : 'w-0'
    }`}>
      <ResizablePanel defaultWidth={320} minWidth={240} maxWidth={400}>
        <div className="h-full bg-card border-r border-border/30 flex flex-col">
          {/* Header - Standardized 76px height */}
          <div className="h-[76px] flex flex-col justify-center px-4 border-b border-border/20">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 pt-5">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary/70">
                  <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
                <h2 className="text-sm font-semibold tracking-tight text-foreground">Settings</h2>
              </div>
            </div>
            
            {/* Empty row for vertical structure alignment */}
            <div className="h-7"></div>
          </div>
          
          {/* Settings sections list */}
          <div className="flex-1 overflow-y-auto p-2">
            <div className="space-y-1">
              <button 
                onClick={() => onSectionChange('general')}
                className={`w-full p-3 rounded-2xl text-left transition-all ${
                  selectedSection === 'general'
                    ? 'bg-primary/10 border border-primary/20'
                    : 'hover:bg-background/60 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground/70 flex-shrink-0">
                    <circle cx="12" cy="12" r="3"/>
                    <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1"/>
                  </svg>
                  <h3 className={`text-sm font-medium ${
                    selectedSection === 'general' ? 'text-primary' : 'text-foreground'
                  }`}>General</h3>
                </div>
                <p className="text-xs text-muted-foreground/60">App info and interface settings</p>
              </button>
              
              <button 
                onClick={() => onSectionChange('appearance')}
                className={`w-full p-3 rounded-2xl text-left transition-all ${
                  selectedSection === 'appearance'
                    ? 'bg-primary/10 border border-primary/20'
                    : 'hover:bg-background/60 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground/70 flex-shrink-0">
                    <path d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M19.07 4.93L4.93 19.07"/>
                  </svg>
                  <h3 className={`text-sm font-medium ${
                    selectedSection === 'appearance' ? 'text-primary' : 'text-foreground'
                  }`}>Appearance</h3>
                </div>
                <p className="text-xs text-muted-foreground/60">Theme, fonts, and visual preferences</p>
              </button>
              
              <button 
                onClick={() => onSectionChange('shortcuts')}
                className={`w-full p-3 rounded-2xl text-left transition-all ${
                  selectedSection === 'shortcuts'
                    ? 'bg-primary/10 border border-primary/20'
                    : 'hover:bg-background/60 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground/70 flex-shrink-0">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                    <line x1="8" y1="21" x2="16" y2="21"/>
                    <line x1="12" y1="17" x2="12" y2="21"/>
                  </svg>
                  <h3 className={`text-sm font-medium ${
                    selectedSection === 'shortcuts' ? 'text-primary' : 'text-foreground'
                  }`}>Shortcuts</h3>
                </div>
                <p className="text-xs text-muted-foreground/60">Keyboard shortcuts and hotkeys</p>
              </button>
              
              <button 
                onClick={() => onSectionChange('editor')}
                className={`w-full p-3 rounded-2xl text-left transition-all ${
                  selectedSection === 'editor'
                    ? 'bg-primary/10 border border-primary/20'
                    : 'hover:bg-background/60 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground/70 flex-shrink-0">
                    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                    <path d="m15 5 4 4"/>
                  </svg>
                  <h3 className={`text-sm font-medium ${
                    selectedSection === 'editor' ? 'text-primary' : 'text-foreground'
                  }`}>Editor</h3>
                </div>
                <p className="text-xs text-muted-foreground/60">Writing and editing preferences</p>
              </button>
              
              <button 
                onClick={() => onSectionChange('advanced')}
                className={`w-full p-3 rounded-2xl text-left transition-all ${
                  selectedSection === 'advanced'
                    ? 'bg-primary/10 border border-primary/20'
                    : 'hover:bg-background/60 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground/70 flex-shrink-0">
                    <polygon points="13,2 3,14 12,14 11,22 21,10 12,10"/>
                  </svg>
                  <h3 className={`text-sm font-medium ${
                    selectedSection === 'advanced' ? 'text-primary' : 'text-foreground'
                  }`}>Advanced</h3>
                </div>
                <p className="text-xs text-muted-foreground/60">Developer and system settings</p>
              </button>
            </div>
          </div>
        </div>
      </ResizablePanel>
    </div>
  );
}