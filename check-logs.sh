#!/bin/bash

echo "Checking Notes App logs in Console.app..."
echo "=================================="
echo ""

# Show recent logs from Console with our custom logger format
echo "Recent shortcut-related logs:"
log show --predicate 'process == "notes-app" OR process == "Notes App"' --last 5m | grep -E "\[NOTES-APP\].*SHORTCUT|shortcut|Shortcut|register|Register"

echo ""
echo "=================================="
echo "Recent event-related logs:"
log show --predicate 'process == "notes-app" OR process == "Notes App"' --last 5m | grep -E "\[NOTES-APP\].*(menu-new-note|EVENT|HANDLER)"

echo ""
echo "=================================="
echo "To see live logs, run:"
echo "log stream --predicate 'process == \"notes-app\" OR process == \"Notes App\"' | grep '\[NOTES-APP\]'"
echo ""
echo "Or for all logs:"
echo "log stream --predicate 'process == \"notes-app\" OR process == \"Notes App\"'"
echo ""
echo "Or open Console.app and search for 'notes-app'"