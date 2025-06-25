#!/bin/bash

echo "Checking Blink logs in Console.app..."
echo "=================================="
echo ""

# Show recent logs from Console with our custom logger format
echo "Recent shortcut-related logs:"
log show --predicate 'process == "blink" OR process == "Blink"' --last 5m | grep -E "\[BLINK\].*SHORTCUT|shortcut|Shortcut|register|Register"

echo ""
echo "=================================="
echo "Recent event-related logs:"
log show --predicate 'process == "blink" OR process == "Blink"' --last 5m | grep -E "\[BLINK\].*(menu-new-note|EVENT|HANDLER)"

echo ""
echo "=================================="
echo "To see live logs, run:"
echo "log stream --predicate 'process == \"blink\" OR process == \"Blink\"' | grep '\[BLINK\]'"
echo ""
echo "Or for all logs:"
echo "log stream --predicate 'process == \"blink\" OR process == \"Blink\"'"
echo ""
echo "Or open Console.app and search for 'blink'"