import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { DetachedWindowsAPI } from '../../services/detached-windows-api';
import { useDetachedWindowsStore } from '../../stores/detached-windows-store';

export function DevToolbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [position, setPosition] = useState({ bottom: 8, right: 8 });
  const [isDragging, setIsDragging] = useState(false);
  const { refreshWindows } = useDetachedWindowsStore();

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

  return (
    <div 
      className={`fixed z-50 ${!isOpen ? 'pointer-events-none' : ''}`}
      style={{ bottom: `${position.bottom}px`, right: `${position.right}px` }}
    >
      {/* Toolbar panel */}
      <div className={`bg-black/50 text-white p-3 rounded-lg border border-gray-700/30 backdrop-blur-sm transition-all duration-300 ${
        isOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
      } w-[180px]`}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[11px] font-light text-gray-300 tracking-wide">Dev</h3>
          <button
            onClick={() => setIsOpen(false)}
            className="text-gray-400 hover:text-white text-xs"
          >
            ×
          </button>
        </div>
      
      <div className="space-y-1">
        {/* Primary Categories */}
        <div className="space-y-1">
          <button
            onClick={() => setActiveCategory(activeCategory === 'inspect' ? null : 'inspect')}
            className={`w-full px-2.5 py-1 text-[11px] font-light rounded transition-all text-left flex items-center justify-between ${
              activeCategory === 'inspect' ? 'bg-blue-600/20 text-blue-300' : 'bg-white/5 hover:bg-white/10'
            }`}
          >
            <span>🔍 State Inspection</span>
            <span className="text-[9px] opacity-60">{activeCategory === 'inspect' ? '−' : '+'}</span>
          </button>
          
          <button
            onClick={() => setActiveCategory(activeCategory === 'testing' ? null : 'testing')}
            className={`w-full px-2.5 py-1 text-[11px] font-light rounded transition-all text-left flex items-center justify-between ${
              activeCategory === 'testing' ? 'bg-green-600/20 text-green-300' : 'bg-white/5 hover:bg-white/10'
            }`}
          >
            <span>🧪 Window Testing</span>
            <span className="text-[9px] opacity-60">{activeCategory === 'testing' ? '−' : '+'}</span>
          </button>
          
          <button
            onClick={() => setActiveCategory(activeCategory === 'cleanup' ? null : 'cleanup')}
            className={`w-full px-2.5 py-1 text-[11px] font-light rounded transition-all text-left flex items-center justify-between ${
              activeCategory === 'cleanup' ? 'bg-orange-600/20 text-orange-300' : 'bg-white/5 hover:bg-white/10'
            }`}
          >
            <span>🧹 Cleanup Tools</span>
            <span className="text-[9px] opacity-60">{activeCategory === 'cleanup' ? '−' : '+'}</span>
          </button>
        </div>
        
        {/* Secondary Menu - State Inspection */}
        {activeCategory === 'inspect' && (
          <div className="pl-3 space-y-0.5 border-l border-gray-700/30 ml-1">
            <button
              onClick={async () => {
                const truth = await invoke<string>('get_window_state_truth');
                console.log('\n=== WINDOW STATE TRUTH ===');
                console.log(truth);
                console.log('==========================\n');
              }}
              className="w-full px-2 py-0.5 bg-white/5 hover:bg-white/10 text-[10px] font-light rounded transition-all text-left"
            >
              Window State Truth
            </button>
            <button
              onClick={async () => {
                const logs = await invoke<string>('get_recent_logs', { lines: 50 });
                console.log('\n=== RECENT LOGS ===');
                console.log(logs);
                console.log('==================\n');
              }}
              className="w-full px-2 py-0.5 bg-white/5 hover:bg-white/10 text-[10px] font-light rounded transition-all text-left"
            >
              Show Recent Logs
            </button>
            <button
              onClick={async () => {
                const windows = await invoke<string[]>('list_all_windows');
                console.log('\n=== ALL WINDOWS ===');
                windows.forEach(w => console.log(`  - ${w}`));
                console.log('==================\n');
              }}
              className="w-full px-2 py-0.5 bg-white/5 hover:bg-white/10 text-[10px] font-light rounded transition-all text-left"
            >
              List All Windows
            </button>
          </div>
        )}
        
        {/* Secondary Menu - Window Testing */}
        {activeCategory === 'testing' && (
          <div className="pl-3 space-y-0.5 border-l border-gray-700/30 ml-1">
            <button
              onClick={async () => {
                console.log('[DEV] Creating test window...');
                await invoke('create_test_window');
                await refreshWindows();
              }}
              className="w-full px-2 py-0.5 bg-white/5 hover:bg-white/10 text-[10px] font-light rounded transition-all text-left"
            >
              Create Test Window
            </button>
            <button
              onClick={async () => {
                console.log('[DEV] Testing window events...');
                await invoke('test_window_events');
              }}
              className="w-full px-2 py-0.5 bg-white/5 hover:bg-white/10 text-[10px] font-light rounded transition-all text-left"
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
              className="w-full px-2 py-0.5 bg-white/5 hover:bg-white/10 text-[10px] font-light rounded transition-all text-left"
            >
              Force Detach Note
            </button>
          </div>
        )}
        
        {/* Secondary Menu - Cleanup Tools */}
        {activeCategory === 'cleanup' && (
          <div className="pl-3 space-y-0.5 border-l border-gray-700/30 ml-1">
            <button
              onClick={async () => {
                await refreshWindows();
                console.log('[DEV] State refreshed');
              }}
              className="w-full px-2 py-0.5 bg-white/5 hover:bg-white/10 text-[10px] font-light rounded transition-all text-left"
            >
              Refresh State
            </button>
            <button
              onClick={async () => {
                const result = await invoke<number>('cleanup_stale_windows');
                console.log(`[DEV] Cleaned up ${result} stale windows`);
                await refreshWindows();
              }}
              className="w-full px-2 py-0.5 bg-white/5 hover:bg-white/10 text-[10px] font-light rounded transition-all text-left"
            >
              Cleanup Stale Windows
            </button>
            <button
              onClick={async () => {
                await invoke('force_close_test_window');
                await refreshWindows();
                console.log('[DEV] Test window closed');
              }}
              className="w-full px-2 py-0.5 bg-white/5 hover:bg-white/10 text-[10px] font-light rounded transition-all text-left"
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
              className="w-full px-2 py-0.5 bg-red-900/20 hover:bg-red-900/40 text-[10px] font-light rounded transition-all text-left text-red-300"
            >
              Clear All Windows
            </button>
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