import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { DetachedWindowsAPI } from '../../services/detached-windows-api';
import { useDetachedWindowsStore } from '../../stores/detached-windows-store';

export function DevToolbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
  const { refreshWindows } = useDetachedWindowsStore();

  const runCommand = async (command: string, fn: () => Promise<void>) => {
    try {
      console.log(`[DEV] Running ${command}...`);
      await fn();
      console.log(`[DEV] ${command} completed`);
    } catch (error) {
      console.error(`[DEV] ${command} failed:`, error);
    }
  };

  return (
    <div className={`fixed bottom-2 right-2 z-50 ${!isOpen ? 'pointer-events-none' : ''}`}>
      {/* Toolbar panel */}
      <div className={`bg-black/80 text-white p-4 rounded-xl border border-gray-600 backdrop-blur-sm transition-all duration-300 ${
        isOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
      }`}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-mono text-white">Dev Toolbar</h3>
          <button
            onClick={() => setIsOpen(false)}
            className="text-gray-400 hover:text-white text-xs"
          >
            ×
          </button>
        </div>
      
      <div className="space-y-2">
        <button
          onClick={() => runCommand('Restore Windows', async () => {
            const restored = await DetachedWindowsAPI.restoreDetachedWindows();
            console.log('Restored:', restored);
          })}
          className="w-full px-2 py-1 bg-green-600/80 hover:bg-green-600 text-xs rounded-sm font-mono transition-all border border-green-400/30"
        >
          Restore Windows
        </button>
        
        <button
          onClick={() => runCommand('Refresh Windows', async () => {
            await refreshWindows();
          })}
          className="w-full px-2 py-1 bg-blue-600/80 hover:bg-blue-600 text-xs rounded-sm font-mono transition-all border border-blue-400/30"
        >
          Refresh Windows
        </button>
        
        <button
          onClick={() => runCommand('Test Window Creation', async () => {
            await invoke('test_window_creation');
          })}
          className="w-full px-2 py-1 bg-purple-600/80 hover:bg-purple-600 text-xs rounded-sm font-mono transition-all border border-purple-400/30"
        >
          Test Window Creation
        </button>
        
        <button
          onClick={() => runCommand('Test Detached Window', async () => {
            const result = await invoke<string>('test_detached_window_creation');
            console.log('Test detached window result:', result);
          })}
          className="w-full px-2 py-1 bg-violet-600/80 hover:bg-violet-600 text-xs rounded-sm font-mono transition-all border border-violet-400/30"
        >
          Test Detached Window
        </button>
        
        <button
          onClick={() => runCommand('Force Close Test Window', async () => {
            const result = await invoke<string>('force_close_test_window');
            console.log('Force close result:', result);
            console.log('=== FORCE CLOSE RESULT ===\n' + result);
            await refreshWindows();
          })}
          className="w-full px-2 py-1 bg-red-600/80 hover:bg-red-600 text-xs rounded-sm font-mono transition-all border border-red-400/30"
        >
          Force Close Test Window
        </button>
        
        <button
          onClick={() => runCommand('Cleanup Stale Hybrid Windows', async () => {
            const result = await invoke<string>('cleanup_stale_hybrid_windows');
            console.log('Cleanup result:', result);
            console.log('=== CLEANUP RESULT ===\n' + result);
            await refreshWindows();
          })}
          className="w-full px-2 py-1 bg-orange-600/80 hover:bg-orange-600 text-xs rounded-sm font-mono transition-all border border-orange-400/30"
        >
          Cleanup Stale Hybrids
        </button>
        
        <button
          onClick={() => runCommand('Debug Window State', async () => {
            const state = await invoke<string>('debug_webview_state');
            console.log('Window state:', state);
          })}
          className="w-full px-2 py-1 bg-yellow-600/80 hover:bg-yellow-600 text-xs rounded-sm font-mono transition-all border border-yellow-400/30"
        >
          Debug Window State
        </button>
        
        <button
          onClick={() => runCommand('Debug ALL Windows', async () => {
            const state = await invoke<string>('debug_all_windows_state');
            console.log('All windows state:', state);
          })}
          className="w-full px-2 py-1 bg-cyan-600/80 hover:bg-cyan-600 text-xs rounded-sm font-mono transition-all border border-cyan-400/30"
        >
          Debug ALL Windows
        </button>
        
        <button
          onClick={() => runCommand('Force All Opaque', async () => {
            const result = await invoke<string>('force_all_windows_opaque');
            console.log('Force opaque result:', result);
          })}
          className="w-full px-2 py-1 bg-pink-600/80 hover:bg-pink-600 text-xs rounded-sm font-mono transition-all border border-pink-400/30"
        >
          Force All Opaque
        </button>
        
        <button
          onClick={() => runCommand('Gather Windows to Current Space', async () => {
            const result = await invoke<string>('gather_all_windows_to_main_screen');
            console.log('Gather windows result:', result);
          })}
          className="w-full px-2 py-1 bg-indigo-600/80 hover:bg-indigo-600 text-xs rounded-sm font-mono transition-all border border-indigo-400/30"
        >
          Gather to Current Space
        </button>
        
        <button
          onClick={() => runCommand('Recreate Missing Windows', async () => {
            const result = await invoke<string>('recreate_missing_windows');
            console.log('Recreate missing windows result:', result);
          })}
          className="w-full px-2 py-1 bg-emerald-600/80 hover:bg-emerald-600 text-xs rounded-sm font-mono transition-all border border-emerald-400/30"
        >
          Recreate Missing Windows
        </button>
        
        <button
          onClick={() => runCommand('Force Main Visible', async () => {
            await invoke('force_main_window_visible');
          })}
          className="w-full px-2 py-1 bg-orange-600/80 hover:bg-orange-600 text-xs rounded-sm font-mono transition-all border border-orange-400/30"
        >
          Force Main Visible
        </button>
        
        <button
          onClick={() => runCommand('Clear All Windows', async () => {
            if (confirm('Clear all detached windows? This will close all windows and clear state.')) {
              const count = await DetachedWindowsAPI.clearAllDetachedWindows();
              console.log(`Cleared ${count} windows`);
              await refreshWindows();
            }
          })}
          className="w-full px-2 py-1 bg-red-600/80 hover:bg-red-600 text-xs rounded-sm font-mono transition-all border border-red-400/30"
        >
          Clear All Windows
        </button>
        
        <button
          onClick={() => runCommand('Show Log File Path', async () => {
            const logPath = await invoke<string>('get_log_file_path');
            console.log('Log file location:', logPath);
            alert(`Log file location:\n${logPath}`);
          })}
          className="w-full px-2 py-1 bg-amber-600/80 hover:bg-amber-600 text-xs rounded-sm font-mono transition-all border border-amber-400/30"
        >
          Show Log File Path
        </button>
        
        <button
          onClick={() => runCommand('Show Recent Logs', async () => {
            const logs = await invoke<string>('get_recent_logs', { lines: 50 });
            console.log('Recent logs (last 50 lines):', logs);
          })}
          className="w-full px-2 py-1 bg-teal-600/80 hover:bg-teal-600 text-xs rounded-sm font-mono transition-all border border-teal-400/30"
        >
          Show Recent Logs
        </button>
        
        <button
          onClick={() => runCommand('Window State Truth', async () => {
            const truth = await invoke<string>('get_window_state_truth');
            console.log('=== WINDOW STATE TRUTH ===');
            console.log(truth);
          })}
          className="w-full px-2 py-1 bg-fuchsia-600/80 hover:bg-fuchsia-600 text-xs rounded-sm font-mono transition-all border border-fuchsia-400/30"
        >
          Window State Truth
        </button>
        </div>
      </div>
      
      {/* Floating DEV button */}
      <button
        onClick={() => {
          setIsSpinning(true);
          setIsOpen(!isOpen);
          setTimeout(() => setIsSpinning(false), 150);
        }}
        className={`absolute bottom-0 right-0 w-12 h-12 bg-black/60 hover:bg-black/80 text-white text-xs rounded-full font-mono transition-all duration-300 flex items-center justify-center pointer-events-auto ${
          isSpinning ? (isOpen ? 'animate-[spin_0.15s_ease-in-out_1_reverse]' : 'animate-[spin_0.15s_ease-in-out_1]') : ''
        }`}
      >
        DEV
      </button>
    </div>
  );
}