interface NavigationSidebarProps {
  currentView: 'notes' | 'settings';
  sidebarVisible: boolean;
  onNotesClick: () => void;
  onSettingsClick: () => void;
}

export function NavigationSidebar({
  currentView,
  sidebarVisible,
  onNotesClick,
  onSettingsClick
}: NavigationSidebarProps) {
  return (
    <div className="w-8 bg-muted/80 flex flex-col items-center justify-between border-r border-primary/30 flex-shrink-0 relative z-10 backdrop-blur-sm" data-sidebar>
      <div className="flex flex-col items-center pt-4">
        {/* Notes view icon */}
        <button 
          onClick={onNotesClick}
          className={`w-6 h-6 flex items-center justify-center m-0.5 rounded transition-colors hover:animate-flip-x ${
            currentView === 'notes' 
              ? 'bg-primary text-background' 
              : 'text-primary/80 hover:text-primary hover:bg-primary/20'
          }`}
          title={sidebarVisible && currentView === 'notes' ? 'Hide notes' : 'Notes'}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14,2 14,8 20,8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <line x1="10" y1="9" x2="8" y2="9"/>
          </svg>
        </button>
      </div>
      <div className="flex flex-col items-center">
        {/* Settings icon */}
        <button 
          onClick={onSettingsClick}
          className={`w-6 h-6 flex items-center justify-center m-0.5 mb-1 rounded transition-colors hover:animate-spin-fast ${
            currentView === 'settings' 
              ? 'bg-primary text-background' 
              : 'text-primary/80 hover:text-primary hover:bg-primary/20'
          }`}
          title={sidebarVisible && currentView === 'settings' ? 'Hide settings' : 'Settings (⌘,)'}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        </button>
      </div>
    </div>
  );
}