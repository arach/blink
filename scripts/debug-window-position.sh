#!/bin/bash

# Debug window positioning on macOS
echo "🔍 Debugging Blink window position..."

# Get screen information
echo "📺 Screen Information:"
system_profiler SPDisplaysDataType | grep -E "(Resolution|Built-In|External)"

# Check for Blink processes
echo ""
echo "🔍 Blink Processes:"
ps aux | grep -i blink | grep -v grep

# Check window list for Blink
echo ""
echo "🪟 macOS Window List (Blink):"
# This requires accessibility permissions
osascript -e '
tell application "System Events"
    set windowList to {}
    repeat with proc in (processes whose name contains "Blink" or name contains "blink")
        repeat with win in windows of proc
            set end of windowList to {name of proc, name of win, position of win, size of win}
        end repeat
    end repeat
    return windowList
end tell
' 2>/dev/null || echo "⚠️  Accessibility permissions needed for window detection"

# Alternative window detection
echo ""
echo "🔍 Alternative Window Detection:"
osascript -e 'tell application "System Events" to get name of every process whose visible is true' | tr ',' '\n' | grep -i blink || echo "No visible Blink processes found"

echo ""
echo "💡 Suggested Actions:"
echo "1. Try the 'force visible' button in Settings"  
echo "2. Check if window is minimized in Dock"
echo "3. Use Cmd+Tab to cycle through applications"
echo "4. Use Mission Control to see all windows"
echo "5. Check if window is on another Desktop/Space"