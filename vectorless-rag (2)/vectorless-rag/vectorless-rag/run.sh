#!/bin/bash

# Vectorless RAG - Start/Stop Script

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"
LOG_DIR="$PROJECT_DIR/logs"

BACKEND_PID_FILE="$LOG_DIR/backend.pid"
FRONTEND_PID_FILE="$LOG_DIR/frontend.pid"
BACKEND_LOG="$LOG_DIR/backend.log"
FRONTEND_LOG="$LOG_DIR/frontend.log"

mkdir -p "$LOG_DIR"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_status() {
    echo -e "${1}${2}${NC}"
}

is_running() {
    local pid_file=$1
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if kill -0 "$pid" 2>/dev/null; then
            return 0
        fi
    fi
    return 1
}

start_backend() {
    if is_running "$BACKEND_PID_FILE"; then
        print_status "$YELLOW" "Backend is already running (PID: $(cat $BACKEND_PID_FILE))"
        return
    fi
    
    print_status "$YELLOW" "Starting backend..."
    cd "$BACKEND_DIR"
    nohup /opt/homebrew/bin/python3.11 -m uvicorn main:app --reload --host 0.0.0.0 --port 8000 > "$BACKEND_LOG" 2>&1 &
    echo $! > "$BACKEND_PID_FILE"
    print_status "$GREEN" "Backend started (PID: $!)"
    cd "$PROJECT_DIR"
}

start_frontend() {
    if is_running "$FRONTEND_PID_FILE"; then
        print_status "$YELLOW" "Frontend is already running (PID: $(cat $FRONTEND_PID_FILE))"
        return
    fi
    
    print_status "$YELLOW" "Starting frontend..."
    cd "$FRONTEND_DIR"
    nohup npm run dev > "$FRONTEND_LOG" 2>&1 &
    echo $! > "$FRONTEND_PID_FILE"
    print_status "$GREEN" "Frontend started (PID: $!)"
    cd "$PROJECT_DIR"
}

stop_backend() {
    if is_running "$BACKEND_PID_FILE"; then
        local pid=$(cat "$BACKEND_PID_FILE")
        print_status "$YELLOW" "Stopping backend (PID: $pid)..."
        kill "$pid" 2>/dev/null
        sleep 1
        if kill -0 "$pid" 2>/dev/null; then
            kill -9 "$pid" 2>/dev/null
        fi
        rm -f "$BACKEND_PID_FILE"
        print_status "$GREEN" "Backend stopped"
    else
        print_status "$YELLOW" "Backend is not running"
    fi
}

stop_frontend() {
    if is_running "$FRONTEND_PID_FILE"; then
        local pid=$(cat "$FRONTEND_PID_FILE")
        print_status "$YELLOW" "Stopping frontend (PID: $pid)..."
        kill "$pid" 2>/dev/null
        sleep 1
        if kill -0 "$pid" 2>/dev/null; then
            kill -9 "$pid" 2>/dev/null
        fi
        rm -f "$FRONTEND_PID_FILE"
        print_status "$GREEN" "Frontend stopped"
    else
        print_status "$YELLOW" "Frontend is not running"
    fi
}

show_status() {
    echo ""
    echo "=== Vectorless RAG Status ==="
    echo ""
    
    if is_running "$BACKEND_PID_FILE"; then
        print_status "$GREEN" "Backend:  Running (PID: $(cat $BACKEND_PID_FILE))"
    else
        print_status "$RED" "Backend:  Stopped"
    fi
    
    if is_running "$FRONTEND_PID_FILE"; then
        print_status "$GREEN" "Frontend: Running (PID: $(cat $FRONTEND_PID_FILE))"
    else
        print_status "$RED" "Frontend: Stopped"
    fi
    
    echo ""
    echo "URLs:"
    echo "  Backend:  http://localhost:8000"
    echo "  Frontend: http://localhost:5173"
    echo "  API Docs: http://localhost:8000/docs"
    echo ""
}

show_logs() {
    echo "=== Backend Logs (last 20 lines) ==="
    tail -20 "$BACKEND_LOG" 2>/dev/null || echo "No backend logs"
    echo ""
    echo "=== Frontend Logs (last 20 lines) ==="
    tail -20 "$FRONTEND_LOG" 2>/dev/null || echo "No frontend logs"
}

case "$1" in
    start)
        start_backend
        start_frontend
        show_status
        ;;
    stop)
        stop_backend
        stop_frontend
        ;;
    restart)
        stop_backend
        stop_frontend
        sleep 1
        start_backend
        start_frontend
        show_status
        ;;
    status)
        show_status
        ;;
    logs)
        show_logs
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status|logs}"
        echo ""
        echo "Commands:"
        echo "  start    - Start both backend and frontend"
        echo "  stop     - Stop both services"
        echo "  restart  - Restart both services"
        echo "  status   - Show current status"
        echo "  logs     - Show recent logs"
        exit 1
        ;;
esac
