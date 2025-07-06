interface PermissionPromptProps {
  show: boolean;
  onOpenSettings: () => void;
  onDismiss: () => void;
}

export function PermissionPrompt({
  show,
  onOpenSettings,
  onDismiss,
}: PermissionPromptProps) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border/30 rounded-2xl shadow-xl max-w-md w-full p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary">
              <path d="M9 12l2 2 4-4"/>
              <path d="M21 12c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2"/>
              <path d="M3 12c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2"/>
              <path d="M10 12h4"/>
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Enable Global Shortcuts
            </h2>
            <p className="text-sm text-muted-foreground">
              Accessibility permissions required
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-4 mb-6">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Blink needs <strong className="text-foreground">Accessibility Access</strong> to enable 
            global shortcuts like <kbd className="px-1.5 py-0.5 bg-background border border-border/30 rounded-xl text-xs">⌘⌃⌥⇧N</kbd> for 
            creating notes from anywhere on your system.
          </p>

          <div className="bg-muted/20 border border-border/20 rounded-2xl p-4">
            <h3 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary/70">
                <path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/>
              </svg>
              Setup Steps
            </h3>
            <ol className="text-sm text-muted-foreground space-y-1 ml-4 list-decimal">
              <li>Click "Open Settings" below</li>
              <li>Find "Blink" in the accessibility apps list</li>
              <li>Toggle the switch to enable access</li>
              <li>Restart Blink to activate shortcuts</li>
            </ol>
          </div>

          <div className="text-xs text-muted-foreground/70 leading-relaxed">
            <strong className="text-foreground">Privacy note:</strong> Blink only monitors 
            the specific keyboard combinations for global shortcuts. No other data is accessed or stored.
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onOpenSettings}
            className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-2xl text-sm font-medium transition-colors"
          >
            Open Settings
          </button>
          <button
            onClick={onDismiss}
            className="px-4 py-2 text-muted-foreground hover:text-foreground border border-border/30 hover:bg-background/60 rounded-2xl text-sm transition-colors"
          >
            Later
          </button>
        </div>

        {/* Close button */}
        <button
          onClick={onDismiss}
          className="absolute top-4 right-4 text-muted-foreground/60 hover:text-foreground p-1 rounded-xl transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    </div>
  );
}