# Testing Window Lifecycle Tracking

This document explains how to test the window lifecycle event tracking implementation in Blink.

## What's Been Implemented

1. **Backend Window Lifecycle Tracking**
   - `create_detached_window` now sets up event listeners for window destruction
   - When a window is destroyed (closed by user or OS), it:
     - Removes the window from backend state
     - Saves the updated state to disk
     - Emits a `window-destroyed` event to frontend with the note ID

2. **Frontend Event Listeners**
   - App.tsx now listens for `window-destroyed` events
   - When received, it refreshes the window list to sync with backend
   - Also listens for `hybrid-window-destroyed` events for drag windows

3. **Window State Truth Command**
   - New command `get_window_state_truth` provides complete visibility into:
     - All Tauri windows and their properties
     - All backend state entries
     - Discrepancies between Tauri and backend state
   - Accessible via Dev Toolbar "Window State Truth" button

## How to Test

### 1. Check Initial State
```javascript
// In browser console of main window
await window.__TAURI__.invoke('get_window_state_truth')
```

### 2. Create a Detached Window
- Drag a note from the sidebar out to create a detached window
- Or right-click a note and select "Open in New Window"
- Or use the command palette (⌘K) and search for a note to open

### 3. Verify Window is Tracked
```javascript
// Check state again - should show the new window
await window.__TAURI__.invoke('get_window_state_truth')
```

### 4. Close the Detached Window
- Click the close button on the detached window
- Or press ⌘W in the detached window

### 5. Verify Cleanup
```javascript
// Check state again - window should be removed
await window.__TAURI__.invoke('get_window_state_truth')
```

## Expected Behavior

- When a window is closed, you should see in the console:
  - `[BLINK] Window destroyed event received for note: <note-id>`
  - `[BLINK] Windows after destroy cleanup: [...]`

- The Window State Truth output should show:
  - Before closing: Window exists in both Tauri and backend state
  - After closing: Window removed from both Tauri and backend state

## Using the Dev Toolbar

1. Click the "DEV" button in the bottom right of the main window
2. Click "Window State Truth" to see current state
3. An alert will show the complete state information
4. Check the console for formatted output

## Debugging Tips

- If windows appear "orphaned" in state, use "Clear All Windows" in dev toolbar
- Use "Refresh Windows" to force sync between frontend and backend
- Check logs at `~/Library/Application Support/com.blink.dev/logs/blink.log`