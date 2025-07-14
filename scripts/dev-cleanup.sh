#!/bin/bash

# Blink Development Cleanup Script
# This script safely kills only Blink-related processes using multiple identification methods

echo "🧹 Cleaning up Blink development processes..."

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PIDS_DIR="$PROJECT_DIR/.dev-pids"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo_color() {
    local color=$1
    shift
    echo -e "${color}$*${NC}"
}

# Function to kill processes by pattern with better identification
kill_by_pattern() {
    local pattern="$1"
    local description="$2"
    
    echo_color $BLUE "Looking for $description..."
    pids=$(pgrep -f "$pattern" 2>/dev/null || true)
    
    if [ -n "$pids" ]; then
        echo_color $YELLOW "Found $description processes: $pids"
        
        # Show what we're about to kill
        echo "$pids" | while read pid; do
            if [ -n "$pid" ]; then
                cmd=$(ps -p "$pid" -o args= 2>/dev/null || echo "unknown")
                echo_color $YELLOW "  PID $pid: $cmd"
            fi
        done
        
        echo "$pids" | xargs kill -TERM 2>/dev/null || true
        sleep 2
        
        # Force kill if still running
        remaining=$(pgrep -f "$pattern" 2>/dev/null || true)
        if [ -n "$remaining" ]; then
            echo_color $RED "Force killing remaining processes: $remaining"
            echo "$remaining" | xargs kill -9 2>/dev/null || true
        fi
        echo_color $GREEN "✅ Cleaned up $description"
    else
        echo_color $BLUE "No $description processes found"
    fi
}

# Clean up named processes first
if [ -d "$PIDS_DIR" ]; then
    echo_color $BLUE "🔍 Cleaning up named processes..."
    
    for pid_file in "$PIDS_DIR"/*.pid; do
        if [ -f "$pid_file" ]; then
            process_name=$(basename "$pid_file" .pid)
            pid=$(cat "$pid_file")
            
            if kill -0 "$pid" 2>/dev/null; then
                echo_color $YELLOW "Stopping named process: $process_name (PID: $pid)"
                kill -TERM "$pid" 2>/dev/null || true
                sleep 1
                
                if kill -0 "$pid" 2>/dev/null; then
                    echo_color $RED "Force killing $process_name (PID: $pid)"
                    kill -9 "$pid" 2>/dev/null || true
                fi
            fi
            
            rm -f "$pid_file"
        fi
    done
    
    # Clean up log files older than 1 day
    find "$PIDS_DIR" -name "*.log" -mtime +1 -delete 2>/dev/null || true
fi

# Kill processes by environment variable
echo_color $BLUE "🔍 Looking for Blink processes by environment..."
kill_by_pattern "BLINK_PROCESS_NAME=" "Blink named processes"

# Kill Blink-specific processes by binary name
kill_by_pattern "target/debug/blink" "Blink debug binary"
kill_by_pattern "tauri.*blink" "Tauri Blink processes"

# Kill Vite dev server only for this project
cd "$PROJECT_DIR" 2>/dev/null
if [ -f "package.json" ] && grep -q '"name": "blink"' package.json; then
    echo_color $BLUE "🔍 Looking for Vite dev server for Blink project..."
    vite_pid=$(lsof -ti:5173 2>/dev/null | head -1)
    if [ -n "$vite_pid" ]; then
        # Verify it's actually a node/vite process and in our project directory
        cmd=$(ps -p "$vite_pid" -o args= 2>/dev/null || echo "")
        if echo "$cmd" | grep -q "vite" && echo "$cmd" | grep -q "node"; then
            echo_color $YELLOW "Found Vite dev server on port 5173: $vite_pid"
            echo_color $YELLOW "  Command: $cmd"
            kill -TERM "$vite_pid" 2>/dev/null || true
            sleep 1
            if kill -0 "$vite_pid" 2>/dev/null; then
                kill -9 "$vite_pid" 2>/dev/null || true
            fi
            echo_color $GREEN "✅ Cleaned up Vite dev server"
        else
            echo_color $YELLOW "Process on port 5173 is not Vite: $cmd"
        fi
    else
        echo_color $BLUE "No process found on port 5173"
    fi
fi

echo_color $GREEN "🎉 Cleanup complete!"