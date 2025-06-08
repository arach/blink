#!/bin/bash

echo "🔍 Notes App Shortcut Debugging Tool"
echo "===================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if the app is running
echo -e "${BLUE}1. Checking if Notes App is running...${NC}"
if pgrep -f "Notes App" > /dev/null; then
    echo -e "${GREEN}✓ Notes App is running${NC}"
else
    echo -e "${RED}✗ Notes App is not running${NC}"
    echo "  Please start the app first: npm run tauri:dev"
fi

echo ""
echo -e "${BLUE}2. Checking accessibility permissions...${NC}"
# Check if Terminal has accessibility permissions
if sqlite3 "/Library/Application Support/com.apple.TCC/TCC.db" "SELECT client FROM access WHERE service='kTCCServiceAccessibility'" 2>/dev/null | grep -q "Terminal"; then
    echo -e "${GREEN}✓ Terminal has accessibility permissions${NC}"
else
    echo -e "${YELLOW}⚠ Terminal may not have accessibility permissions${NC}"
    echo "  Grant permissions in System Settings > Privacy & Security > Accessibility"
fi

echo ""
echo -e "${BLUE}3. Live log monitoring (Press Ctrl+C to stop)${NC}"
echo "Filtering for [NOTES-APP] logs..."
echo "=================================="

# Start live log streaming with our custom format
log stream --predicate 'process == "notes-app" OR process == "Notes App"' --style compact | while read line; do
    if echo "$line" | grep -q "\[NOTES-APP\]"; then
        # Color code based on log level
        if echo "$line" | grep -q "ERROR"; then
            echo -e "${RED}$line${NC}"
        elif echo "$line" | grep -q "INFO.*✅"; then
            echo -e "${GREEN}$line${NC}"
        elif echo "$line" | grep -q "INFO.*🔥"; then
            echo -e "${YELLOW}$line${NC}"
        elif echo "$line" | grep -q "SHORTCUT"; then
            echo -e "${BLUE}$line${NC}"
        else
            echo "$line"
        fi
    fi
done