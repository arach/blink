import { invoke } from '@tauri-apps/api/core';

function App() {
  const handleOpacityChange = async (opacity: number) => {
    try {
      console.log('Attempting to set opacity to:', opacity);
      
      // Use invoke to call Rust commands instead
      await invoke('set_window_opacity', { opacity });
      console.log('Opacity set successfully to:', opacity);
      
      // Update the display manually
      const display = document.getElementById('opacity-display');
      if (display) {
        display.textContent = Math.round(opacity * 100) + '%';
      }
      
    } catch (error) {
      console.error('Failed to set opacity:', error);
      console.error('Error details:', error.message);
      console.error('Error stack:', error.stack);
    }
  };

  let isAlwaysOnTop = false;
  
  const handleAlwaysOnTopToggle = async () => {
    try {
      isAlwaysOnTop = !isAlwaysOnTop;
      await invoke('set_window_always_on_top', { alwaysOnTop: isAlwaysOnTop });
      
      // Update button text manually
      const button = document.getElementById('pin-button');
      if (button) {
        button.textContent = isAlwaysOnTop ? '📌 Unpin' : '📌 Pin';
      }
      
      console.log('Always on top:', isAlwaysOnTop);
    } catch (error) {
      console.error('Failed to toggle always on top:', error);
    }
  };

  return (
    <div style={{ 
      width: '100vw', 
      height: '100vh', 
      backgroundColor: 'white',
      display: 'flex'
    }}>
      {/* Sidebar */}
      <div style={{ 
        width: '250px', 
        backgroundColor: '#f3f4f6', 
        padding: '20px',
        borderRight: '1px solid #e5e7eb'
      }}>
        <h2 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: 'bold' }}>
          Notes
        </h2>
        <div style={{ color: '#6b7280' }}>
          No notes yet...
        </div>
      </div>
      
      {/* Main content */}
      <div style={{ 
        flex: 1, 
        padding: '20px',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <h1 style={{ margin: '0 0 20px 0', fontSize: '24px', fontWeight: 'bold' }}>
          Tauri Notes App
        </h1>
        
        {/* Transparency Controls */}
        <div style={{ 
          backgroundColor: '#f3f4f6', 
          padding: '15px', 
          borderRadius: '8px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '15px'
        }}>
          <span style={{ fontSize: '14px', fontWeight: '500' }}>Opacity:</span>
          
          <input 
            type="range"
            min="0.1"
            max="1.0"
            step="0.1"
            defaultValue="1.0"
            style={{ flex: 1, maxWidth: '150px' }}
            onChange={(e) => handleOpacityChange(parseFloat(e.target.value))}
          />
          
          <span id="opacity-display" style={{ fontSize: '14px', minWidth: '40px' }}>
            100%
          </span>
          
          <button 
            id="pin-button"
            style={{ 
              padding: '8px 12px',
              fontSize: '14px',
              borderRadius: '6px',
              border: '1px solid #d1d5db',
              backgroundColor: 'white',
              cursor: 'pointer'
            }}
            onClick={handleAlwaysOnTopToggle}
          >
            📌 Pin
          </button>
        </div>
        
        {/* Empty state */}
        <div style={{ 
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#6b7280'
        }}>
          Select a note to start editing, or create a new one.
        </div>
      </div>
    </div>
  );
}

export default App;