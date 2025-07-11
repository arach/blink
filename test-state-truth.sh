#\!/bin/bash
echo "Testing Window State Truth command..."
echo ""

# Use osascript to run JavaScript in the Blink app
osascript -l JavaScript << 'EOJS'
var app = Application("Blink");
app.includeStandardAdditions = true;

// Wait a moment for the app to be ready
delay(1);

// Try to activate the app
app.activate();

ObjC.import('Cocoa');

// Get the main window
var windows = $.NSApplication.sharedApplication.windows;
var mainWindow = null;

for (var i = 0; i < windows.count; i++) {
    var window = windows.objectAtIndex(i);
    if (window.title.js == "Blink") {
        mainWindow = window;
        break;
    }
}

if (mainWindow) {
    "Found Blink main window";
} else {
    "Could not find Blink main window";
}
EOJS

echo ""
echo "To test the Window State Truth feature:"
echo "1. Open Blink's dev toolbar (DEV button in bottom right)"
echo "2. Click 'Window State Truth' button"
echo "3. Check the console and alert for output"
echo ""
echo "Or run this in the browser console:"
echo "await window.__TAURI__.invoke('get_window_state_truth')"
