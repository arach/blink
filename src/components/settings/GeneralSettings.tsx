import { AppConfig } from '../../types';
import { notesApi } from '../../services/tauri-api';

interface GeneralSettingsProps {
  localConfig: AppConfig;
  setLocalConfig: (config: AppConfig) => void;
  currentNotesDirectory: string;
  directoryInputValue: string;
  setDirectoryInputValue: (value: string) => void;
  onReloadNotes: () => Promise<void>;
  onBrowseDirectory: () => Promise<void>;
  onSetNotesDirectory: () => Promise<void>;
  onImportFile: () => Promise<void>;
  onImportDirectory: () => Promise<void>;
  onExportAll: () => Promise<void>;
}

export function GeneralSettings({
  localConfig,
  setLocalConfig,
  currentNotesDirectory,
  directoryInputValue,
  setDirectoryInputValue,
  onReloadNotes,
  onBrowseDirectory,
  onSetNotesDirectory,
  onImportFile,
  onImportDirectory,
  onExportAll,
}: GeneralSettingsProps) {
  return (
    <div data-section="general" className="space-y-4">
      {/* Section Header - Standardized 76px height to match notes sidebar */}
      <div className="h-[40px] flex flex-col justify-center">
        <h2 className="text-sm font-medium text-foreground mb-1 flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary/70">
            <circle cx="12" cy="12" r="3"/>
            <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1"/>
          </svg>
          General
        </h2>
        <p className="text-xs text-muted-foreground/60">The essentials • who we are, what we do</p>
      </div>

      <div className="bg-card/20 rounded-2xl p-4 border border-border/10">
        <h3 className="text-xs font-medium text-foreground/90 mb-3 flex items-center gap-2 uppercase tracking-wide">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground/70">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 8v4l3 3"/>
          </svg>
          About
        </h3>
        <div className="space-y-3 text-xs">
          <div className="flex justify-between items-center gap-3">
            <span className="text-muted-foreground/80 font-mono w-24">Application</span>
            <div className="flex-1"></div>
            <span className="text-foreground font-mono">Blink</span>
          </div>
          <div className="flex justify-between items-center gap-3">
            <span className="text-muted-foreground/80 font-mono w-24">Version</span>
            <div className="flex-1"></div>
            <span className="text-foreground font-mono">1.0.0</span>
          </div>
          <div className="flex justify-between items-center gap-3">
            <span className="text-muted-foreground/80 font-mono w-24">Author</span>
            <div className="flex-1"></div>
            <span className="text-foreground font-mono">AI-Native Spatial Notes ✨</span>
          </div>
        </div>
      </div>

      <div className="bg-card/20 rounded-2xl p-4 border border-border/10">
        <h3 className="text-xs font-medium text-foreground/90 mb-3 flex items-center gap-2 uppercase tracking-wide">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground/70">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9,22 9,12 15,12 15,22"/>
          </svg>
          Interface
        </h3>
        <div className="space-y-3 text-xs">
          
          {/* Show Note Previews Toggle */}
          <div className="flex justify-between items-center gap-3">
            <div className="flex flex-col">
              <span className="text-foreground/90 font-mono text-xs">Note Previews</span>
              <span className="text-muted-foreground/60 text-xs">Peek at note content without opening</span>
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="note-previews"
                checked={localConfig.appearance?.showNotePreviews ?? false}
                onChange={(e) => setLocalConfig({
                  ...localConfig,
                  appearance: {
                    ...localConfig.appearance,
                    showNotePreviews: e.target.checked
                  }
                })}
                className="w-4 h-4 text-primary bg-background border border-border/30 rounded-xl focus:ring-primary/50 focus:ring-2 cursor-pointer"
              />
            </div>
          </div>
          
          {/* Window Opacity Slider */}
          <div className="flex items-center gap-3">
            <div className="flex flex-col w-28">
              <span className="text-foreground/90 font-mono text-xs">Window Opacity</span>
              <span className="text-muted-foreground/60 text-xs">Background transparency</span>
            </div>
            <div className="flex-1 flex items-center gap-3">
              <span className="text-xs text-muted-foreground/70">🫥</span>
              <div className="flex-1 relative h-5 slider-container">
                <div className="slider-track"></div>
                <div className="slider-ticks">
                  <div className="slider-tick" style={{ left: '10%' }}></div>
                  <div className="slider-tick" style={{ left: '30%' }}></div>
                  <div className="slider-tick" style={{ left: '50%' }}></div>
                  <div className="slider-tick" style={{ left: '70%' }}></div>
                  <div className="slider-tick" style={{ left: '90%' }}></div>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={localConfig.appearance?.windowOpacity}
                  onChange={(e) => setLocalConfig({
                    ...localConfig,
                    appearance: {
                      ...localConfig.appearance,
                      windowOpacity: parseFloat(e.target.value)
                    }
                  })}
                  className="slider-input"
                />
              </div>
              <span className="text-xs text-muted-foreground/70">🫧</span>
            </div>
            <span className="text-xs text-muted-foreground/70 min-w-[3rem] text-right font-mono">
              {Math.round((localConfig.appearance?.windowOpacity ?? 1) * 100)}%
            </span>
          </div>
          
        </div>
      </div>

      {/* File Operations Section */}
      <div className="bg-card/20 rounded-2xl p-4 border border-border/10">
        <h3 className="text-xs font-medium text-foreground/90 mb-3 flex items-center gap-2 uppercase tracking-wide">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground/70">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14,2 14,8 20,8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <line x1="10" y1="9" x2="8" y2="9"/>
          </svg>
          File Operations
        </h3>
        <div className="space-y-3 text-xs">
          
          {/* Notes Directory */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <div className="flex flex-col">
                <span className="text-foreground/90 font-mono text-xs">Notes Directory</span>
                <span className="text-muted-foreground/60 text-xs">Where your notes are stored</span>
              </div>
              <button
                onClick={() => onReloadNotes()}
                className="px-3 py-1.5 text-xs bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/20 rounded-2xl transition-colors"
              >
                Reload Notes
              </button>
            </div>
            <div className="flex gap-2 items-center">
              <input
                type="text"
                value={directoryInputValue}
                onChange={(e) => setDirectoryInputValue(e.target.value)}
                placeholder="/path/to/your/notes"
                className="flex-1 px-3 py-2 text-xs bg-background/20 border border-border/20 rounded-2xl text-foreground placeholder-muted-foreground/60 focus:outline-none focus:border-primary/40"
              />
              <button
                onClick={() => onBrowseDirectory()}
                className="px-3 py-2 text-xs bg-background/40 hover:bg-background/60 border border-border/30 rounded-2xl transition-colors"
              >
                Browse
              </button>
              <button
                onClick={() => onSetNotesDirectory()}
                className="px-3 py-2 text-xs bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 rounded-2xl transition-colors"
              >
                Set
              </button>
            </div>
            {currentNotesDirectory && (
              <div className="text-xs text-muted-foreground/70 font-mono bg-muted/10 px-2 py-1 rounded-xl">
                Current: {currentNotesDirectory}
              </div>
            )}
          </div>
          
          {/* Import Notes */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <div className="flex flex-col">
                <span className="text-foreground/90 font-mono text-xs">Import Notes</span>
                <span className="text-muted-foreground/60 text-xs">Load notes from markdown files</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => onImportFile()}
                  className="px-3 py-1.5 text-xs bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 rounded-2xl transition-colors"
                >
                  Import File
                </button>
                <button
                  onClick={() => onImportDirectory()}
                  className="px-3 py-1.5 text-xs bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 rounded-2xl transition-colors"
                >
                  Import Folder
                </button>
              </div>
            </div>
          </div>
          
          {/* Export Notes */}
          <div className="flex justify-between items-center">
            <div className="flex flex-col">
              <span className="text-foreground/90 font-mono text-xs">Export Notes</span>
              <span className="text-muted-foreground/60 text-xs">Save all notes as markdown files</span>
            </div>
            <button
              onClick={() => onExportAll()}
              className="px-3 py-1.5 text-xs bg-green-500/10 text-green-400 hover:bg-green-500/20 border border-green-500/20 rounded-2xl transition-colors"
            >
              Export All
            </button>
          </div>
          
          {/* Help Text */}
          <div className="bg-muted/10 rounded-2xl p-3 border border-border/10">
            <div className="text-xs text-muted-foreground/80 leading-relaxed space-y-2">
              <div>
                <strong className="text-foreground/90">Markdown Format:</strong> Notes are stored as <code className="text-xs bg-background/40 px-1 rounded-xl">.md</code> files with YAML frontmatter containing metadata (title, tags, dates).
              </div>
              <div>
                <strong className="text-foreground/90">Directory Mode:</strong> Set a custom directory to load/save notes directly as files, perfect for syncing with git, Dropbox, or other tools.
              </div>
            </div>
          </div>
          
        </div>
      </div>

    </div>
  );
}