#!/bin/bash

# Blink Named Process Starter
# Starts development processes with meaningful names for easy identification

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

# Get developer-specific configuration with robust fallbacks
DEV_PORT=5173
DEV_PROCESS_PREFIX="blink"
DEVELOPER="dev"

# Try to load developer-specific config, fall back gracefully if it fails
if [ -f "$SCRIPT_DIR/get-dev-port.cjs" ]; then
    if DEV_CONFIG=$(node "$SCRIPT_DIR/get-dev-port.cjs" json 2>/dev/null); then
        if echo "$DEV_CONFIG" | grep -q '"port"'; then
            DEV_PORT=$(echo "$DEV_CONFIG" | node -e "
                try {
                    const config = JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8'));
                    console.log(config.port || 5173);
                } catch (e) {
                    console.log(5173);
                }")
            DEVELOPER=$(echo "$DEV_CONFIG" | node -e "
                try {
                    const config = JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8'));
                    console.log(config.developer || 'dev');
                } catch (e) {
                    console.log('dev');
                }")
        fi
    fi
fi

# Additional fallbacks from environment variables
DEV_PORT=${VITE_PORT:-$DEV_PORT}
DEVELOPER=${BLINK_DEVELOPER:-$DEVELOPER}

echo "🔧 Using configuration for developer: $DEVELOPER"
echo "📡 Vite port: $DEV_PORT"
echo "🏷️  Process prefix: $DEV_PROCESS_PREFIX"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

echo_color() {
    local color=$1
    shift
    echo -e "${color}$*${NC}"
}

# Create process marker files
PIDS_DIR="$PROJECT_DIR/.dev-pids"
mkdir -p "$PIDS_DIR"

# Function to start a named process
start_named_process() {
    local name="$1"
    local command="$2"
    local working_dir="${3:-$PROJECT_DIR}"
    
    echo_color $BLUE "🚀 Starting $name..."
    
    cd "$working_dir"
    
    # Create a wrapper script that sets the process title
    local wrapper_script="$PIDS_DIR/run-$name.sh"
    cat > "$wrapper_script" << EOF
#!/bin/bash
# Set process title to be easily identifiable
export BLINK_PROCESS_NAME="$name"
export BLINK_DEV_SESSION="\$(date +%s)"

# Use exec to replace the shell with the actual process
exec $command
EOF
    
    chmod +x "$wrapper_script"
    
    # Start the process in background with nohup
    nohup "$wrapper_script" > "$PIDS_DIR/$name.log" 2>&1 &
    local pid=$!
    
    # Store the PID
    echo "$pid" > "$PIDS_DIR/$name.pid"
    echo_color $GREEN "✅ Started $name (PID: $pid)"
    
    # Give it a moment to start
    sleep 1
    
    # Check if it's still running
    if kill -0 "$pid" 2>/dev/null; then
        echo_color $GREEN "   $name is running successfully"
    else
        echo_color $RED "   $name failed to start"
        return 1
    fi
}

# Function to stop a named process
stop_named_process() {
    local name="$1"
    local pid_file="$PIDS_DIR/$name.pid"
    
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if kill -0 "$pid" 2>/dev/null; then
            echo_color $YELLOW "🛑 Stopping $name (PID: $pid)..."
            kill -TERM "$pid" 2>/dev/null || true
            sleep 2
            
            # Force kill if still running
            if kill -0 "$pid" 2>/dev/null; then
                echo_color $RED "   Force killing $name..."
                kill -9 "$pid" 2>/dev/null || true
            fi
        fi
        rm -f "$pid_file"
        echo_color $GREEN "✅ Stopped $name"
    fi
}

# Function to check process status
check_named_process() {
    local name="$1"
    local pid_file="$PIDS_DIR/$name.pid"
    
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if kill -0 "$pid" 2>/dev/null; then
            echo_color $GREEN "✅ $name is running (PID: $pid)"
            return 0
        else
            echo_color $RED "❌ $name is not running (stale PID file)"
            rm -f "$pid_file"
            return 1
        fi
    else
        echo_color $RED "❌ $name is not running"
        return 1
    fi
}

# Function to show logs
show_logs() {
    local name="$1"
    local log_file="$PIDS_DIR/$name.log"
    
    if [ -f "$log_file" ]; then
        echo_color $BLUE "📜 Showing logs for $name:"
        tail -f "$log_file"
    else
        echo_color $RED "No log file found for $name"
    fi
}

# Command handlers
cmd_start() {
    echo_color $PURPLE "🎬 Starting Blink development environment..."
    
    # Clean up any existing processes first
    cmd_stop
    
    # Generate Tauri configuration with correct port (with fallback)
    echo_color $BLUE "🔧 Generating Tauri configuration..."
    if [ -f "$SCRIPT_DIR/generate-tauri-config.cjs" ]; then
        node "$SCRIPT_DIR/generate-tauri-config.cjs" || {
            echo_color $YELLOW "⚠️  Config generation failed, using template defaults"
            # Fallback: manually update the devUrl in tauri.conf.json
            if [ -f "$PROJECT_DIR/src-tauri/tauri.conf.template.json" ]; then
                sed "s|\"devUrl\": \"http://localhost:[0-9]*\"|\"devUrl\": \"http://localhost:$DEV_PORT\"|" \
                    "$PROJECT_DIR/src-tauri/tauri.conf.template.json" > "$PROJECT_DIR/src-tauri/tauri.conf.json"
                echo_color $GREEN "✅ Updated devUrl to http://localhost:$DEV_PORT using template"
            fi
        }
    else
        echo_color $YELLOW "⚠️  Config generator not found, skipping..."
    fi
    
    # Start Vite dev server with developer-specific name and port
    start_named_process "${DEV_PROCESS_PREFIX}.vite.${DEVELOPER}" "pnpm run dev" "$PROJECT_DIR"
    
    # Wait for Vite to be ready
    echo_color $YELLOW "⏳ Waiting for Vite to be ready on port $DEV_PORT..."
    local count=0
    while ! curl -s "http://localhost:$DEV_PORT" >/dev/null 2>&1 && [ $count -lt 30 ]; do
        sleep 1
        ((count++))
    done
    
    if [ $count -ge 30 ]; then
        echo_color $RED "❌ Vite failed to start properly"
        return 1
    fi
    
    echo_color $GREEN "✅ Vite is ready"
    
    # Start Tauri with developer-specific name
    start_named_process "${DEV_PROCESS_PREFIX}.tauri.${DEVELOPER}" "cargo run --no-default-features" "$PROJECT_DIR/src-tauri"
    
    echo_color $PURPLE "🎉 Blink development environment is ready!"
    echo_color $BLUE "📊 Use 'pnpm run dev:status' to check status"
    echo_color $BLUE "📜 Use 'pnpm run dev:logs <process>' to view logs"
}

cmd_stop() {
    echo_color $PURPLE "🛑 Stopping Blink development environment..."
    
    stop_named_process "${DEV_PROCESS_PREFIX}.tauri.${DEVELOPER}"
    stop_named_process "${DEV_PROCESS_PREFIX}.vite.${DEVELOPER}"
    
    # Also clean up any orphaned processes
    pkill -f "BLINK_PROCESS_NAME=" 2>/dev/null || true
    
    echo_color $GREEN "🎉 All processes stopped"
}

cmd_status() {
    echo_color $PURPLE "📊 Blink Development Status:"
    echo ""
    
    check_named_process "${DEV_PROCESS_PREFIX}.vite.${DEVELOPER}"
    check_named_process "${DEV_PROCESS_PREFIX}.tauri.${DEVELOPER}"
    
    echo ""
    echo_color $BLUE "Port Status:"
    if lsof -ti:$DEV_PORT >/dev/null 2>&1; then
        echo_color $GREEN "  Port $DEV_PORT (Vite): IN USE"
    else
        echo_color $RED "  Port $DEV_PORT (Vite): FREE"
    fi
}

cmd_logs() {
    local requested_process="$1"
    local process_name
    
    if [ -z "$requested_process" ]; then
        # Default to tauri logs
        process_name="${DEV_PROCESS_PREFIX}.tauri.${DEVELOPER}"
    elif [ "$requested_process" = "vite" ]; then
        process_name="${DEV_PROCESS_PREFIX}.vite.${DEVELOPER}"
    elif [ "$requested_process" = "tauri" ]; then
        process_name="${DEV_PROCESS_PREFIX}.tauri.${DEVELOPER}"
    else
        # Use the exact process name provided
        process_name="$requested_process"
    fi
    
    show_logs "$process_name"
}

cmd_restart() {
    echo_color $PURPLE "🔄 Restarting Blink development environment..."
    cmd_stop
    sleep 2
    cmd_start
}

# Main command dispatcher
case "${1:-start}" in
    "start")
        cmd_start
        ;;
    "stop")
        cmd_stop
        ;;
    "restart")
        cmd_restart
        ;;
    "status")
        cmd_status
        ;;
    "logs")
        cmd_logs "$2"
        ;;
    "help"|"-h"|"--help")
        echo_color $PURPLE "Blink Named Process Manager"
        echo ""
        echo "Usage: $0 [command] [options]"
        echo ""
        echo "Commands:"
        echo "  start    - Start all development processes"
        echo "  stop     - Stop all development processes"
        echo "  restart  - Restart all development processes"
        echo "  status   - Show process status"
        echo "  logs [process] - Show logs for process (default: ${DEV_PROCESS_PREFIX}.tauri.${DEVELOPER})"
        echo "  help     - Show this help"
        echo ""
        echo "Process names:"
        echo "  ${DEV_PROCESS_PREFIX}.vite.${DEVELOPER}  - Vite development server"
        echo "  ${DEV_PROCESS_PREFIX}.tauri.${DEVELOPER} - Tauri/Rust backend"
        ;;
    *)
        echo_color $RED "Unknown command: $1"
        echo "Run '$0 help' for available commands"
        exit 1
        ;;
esac