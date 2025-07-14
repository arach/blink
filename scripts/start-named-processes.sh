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
    local follow_flag="$2"
    local process_name
    
    # Handle --follow flag
    if [ "$requested_process" = "--follow" ]; then
        follow_flag="--follow"
        requested_process=""
    elif [ "$follow_flag" = "--follow" ] || [ "$requested_process" = "-f" ]; then
        follow_flag="--follow"
    fi
    
    # Show both logs side by side if no specific process requested
    if [ -z "$requested_process" ]; then
        echo_color $BLUE "📜 Showing both Vite and Tauri logs (Ctrl+C to exit):"
        echo ""
        
        local vite_log="${PIDS_DIR}/${DEV_PROCESS_PREFIX}.vite.${DEVELOPER}.log"
        local tauri_log="${PIDS_DIR}/${DEV_PROCESS_PREFIX}.tauri.${DEVELOPER}.log"
        
        if [ "$follow_flag" = "--follow" ]; then
            # Use multitail if available, otherwise fall back to tail -f
            if command -v multitail >/dev/null 2>&1; then
                multitail -s 2 -sn 1,3 \
                    -t "🔧 Vite (${DEV_PROCESS_PREFIX}.vite.${DEVELOPER})" "$vite_log" \
                    -t "🦀 Tauri (${DEV_PROCESS_PREFIX}.tauri.${DEVELOPER})" "$tauri_log"
            else
                echo_color $YELLOW "💡 Install multitail for better dual log viewing: brew install multitail"
                echo_color $BLUE "📜 Following Tauri logs (most important for debugging):"
                tail -f "$tauri_log" 2>/dev/null || echo "No Tauri logs yet"
            fi
        else
            echo_color $CYAN "🔧 === VITE LOGS ==="
            tail -n 20 "$vite_log" 2>/dev/null || echo "No Vite logs yet"
            echo ""
            echo_color $CYAN "🦀 === TAURI LOGS ==="
            tail -n 20 "$tauri_log" 2>/dev/null || echo "No Tauri logs yet"
        fi
        return
    fi
    
    # Single process logs
    if [ "$requested_process" = "vite" ]; then
        process_name="${DEV_PROCESS_PREFIX}.vite.${DEVELOPER}"
    elif [ "$requested_process" = "tauri" ]; then
        process_name="${DEV_PROCESS_PREFIX}.tauri.${DEVELOPER}"
    else
        process_name="$requested_process"
    fi
    
    echo_color $BLUE "📜 Showing logs for $process_name:"
    echo ""
    
    if [ "$follow_flag" = "--follow" ]; then
        echo_color $BLUE "Following logs (Ctrl+C to exit)..."
        tail -f "${PIDS_DIR}/${process_name}.log" 2>/dev/null || echo "No logs yet"
    else
        show_logs "$process_name"
    fi
}

cmd_restart() {
    echo_color $PURPLE "🔄 Restarting Blink development environment..."
    cmd_stop
    sleep 2
    cmd_start
}

cmd_restart_logs() {
    echo_color $PURPLE "🔄 Restarting Blink development environment..."
    cmd_stop
    sleep 2
    cmd_start
    echo_color $BLUE "📜 Following both logs (Ctrl+C to exit)..."
    sleep 1
    cmd_logs "" "--follow"
}

cmd_restart_frontend() {
    echo_color $CYAN "🔄 Restarting frontend only (faster)..."
    
    # Stop only Vite, keep Tauri running
    stop_named_process "${DEV_PROCESS_PREFIX}.vite.${DEVELOPER}"
    sleep 1
    
    # Regenerate Tauri config in case port changed
    if [ -f "$SCRIPT_DIR/generate-tauri-config.cjs" ]; then
        node "$SCRIPT_DIR/generate-tauri-config.cjs" || echo "Warning: Could not update Tauri config"
    fi
    
    # Start Vite only
    start_named_process "${DEV_PROCESS_PREFIX}.vite.${DEVELOPER}" "pnpm run dev" "$PROJECT_DIR"
    
    # Wait for Vite to be ready
    echo_color $YELLOW "⏳ Waiting for Vite to be ready on port $DEV_PORT..."
    local count=0
    while ! curl -s "http://localhost:$DEV_PORT" >/dev/null 2>&1; do
        sleep 0.5
        count=$((count + 1))
        if [ $count -ge 20 ]; then
            echo_color $RED "❌ Vite failed to start properly"
            return 1
        fi
    done
    
    echo_color $GREEN "✅ Frontend restarted (Tauri kept running)"
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
    "restart-logs")
        cmd_restart_logs
        ;;
    "restart-frontend")
        cmd_restart_frontend
        ;;
    "status")
        cmd_status
        ;;
    "logs")
        cmd_logs "$2" "$3"
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