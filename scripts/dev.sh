#!/bin/bash

# Blink Development Helper Script
# Safely manages development lifecycle

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo_color() {
    local color=$1
    shift
    echo -e "${color}$*${NC}"
}

# Function to check if port is in use
port_in_use() {
    local port=$1
    lsof -ti:$port >/dev/null 2>&1
}

# Function to check if process is running
process_running() {
    local pattern=$1
    pgrep -f "$pattern" >/dev/null 2>&1
}

# Function to wait for port to be free
wait_for_port_free() {
    local port=$1
    local timeout=${2:-10}
    local count=0
    
    while port_in_use $port && [ $count -lt $timeout ]; do
        echo_color $YELLOW "Waiting for port $port to be free... ($count/$timeout)"
        sleep 1
        ((count++))
    done
    
    if port_in_use $port; then
        echo_color $RED "Port $port is still in use after ${timeout}s"
        return 1
    fi
}

# Command handlers
cmd_clean() {
    echo_color $BLUE "🧹 Cleaning up development processes..."
    "$SCRIPT_DIR/dev-cleanup.sh"
}

cmd_start() {
    echo_color $BLUE "🚀 Starting Blink development server..."
    
    # Clean up first
    cmd_clean
    
    # Wait for ports to be free
    if ! wait_for_port_free 1420 5; then
        echo_color $RED "Port 1420 still in use. Try running: $0 clean"
        exit 1
    fi
    
    # Start development server
    echo_color $GREEN "Starting Tauri development server..."
    pnpm run tauri:dev
}

cmd_restart() {
    echo_color $BLUE "🔄 Restarting Blink development server..."
    cmd_clean
    sleep 2
    cmd_start
}

cmd_status() {
    echo_color $BLUE "📊 Development Status:"
    
    echo -n "Port 1420 (Vite): "
    if port_in_use 1420; then
        echo_color $GREEN "IN USE"
    else
        echo_color $RED "FREE"
    fi
    
    echo -n "Blink binary: "
    if process_running "target/debug/blink"; then
        echo_color $GREEN "RUNNING"
    else
        echo_color $RED "NOT RUNNING"
    fi
    
    echo -n "Tauri processes: "
    if process_running "tauri.*blink"; then
        echo_color $GREEN "RUNNING"
    else
        echo_color $RED "NOT RUNNING"
    fi
}

cmd_logs() {
    echo_color $BLUE "📜 Showing recent Blink logs..."
    # Look for common log locations
    if [ -f "/tmp/blink.log" ]; then
        tail -f "/tmp/blink.log"
    else
        echo_color $YELLOW "No log file found. Logs should appear in terminal during development."
    fi
}

# Main command dispatcher
case "${1:-start}" in
    "clean")
        cmd_clean
        ;;
    "start")
        cmd_start
        ;;
    "restart")
        cmd_restart
        ;;
    "status")
        cmd_status
        ;;
    "logs")
        cmd_logs
        ;;
    "help"|"-h"|"--help")
        echo_color $BLUE "Blink Development Helper"
        echo ""
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  start    - Start development server (default)"
        echo "  restart  - Clean and restart development server"
        echo "  clean    - Clean up development processes"
        echo "  status   - Show development status"
        echo "  logs     - Show development logs"
        echo "  help     - Show this help"
        ;;
    *)
        echo_color $RED "Unknown command: $1"
        echo "Run '$0 help' for available commands"
        exit 1
        ;;
esac