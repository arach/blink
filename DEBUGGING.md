# Notes App - Debugging Guide

## Logging System

The Notes App includes a comprehensive logging system to help debug issues, especially with global shortcuts.

### Log Format
All logs follow this format:
```
[NOTES-APP] [timestamp] [level] [category] message
```

Example:
```
[NOTES-APP] [2024-01-08 14:23:45.123] [INFO] [SHORTCUT] ✅ Successfully registered global shortcut: Cmd+Ctrl+Alt+Shift+N
```

### Log Categories
- **STARTUP**: App initialization and setup
- **SHORTCUT**: Global shortcut registration/unregistration
- **SHORTCUT-HANDLER**: When shortcuts are triggered
- **MENU**: Menu item events
- **CONFIG**: Configuration loading/saving
- **STORAGE**: Data directory operations
- **TEST**: Test event emissions
- **FRONTEND**: JavaScript/React events

## Debugging Tools

### 1. Quick Log Check
```bash
./check-logs.sh
```
Shows recent shortcut and event-related logs from the last 5 minutes.

### 2. Live Debug Monitor
```bash
./debug-shortcuts.sh
```
- Checks if Notes App is running
- Verifies accessibility permissions
- Shows color-coded live logs
- Filters for [NOTES-APP] entries

### 3. Manual Log Viewing

#### Console.app
1. Open `/Applications/Utilities/Console.app`
2. Search for: `notes-app` or `Notes App`
3. Look for entries starting with `[NOTES-APP]`

#### Terminal (Live Stream)
```bash
# All Notes App logs
log stream --predicate 'process == "notes-app" OR process == "Notes App"'

# Only custom logs
log stream --predicate 'process == "notes-app" OR process == "Notes App"' | grep '\[NOTES-APP\]'

# Only shortcut-related logs
log stream --predicate 'process == "notes-app" OR process == "Notes App"' | grep -E "\[NOTES-APP\].*(SHORTCUT|menu-new-note)"
```

## Testing Global Shortcuts

### In Development Mode
1. Start the app:
   ```bash
   npm run tauri:dev
   ```

2. In another terminal, run:
   ```bash
   ./debug-shortcuts.sh
   ```

3. Test shortcuts:
   - **Cmd+N**: Standard new note
   - **Cmd+Shift+N**: Alternative new note (test shortcut)
   - **Hyper+N** (⌘⌃⌥⇧N): Global new note
   - **Hyper+H** (⌘⌃⌥⇧H): Toggle hover mode for all detached windows

### Test Button
1. Open Settings (⌘,)
2. Go to Shortcuts section
3. Click "test event" to manually trigger a new note event

## Expected Log Flow

When Hyper+N is pressed successfully:
```
[NOTES-APP] [timestamp] [INFO] [SHORTCUT-HANDLER] 🎯 Global shortcut handler invoked
[NOTES-APP] [timestamp] [INFO] [SHORTCUT-HANDLER] 🔥 HYPERKEY+N TRIGGERED! Creating new note...
[NOTES-APP] [timestamp] [INFO] [SHORTCUT-HANDLER] ✅ Successfully emitted menu-new-note event
[NOTES-APP] [timestamp] [INFO] [FRONTEND] 🔥 Received menu-new-note event!
[NOTES-APP] [timestamp] [INFO] [FRONTEND] ✅ New note created: [note-id]
```

When Hyper+H is pressed successfully:
```
[NOTES-APP] [timestamp] [INFO] [SHORTCUT-HANDLER] 🎯 Global shortcut handler invoked
[NOTES-APP] [timestamp] [INFO] [SHORTCUT-HANDLER] 🔥 HYPERKEY+H TRIGGERED! Toggling hover mode...
[NOTES-APP] [timestamp] [INFO] [SHORTCUT-HANDLER] ✅ Successfully emitted toggle-hover-mode event
[NOTES-APP] [timestamp] [INFO] [FRONTEND] 🔥 Received toggle-hover-mode event!
[NOTES-APP] [timestamp] [INFO] [HOVER] Toggling hover mode for all detached windows...
[NOTES-APP] [timestamp] [INFO] [HOVER] Setting all windows to hover=true/false
```

## Common Issues

### Shortcut Not Working
1. Check if shortcut was registered:
   ```
   [NOTES-APP] [timestamp] [INFO] [STARTUP] ✅ Successfully registered global shortcut: Cmd+Ctrl+Alt+Shift+N
   ```

2. If registration failed:
   ```
   [NOTES-APP] [timestamp] [ERROR] [STARTUP] ❌ Failed to register global shortcut: [error]
   ```

3. Grant accessibility permissions:
   - System Settings → Privacy & Security → Accessibility
   - Add Terminal.app (for dev) or Notes App.app (for production)

### Re-registering Shortcuts
1. Open Settings → Shortcuts
2. Click "re-register shortcuts"
3. Check logs for registration status

## Production App Debugging

For the bundled app:
```bash
# Run from terminal to see logs
/Applications/Notes\ App.app/Contents/MacOS/Notes\ App

# Or check system logs
log show --predicate 'process == "Notes App"' --last 10m
```