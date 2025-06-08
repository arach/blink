# Window Creation Debug Guide

## Changes Made for Debugging

### 1. Enhanced Rust Backend Logging

Added comprehensive logging to `create_detached_window` function in `src-tauri/src/lib.rs`:
- Logs when window creation starts with all parameters
- Logs each step of the process (note validation, window state checks, etc.)
- Logs any errors with detailed messages
- Added cleanup for drag ghost window before creating new windows

### 2. Simplified Window Configuration (Temporary)

Modified window creation to use simpler settings for debugging:
- Enabled window decorations (`decorations: true`)
- Disabled transparency (`transparent: false`)
- Explicitly set `visible: true`
- Added explicit `window.show()` call after creation

### 3. Enhanced Tauri Permissions

Updated `tauri.conf.json` to include additional permissions:
- Added `core:window:allow-create` to main window capability
- Added `core:webview:allow-create-webview` 
- Enhanced note window capability with more permissions
- Added drag ghost window capability
- Added test window capability

### 4. Test Commands

Added test commands to isolate the issue:
- `test_window_creation`: Creates a simple test window
- Frontend helpers available in console:
  - `window.testWindowCreation()` - Tests basic window creation
  - `window.testDetachedWindow(noteId?)` - Tests detached note window creation

## How to Debug

1. **Run the app with console output visible**:
   ```bash
   npm run tauri:dev
   ```

2. **Open browser developer console** (right-click → Inspect Element)

3. **Try different window creation methods**:
   - Double-click a note in the sidebar
   - Run `window.testWindowCreation()` in console
   - Run `window.testDetachedWindow()` in console (with a note selected)

4. **Check the terminal output** for detailed logs starting with:
   - `[CREATE_DETACHED_WINDOW]` - Main window creation flow
   - `[TEST_WINDOW]` - Test window creation
   - `[DETACHED-WINDOWS]` - Frontend store logs

## Common Issues to Check

1. **Permission Errors**: Look for "Failed to create window" with permission-related errors
2. **Window Already Exists**: Check if the window label already exists
3. **Invalid Parameters**: Verify position/size values are valid numbers
4. **Note Not Found**: Ensure the note ID exists before creating window

## Next Steps

Once we identify the specific error:
1. Re-enable transparency and remove decorations if those weren't the issue
2. Remove excessive logging once the problem is fixed
3. Remove test commands and helpers

## Rollback Changes

To restore original window configuration, change in `lib.rs`:
```rust
.decorations(false)  // Was true for debugging
.transparent(true)   // Was false for debugging
```