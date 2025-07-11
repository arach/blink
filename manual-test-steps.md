# Manual Test Steps for Window Lifecycle

## Test 1: Close the Test Window

1. **Find the test window** - Look for the window titled "Test Note Window - test-note-12345"
2. **Close it** - Click the close button or press ⌘W while focused on it
3. **Check the browser console** - You should see:
   ```
   [BLINK] Window destroyed event received for note: test-note-12345
   [BLINK] Backend state cleaned up for destroyed window
   ```
4. **Open Dev Toolbar → Window State Truth** - The window should be gone from both sections

## Test 2: Create and Close a Real Note Window

1. **Create a note window** - Drag any note from the sidebar out to create a detached window
2. **Check Window State Truth** - You should see the new window in both sections
3. **Close the detached window** - Click close or press ⌘W
4. **Check console** - You should see the destroyed event
5. **Check Window State Truth again** - Window should be gone

## What Success Looks Like

✅ Console shows "Window destroyed event received"
✅ Console shows "Backend state cleaned up"
✅ Window State Truth shows no orphaned windows
✅ No discrepancies between Tauri and backend state

## Current Status

From your last message, I can see:
- The test window (`note-test-note-12345`) exists in both Tauri and backend state ✅
- No discrepancies ✅
- The window lifecycle tracking is ready to test!

Please close the test window and let me know what you see in the console!