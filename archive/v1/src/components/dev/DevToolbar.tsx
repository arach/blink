import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { DetachedWindowsAPI } from '../../services/detached-windows-api';
import { useDetachedWindowsStore } from '../../stores/detached-windows-store';
import { useNoteManagement } from '../../hooks/use-note-management';

export function DevToolbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [position, setPosition] = useState({ bottom: 8, right: 8 });
  const [isDragging, setIsDragging] = useState(false);
  const [jsonOutput, setJsonOutput] = useState<string>('');
  const [isExpanded, setIsExpanded] = useState(false);
  const { refreshWindows } = useDetachedWindowsStore();

  // Get note management data
  const {
    notes,
    selectedNoteId,
    currentContent,
    loading,
    selectedNote,
    loadNotes,
  } = useNoteManagement();

  const handleDrag = (e: React.MouseEvent) => {
    if (!isOpen) {
      e.preventDefault();
      const startX = e.clientX;
      const startY = e.clientY;
      const startBottom = position.bottom;
      const startRight = position.right;
      
      const handleMove = (moveEvent: MouseEvent) => {
        const deltaX = startX - moveEvent.clientX;
        const deltaY = moveEvent.clientY - startY;
        
        setPosition({
          bottom: Math.max(8, Math.min(window.innerHeight - 60, startBottom - deltaY)),
          right: Math.max(8, Math.min(window.innerWidth - 60, startRight + deltaX))
        });
      };
      
      const handleUp = () => {
        setIsDragging(false);
        document.removeEventListener('mousemove', handleMove);
        document.removeEventListener('mouseup', handleUp);
      };
      
      setIsDragging(true);
      document.addEventListener('mousemove', handleMove);
      document.addEventListener('mouseup', handleUp);
    }
  };

  const showJson = (data: any) => {
    setJsonOutput(typeof data === 'string' ? data : JSON.stringify(data, null, 2));
    setIsExpanded(true);
  };

  const refreshAllData = async () => {
    console.log('🔄 [DEV] Refreshing all data...');
    await loadNotes();
    await refreshWindows();
    console.log('✅ [DEV] Data refreshed');
  };

  const printAllDebugData = async () => {
    console.log('\n========== COMPREHENSIVE DEBUG DATA ==========');
    
    // Frontend State
    const frontendState = {
      notes: notes.map(n => ({
        id: n.id,
        title: n.title,
        position: n.position,
        contentLength: n.content.length,
        updated: n.updated_at
      })),
      selectedNoteId,
      currentContentLength: currentContent.length,
      loading,
      notesCount: notes.length
    };
    
    console.log('\n📱 FRONTEND STATE:');
    console.log(frontendState);
    
    // Backend Notes
    try {
      const backendNotes = await invoke<any[]>('get_notes');
      console.log('\n💾 BACKEND NOTES:');
      console.log(`Count: ${backendNotes.length}`);
      backendNotes.forEach((note, i) => {
        console.log(`  [${i}] ${note.title} (ID: ${note.id}, Pos: ${note.position})`);
      });
      
      // Compare Frontend vs Backend
      const frontendIds = notes.map(n => n.id).sort();
      const backendIds = backendNotes.map(n => n.id).sort();
      
      console.log('\n🔍 COMPARISON:');
      console.log(`Frontend IDs: ${frontendIds.join(', ')}`);
      console.log(`Backend IDs: ${backendIds.join(', ')}`);
      console.log(`Match: ${JSON.stringify(frontendIds) === JSON.stringify(backendIds)}`);
      
      // Notes Directory
      const notesDir = await invoke<string>('get_notes_directory');
      console.log('\n📁 NOTES DIRECTORY:');
      console.log(notesDir);
      
      // Window State
      const windowState = await invoke<string>('get_window_state_truth');
      console.log('\n🪟 WINDOW STATE:');
      console.log(windowState);
      
      // Recent Logs
      let logs = '';
      try {
        logs = await invoke<string>('get_recent_logs', { lines: 20 });
        console.log('\n📝 RECENT BACKEND LOGS:');
        console.log(logs);
      } catch (e) {
        console.log('\n📝 RECENT BACKEND LOGS: (not available)');
        logs = '';
      }
      
      // Parse window state safely
      let parsedWindowState;
      try {
        parsedWindowState = JSON.parse(windowState);
      } catch (e) {
        parsedWindowState = windowState; // Keep as string if not valid JSON
      }
      
      // Compile all data for toolbar display
      const allData = {
        timestamp: new Date().toISOString(),
        frontend: frontendState,
        backend: {
          notesCount: backendNotes.length,
          notes: backendNotes.map(n => ({
            id: n.id,
            title: n.title,
            position: n.position
          }))
        },
        comparison: {
          frontendIds,
          backendIds,
          missingInFrontend: backendIds.filter(id => !frontendIds.includes(id)),
          missingInBackend: frontendIds.filter(id => !backendIds.includes(id)),
          match: JSON.stringify(frontendIds) === JSON.stringify(backendIds)
        },
        notesDirectory: notesDir,
        windowState: parsedWindowState,
        recentLogs: logs ? logs.split('\n').slice(0, 10) : []
      };
      
      // Show in toolbar
      showJson(allData);
      
      // Log to backend (if log_debug command exists)
      try {
        await invoke('log_debug', { 
          category: 'DEV_TOOLBAR', 
          message: 'Comprehensive debug data printed'
        });
      } catch (e) {
        console.log('Note: log_debug command not available');
      }
      
    } catch (error) {
      console.error('❌ Error collecting debug data:', error);
      showJson({ error: String(error) });
    }
    
    console.log('==============================================\n');
  };

  return (
    <div 
      className={`fixed z-50 ${!isOpen ? 'pointer-events-none' : ''}`}
      style={{ bottom: `${position.bottom}px`, right: `${position.right}px` }}
    >
      {/* Toolbar panel */}
      <div className={`bg-black/50 text-white p-3 rounded-lg border border-gray-700/30 backdrop-blur-sm transition-all duration-300 ${
        isOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
      } ${isExpanded ? 'w-[700px]' : 'w-[280px]'} max-h-[80vh] flex flex-col`}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[11px] font-light text-gray-300 tracking-wide">Dev</h3>
          <div className="flex items-center gap-2">
            <div className="text-[10px] text-gray-400">
              {loading ? '⏳' : `${notes.length} notes`}
            </div>
            <button
              onClick={refreshAllData}
              className="text-blue-400 hover:text-blue-300 text-sm transition-colors"
              title="Refresh all data"
            >
              🔄
            </button>
            <button
              onClick={printAllDebugData}
              className="text-green-400 hover:text-green-300 text-sm transition-colors"
              title="Print all debug data"
            >
              🐛
            </button>
            <button
              onClick={() => {
                setIsExpanded(!isExpanded);
                if (isExpanded) setJsonOutput('');
              }}
              className="text-gray-500 hover:text-gray-200 text-sm transition-colors"
              title={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? '◀' : '▶'}
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-500 hover:text-gray-200 text-sm transition-colors"
            >
              ×
            </button>
          </div>
        </div>
      
      <div className={`${isExpanded ? 'flex gap-3 flex-1 overflow-hidden' : ''}`}>
        <div className={`${isExpanded ? 'w-[280px] flex-shrink-0' : ''} space-y-1.5 overflow-y-auto`}>
        {/* Notes Debugging */}
        <div>
          <button
            onClick={() => setActiveCategory(activeCategory === 'notes' ? null : 'notes')}
            className={`w-full px-3 py-1.5 text-[12px] font-light rounded transition-all text-left flex items-center justify-between ${
              activeCategory === 'notes' ? 'bg-purple-600/20 text-purple-300' : 'bg-white/5 hover:bg-white/10'
            }`}
          >
            <span>📝 Notes Debug</span>
            <span className="text-[10px] opacity-60">{activeCategory === 'notes' ? '−' : '+'}</span>
          </button>
        
          {activeCategory === 'notes' && (
            <div className="pl-4 space-y-1 border-l border-gray-700/30 ml-1.5 mt-1">
              <button
                onClick={printAllDebugData}
                className="w-full px-2.5 py-1 bg-green-600/20 hover:bg-green-600/30 text-[11px] font-light rounded transition-all text-left text-green-300"
              >
                🐛 Print All Debug Data
              </button>
              <button
                onClick={refreshAllData}
                className="w-full px-2.5 py-1 bg-blue-600/20 hover:bg-blue-600/30 text-[11px] font-light rounded transition-all text-left text-blue-300"
              >
                🔄 Refresh All Data
              </button>
              <button
                onClick={() => {
                  const state = {
                    loading,
                    selectedNoteId,
                    currentContentLength: currentContent.length,
                    selectedNote,
                    totalNotes: notes.length
                  };
                  showJson(state);
                }}
                className="w-full px-2.5 py-1 bg-white/5 hover:bg-white/10 text-[11px] font-light rounded transition-all text-left"
              >
                Show Notes State
              </button>
              <button
                onClick={() => {
                  const detailedNotes = notes.map((note, index) => ({
                    index,
                    title: note.title || 'Untitled',
                    id: note.id,
                    position: note.position ?? null,
                    contentLength: note.content.length,
                    created: note.created_at,
                    updated: note.updated_at,
                    tags: note.tags,
                    selected: selectedNoteId === note.id
                  }));
                  showJson(detailedNotes);
                }}
                className="w-full px-2.5 py-1 bg-white/5 hover:bg-white/10 text-[11px] font-light rounded transition-all text-left"
              >
                Show All Notes Detailed
              </button>
              <button
                onClick={() => {
                  const sortedNotes = [...notes].sort((a, b) => {
                    if (a.position !== undefined && b.position !== undefined) {
                      return a.position - b.position;
                    }
                    if (a.position !== undefined) return -1;
                    if (b.position !== undefined) return 1;
                    return 0;
                  }).map((note, index) => ({
                    index,
                    position: note.position ?? null,
                    title: note.title || 'Untitled',
                    id: note.id
                  }));
                  showJson(sortedNotes);
                }}
                className="w-full px-2.5 py-1 bg-white/5 hover:bg-white/10 text-[11px] font-light rounded transition-all text-left"
              >
                Show Notes by Position
              </button>
              <button
                onClick={async () => {
                  try {
                    const backendNotes = await invoke<any[]>('get_notes');
                    const formattedNotes = {
                      count: backendNotes.length,
                      notes: backendNotes.map((note, index) => ({
                        index,
                        title: note.title || 'Untitled',
                        id: note.id,
                        position: note.position ?? null
                      }))
                    };
                    showJson(formattedNotes);
                  } catch (error) {
                    showJson({ error: String(error) });
                  }
                }}
                className="w-full px-2.5 py-1 bg-white/5 hover:bg-white/10 text-[11px] font-light rounded transition-all text-left"
              >
                Get Backend Notes
              </button>
              <button
                onClick={() => {
                  if (selectedNoteId) {
                    const note = notes.find(n => n.id === selectedNoteId);
                    if (note) {
                      const details = {
                        id: note.id,
                        title: note.title,
                        position: note.position,
                        contentLength: note.content.length,
                        contentPreview: note.content.substring(0, 200),
                        currentContentLength: currentContent.length,
                        contentMatch: note.content === currentContent
                      };
                      showJson(details);
                    } else {
                      showJson({ error: 'Selected note not found in notes array!' });
                    }
                  } else {
                    showJson({ error: 'No note selected' });
                  }
                }}
                className="w-full px-2.5 py-1 bg-white/5 hover:bg-white/10 text-[11px] font-light rounded transition-all text-left"
              >
                Show Selected Note Details
              </button>
              <button
                onClick={async () => {
                  try {
                    const result = await invoke<string>('get_notes_directory');
                    showJson({ directory: result });
                  } catch (error) {
                    showJson({ error: String(error) });
                  }
                }}
                className="w-full px-2.5 py-1 bg-white/5 hover:bg-white/10 text-[11px] font-light rounded transition-all text-left"
              >
                Get Notes Directory
              </button>
              <button
                onClick={() => {
                  // Compare frontend and backend note lists
                  const frontendIds = notes.map(n => n.id).sort();
                  invoke<any[]>('get_notes').then(backendNotes => {
                    const backendIds = backendNotes.map(n => n.id).sort();
                    const comparison = {
                      frontend: {
                        count: frontendIds.length,
                        ids: frontendIds
                      },
                      backend: {
                        count: backendIds.length,
                        ids: backendIds
                      },
                      missingInFrontend: backendIds.filter(id => !frontendIds.includes(id)),
                      missingInBackend: frontendIds.filter(id => !backendIds.includes(id)),
                      match: JSON.stringify(frontendIds) === JSON.stringify(backendIds)
                    };
                    showJson(comparison);
                  }).catch(error => {
                    showJson({ error: String(error) });
                  });
                }}
                className="w-full px-2.5 py-1 bg-yellow-600/20 hover:bg-yellow-600/30 text-[11px] font-light rounded transition-all text-left text-yellow-300"
              >
                Compare Frontend vs Backend
              </button>
              <button
                onClick={async () => {
                  try {
                    const result = await invoke<string>('test_database_migration');
                    showJson({ 
                      success: true,
                      result: result.split('\n')
                    });
                  } catch (error) {
                    showJson({ 
                      success: false,
                      error: String(error) 
                    });
                  }
                }}
                className="w-full px-2.5 py-1 bg-green-600/20 hover:bg-green-600/30 text-[11px] font-light rounded transition-all text-left text-green-300"
              >
                🗄️ Test Database Migration
              </button>
            </div>
          )}
        </div>

        {/* State Inspection */}
        <div>
          <button
            onClick={() => setActiveCategory(activeCategory === 'inspect' ? null : 'inspect')}
            className={`w-full px-3 py-1.5 text-[12px] font-light rounded transition-all text-left flex items-center justify-between ${
              activeCategory === 'inspect' ? 'bg-blue-600/20 text-blue-300' : 'bg-white/5 hover:bg-white/10'
            }`}
          >
            <span>🔍 State Inspection</span>
            <span className="text-[10px] opacity-60">{activeCategory === 'inspect' ? '−' : '+'}</span>
          </button>
        
          {activeCategory === 'inspect' && (
            <div className="pl-4 space-y-1 border-l border-gray-700/30 ml-1.5 mt-1">
              <button
                onClick={async () => {
                  try {
                    const truth = await invoke<string>('get_window_state_truth');
                    showJson(truth);
                  } catch (error) {
                    showJson({ error: String(error) });
                  }
                }}
                className="w-full px-2.5 py-1 bg-white/5 hover:bg-white/10 text-[11px] font-light rounded transition-all text-left"
              >
                Window State Truth
              </button>
              <button
                onClick={async () => {
                  try {
                    const logs = await invoke<string>('get_recent_logs', { lines: 50 });
                    showJson(logs);
                  } catch (error) {
                    showJson({ error: String(error) });
                  }
                }}
                className="w-full px-2.5 py-1 bg-white/5 hover:bg-white/10 text-[11px] font-light rounded transition-all text-left"
              >
                Show Recent Logs
              </button>
              <button
                onClick={async () => {
                  try {
                    const windows = await invoke<string[]>('list_all_windows');
                    showJson({ windows });
                  } catch (error) {
                    showJson({ error: String(error) });
                  }
                }}
                className="w-full px-2.5 py-1 bg-white/5 hover:bg-white/10 text-[11px] font-light rounded transition-all text-left"
              >
                List All Windows
              </button>
            </div>
          )}
        </div>
        
        {/* Window Testing */}
        <div>
          <button
            onClick={() => setActiveCategory(activeCategory === 'testing' ? null : 'testing')}
            className={`w-full px-3 py-1.5 text-[12px] font-light rounded transition-all text-left flex items-center justify-between ${
              activeCategory === 'testing' ? 'bg-green-600/20 text-green-300' : 'bg-white/5 hover:bg-white/10'
            }`}
          >
            <span>🧪 Window Testing</span>
            <span className="text-[10px] opacity-60">{activeCategory === 'testing' ? '−' : '+'}</span>
          </button>
          
          {activeCategory === 'testing' && (
            <div className="pl-4 space-y-1 border-l border-gray-700/30 ml-1.5 mt-1">
              <button
                onClick={async () => {
                  console.log('[DEV] Creating test window...');
                  await invoke('create_test_window');
                  await refreshWindows();
                }}
                className="w-full px-2.5 py-1 bg-white/5 hover:bg-white/10 text-[11px] font-light rounded transition-all text-left"
              >
                Create Test Window
              </button>
              <button
                onClick={async () => {
                  console.log('[DEV] Testing window events...');
                  await invoke('test_window_events');
                }}
                className="w-full px-2.5 py-1 bg-white/5 hover:bg-white/10 text-[11px] font-light rounded transition-all text-left"
              >
                Test Window Events
              </button>
              <button
                onClick={async () => {
                  const noteId = prompt('Enter note ID to detach:');
                  if (noteId) {
                    await invoke('force_create_detached_window', { noteId });
                    await refreshWindows();
                  }
                }}
                className="w-full px-2.5 py-1 bg-white/5 hover:bg-white/10 text-[11px] font-light rounded transition-all text-left"
              >
                Force Detach Note
              </button>
            </div>
          )}
        </div>
        
        {/* Cleanup Tools */}
        <div>
          <button
            onClick={() => setActiveCategory(activeCategory === 'cleanup' ? null : 'cleanup')}
            className={`w-full px-3 py-1.5 text-[12px] font-light rounded transition-all text-left flex items-center justify-between ${
              activeCategory === 'cleanup' ? 'bg-orange-600/20 text-orange-300' : 'bg-white/5 hover:bg-white/10'
            }`}
          >
            <span>🧹 Cleanup Tools</span>
            <span className="text-[10px] opacity-60">{activeCategory === 'cleanup' ? '−' : '+'}</span>
          </button>
          
          {activeCategory === 'cleanup' && (
            <div className="pl-4 space-y-1 border-l border-gray-700/30 ml-1.5 mt-1">
              <button
                onClick={async () => {
                  await refreshWindows();
                  console.log('[DEV] State refreshed');
                }}
                className="w-full px-2.5 py-1 bg-white/5 hover:bg-white/10 text-[11px] font-light rounded transition-all text-left"
              >
                Refresh State
              </button>
              <button
                onClick={async () => {
                  const result = await invoke<number>('cleanup_stale_windows');
                  console.log(`[DEV] Cleaned up ${result} stale windows`);
                  await refreshWindows();
                }}
                className="w-full px-2.5 py-1 bg-white/5 hover:bg-white/10 text-[11px] font-light rounded transition-all text-left"
              >
                Cleanup Stale Windows
              </button>
              <button
                onClick={async () => {
                  await invoke('force_close_test_window');
                  await refreshWindows();
                  console.log('[DEV] Test window closed');
                }}
                className="w-full px-2.5 py-1 bg-white/5 hover:bg-white/10 text-[11px] font-light rounded transition-all text-left"
              >
                Close Test Window
              </button>
              <button
                onClick={async () => {
                  if (confirm('Clear all detached windows?')) {
                    const count = await DetachedWindowsAPI.clearAllDetachedWindows();
                    console.log(`[DEV] Cleared ${count} windows`);
                    await refreshWindows();
                  }
                }}
                className="w-full px-2.5 py-1 bg-red-900/20 hover:bg-red-900/40 text-[11px] font-light rounded transition-all text-left text-red-300"
              >
                Clear All Windows
              </button>
            </div>
          )}
        </div>
        </div>
        
        {/* JSON Output Panel */}
        {isExpanded && (
          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-gray-400">JSON Output</span>
              <div className="flex gap-1">
                <button
                  onClick={() => {
                    if (jsonOutput) {
                      navigator.clipboard.writeText(jsonOutput);
                    }
                  }}
                  className="px-2 py-0.5 text-[10px] bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 rounded transition-colors"
                >
                  Copy
                </button>
                <button
                  onClick={() => setJsonOutput('')}
                  className="px-2 py-0.5 text-[10px] bg-gray-700/50 hover:bg-gray-700/70 text-gray-400 rounded transition-colors"
                >
                  Clear
                </button>
              </div>
            </div>
            <textarea
              value={jsonOutput}
              readOnly
              className="flex-1 bg-black/70 text-green-400 font-mono text-[10px] p-2 rounded border border-gray-700/50 resize-none min-h-[300px]"
              onClick={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.select();
              }}
              placeholder="Click a debug button to show output here..."
            />
          </div>
        )}
      </div>
      </div>
      
      {/* Floating DEV button */}
      <button
        onClick={() => {
          if (!isDragging) {
            setIsSpinning(true);
            setIsOpen(!isOpen);
            setTimeout(() => setIsSpinning(false), 150);
          }
        }}
        onMouseDown={handleDrag}
        className={`absolute bottom-0 right-0 w-10 h-10 bg-black/40 hover:bg-black/60 text-white/80 text-[10px] rounded-full font-light transition-all duration-300 flex items-center justify-center pointer-events-auto border border-gray-600/20 shadow-sm hover:shadow-md ${
          isSpinning ? (isOpen ? 'animate-[spin_0.15s_ease-in-out_1_reverse]' : 'animate-[spin_0.15s_ease-in-out_1]') : ''
        } ${!isOpen ? 'cursor-move' : 'cursor-pointer'}`}
        title={!isOpen ? 'Drag to reposition' : 'Click to close'}
      >
        DEV
      </button>
    </div>
  );
}