# Testing Window Lifecycle Tracking

## How to Test

1. **Open the Dev Toolbar** - Click the "DEV" button in the bottom right

2. **Check Initial State** - Click "Window State Truth" to see current state

3. **Create a Detached Window**:
   - Drag a note from the sidebar out to create a detached window
   - Or right-click a note and select "Open in New Window"

4. **Verify Window is Tracked** - Click "Window State Truth" again, you should see the new window

5. **Close the Detached Window** - Click the close button or press ⌘W

6. **Verify Cleanup** - Click "Window State Truth" again, the window should be gone from both Tauri and backend state

## Expected Console Output

When closing a window, you should see:
```
[BLINK] Window destroyed event received for note: <note-id>
[BLINK] Backend state cleaned up for destroyed window
[BLINK] Windows after destroy cleanup: [...]
```

## Current Status

✅ App compiles and runs
✅ Window State Truth command works
✅ Window lifecycle events are set up
✅ Frontend listens for window-destroyed events
✅ Backend cleanup command is implemented

The window lifecycle tracking is now fully implemented!