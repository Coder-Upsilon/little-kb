#!/bin/bash

# Little KB Service Management Script
# This script manages the backend and frontend services for the Little KB application

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKEND_DIR="backend"
FRONTEND_DIR="frontend"
CONFIG_FILE="config.json"
BACKEND_PID_FILE=".backend.pid"
FRONTEND_PID_FILE=".frontend.pid"

# Load configuration from config.json if available
load_config() {
    if [ -f "$CONFIG_FILE" ]; then
        if command -v python3 &> /dev/null; then
            BACKEND_PORT=$(python3 -c "import json; c=json.load(open('$CONFIG_FILE')); print(c.get('backend', {}).get('port', 8000))" 2>/dev/null || echo "8000")
            FRONTEND_PORT=$(python3 -c "import json; c=json.load(open('$CONFIG_FILE')); print(c.get('frontend', {}).get('port', 3000))" 2>/dev/null || echo "3000")
        else
            # Fallback to defaults if python3 is not available
            BACKEND_PORT=8000
            FRONTEND_PORT=3000
        fi
    else
        # Use defaults if config file doesn't exist
        BACKEND_PORT=8000
        FRONTEND_PORT=3000
    fi
}

# Load configuration at startup
load_config

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if a port is in use
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 0  # Port is in use
    else
        return 1  # Port is free
    fi
}

# Function to kill process by PID file
kill_by_pid_file() {
    local pid_file=$1
    local service_name=$2
    
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if kill -0 "$pid" 2>/dev/null; then
            print_status "Stopping $service_name (PID: $pid)..."
            kill "$pid"
            sleep 2
            if kill -0 "$pid" 2>/dev/null; then
                print_warning "Process still running, force killing..."
                kill -9 "$pid"
            fi
        fi
        rm -f "$pid_file"
        print_success "$service_name stopped"
    else
        print_warning "No PID file found for $service_name"
    fi
}

# Function to kill process by port
kill_by_port() {
    local port=$1
    local service_name=$2
    
    if check_port $port; then
        print_status "Killing process on port $port..."
        local pids=$(lsof -ti:$port)
        if [ -n "$pids" ]; then
            # Kill all processes on the port
            echo "$pids" | while read -r pid; do
                if [ -n "$pid" ]; then
                    print_status "Killing PID $pid on port $port..."
                    kill "$pid" 2>/dev/null || kill -9 "$pid" 2>/dev/null
                fi
            done
            sleep 2
            
            # Check if any processes are still running
            if check_port $port; then
                print_warning "Some processes still running on port $port, force killing..."
                local remaining_pids=$(lsof -ti:$port)
                if [ -n "$remaining_pids" ]; then
                    echo "$remaining_pids" | while read -r pid; do
                        if [ -n "$pid" ]; then
                            kill -9 "$pid" 2>/dev/null
                        fi
                    done
                fi
                sleep 1
            fi
            
            if check_port $port; then
                print_warning "Port $port may still be in use"
            else
                print_success "Process on port $port killed"
            fi
        fi
    fi
}

# Function to start backend
start_backend() {
    print_status "Starting backend service..."
    
    # Check if backend directory exists
    if [ ! -d "$BACKEND_DIR" ]; then
        print_error "Backend directory not found: $BACKEND_DIR"
        exit 1
    fi
    
    # Check if port is already in use
    if check_port $BACKEND_PORT; then
        print_warning "Port $BACKEND_PORT is already in use"
        kill_by_port $BACKEND_PORT "backend"
    fi
    
    # Start backend
    cd "$BACKEND_DIR"
    
    # Check if uv is available
    if ! command -v uv &> /dev/null; then
        print_error "uv is not installed. Please install uv first."
        exit 1
    fi
    
    # Start backend using the new run_backend.py script with uv
    print_status "Starting FastAPI backend (will auto-select port starting from $BACKEND_PORT)..."
    nohup uv run python run_backend.py > ../backend.log 2>&1 &
    echo $! > "../$BACKEND_PID_FILE"
    
    cd ..
    
    # Wait for backend to start (it needs time to load models and initialize)
    print_status "Waiting for backend to initialize (this may take 10-15 seconds)..."
    sleep 8
    if check_port $BACKEND_PORT; then
        print_success "Backend started successfully on http://localhost:$BACKEND_PORT"
        print_status "API documentation available at http://localhost:$BACKEND_PORT/docs"
    else
        # Try waiting longer for slower systems or model loading
        print_status "Still initializing, waiting longer..."
        sleep 7
        if check_port $BACKEND_PORT; then
            print_success "Backend started successfully on http://localhost:$BACKEND_PORT"
            print_status "API documentation available at http://localhost:$BACKEND_PORT/docs"
        else
            print_warning "Backend taking longer than expected, checking one more time..."
            sleep 5
            if check_port $BACKEND_PORT; then
                print_success "Backend started successfully on http://localhost:$BACKEND_PORT"
                print_status "API documentation available at http://localhost:$BACKEND_PORT/docs"
            else
                print_error "Failed to start backend service"
                print_status "Check backend.log for details: tail -n 50 backend.log"
                return 1
            fi
        fi
    fi
}

# Function to start frontend
start_frontend() {
    print_status "Starting frontend service..."
    
    # Check if frontend directory exists
    if [ ! -d "$FRONTEND_DIR" ]; then
        print_error "Frontend directory not found: $FRONTEND_DIR"
        exit 1
    fi
    
    # Check if port is already in use
    if check_port $FRONTEND_PORT; then
        print_warning "Port $FRONTEND_PORT is already in use"
        kill_by_port $FRONTEND_PORT "frontend"
    fi
    
    # Start frontend
    cd "$FRONTEND_DIR"
    
    # Check if npm is available
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed. Please install Node.js and npm first."
        exit 1
    fi
    
    # Install dependencies if node_modules doesn't exist
    if [ ! -d "node_modules" ]; then
        print_status "Installing frontend dependencies..."
        npm install
    fi
    
    # Start frontend using the new run_frontend.sh script
    print_status "Starting React frontend (will auto-select port starting from $FRONTEND_PORT)..."
    chmod +x run_frontend.sh 2>/dev/null || true
    nohup ./run_frontend.sh > ../frontend.log 2>&1 &
    echo $! > "../$FRONTEND_PID_FILE"
    
    cd ..
    
    # Wait a moment and check if it started successfully
    sleep 5
    if check_port $FRONTEND_PORT; then
        print_success "Frontend started successfully on http://localhost:$FRONTEND_PORT"
    else
        print_error "Failed to start frontend service"
        return 1
    fi
}

# Function to stop backend
stop_backend() {
    print_status "Stopping backend service..."
    kill_by_pid_file "$BACKEND_PID_FILE" "backend"
    kill_by_port $BACKEND_PORT "backend"
}

# Function to stop frontend
stop_frontend() {
    print_status "Stopping frontend service..."
    
    # First try to kill by PID file
    kill_by_pid_file "$FRONTEND_PID_FILE" "frontend"
    
    # Then kill by port (handles React dev server and its children)
    kill_by_port $FRONTEND_PORT "frontend"
    
    # Additional cleanup for React dev server processes
    print_status "Cleaning up any remaining React processes..."
    pkill -f "react-scripts" 2>/dev/null || true
    pkill -f "webpack" 2>/dev/null || true
    pkill -f "node.*start" 2>/dev/null || true
    
    # Final check
    sleep 1
    if check_port $FRONTEND_PORT; then
        print_warning "Frontend may still be running on port $FRONTEND_PORT"
        print_status "You may need to manually kill remaining processes"
    else
        print_success "Frontend stopped successfully"
    fi
}

# Function to check service status
check_status() {
    print_status "Checking service status..."
    
    echo
    echo "=== Backend Status ==="
    if check_port $BACKEND_PORT; then
        print_success "Backend is running on port $BACKEND_PORT"
        if [ -f "$BACKEND_PID_FILE" ]; then
            local pid=$(cat "$BACKEND_PID_FILE")
            echo "  PID: $pid"
        fi
    else
        print_warning "Backend is not running"
    fi
    
    echo
    echo "=== Frontend Status ==="
    if check_port $FRONTEND_PORT; then
        print_success "Frontend is running on port $FRONTEND_PORT"
        if [ -f "$FRONTEND_PID_FILE" ]; then
            local pid=$(cat "$FRONTEND_PID_FILE")
            echo "  PID: $pid"
        fi
    else
        print_warning "Frontend is not running"
    fi
    
    echo
    echo "=== Log Files ==="
    if [ -f "backend.log" ]; then
        echo "  Backend log: backend.log"
    fi
    if [ -f "frontend.log" ]; then
        echo "  Frontend log: frontend.log"
    fi
}

# Function to show logs
show_logs() {
    local service=$1
    
    case $service in
        "backend")
            if [ -f "backend.log" ]; then
                print_status "Showing backend logs (last 50 lines):"
                tail -n 50 backend.log
            else
                print_warning "Backend log file not found"
            fi
            ;;
        "frontend")
            if [ -f "frontend.log" ]; then
                print_status "Showing frontend logs (last 50 lines):"
                tail -n 50 frontend.log
            else
                print_warning "Frontend log file not found"
            fi
            ;;
        "all"|*)
            if [ -f "backend.log" ]; then
                print_status "Backend logs (last 25 lines):"
                tail -n 25 backend.log
                echo
            fi
            if [ -f "frontend.log" ]; then
                print_status "Frontend logs (last 25 lines):"
                tail -n 25 frontend.log
            fi
            ;;
    esac
}

# Function to clean up
cleanup() {
    print_status "Cleaning up..."
    rm -f backend.log frontend.log
    rm -f "$BACKEND_PID_FILE" "$FRONTEND_PID_FILE"
    print_success "Cleanup completed"
}

# Main script logic
case "${1:-}" in
    "start")
        print_status "Starting all services..."
        start_backend
        start_frontend
        echo
        check_status
        ;;
    "stop")
        print_status "Stopping all services..."
        stop_backend
        stop_frontend
        print_success "All services stopped"
        ;;
    "restart")
        print_status "Restarting all services..."
        stop_backend
        stop_frontend
        sleep 2
        start_backend
        start_frontend
        echo
        check_status
        ;;
    "status")
        check_status
        ;;
    "logs")
        show_logs "${2:-all}"
        ;;
    "backend")
        case "${2:-}" in
            "start")
                start_backend
                ;;
            "stop")
                stop_backend
                ;;
            "restart")
                stop_backend
                sleep 2
                start_backend
                ;;
            "logs")
                show_logs "backend"
                ;;
            *)
                print_error "Usage: $0 backend {start|stop|restart|logs}"
                exit 1
                ;;
        esac
        ;;
    "frontend")
        case "${2:-}" in
            "start")
                start_frontend
                ;;
            "stop")
                stop_frontend
                ;;
            "restart")
                stop_frontend
                sleep 2
                start_frontend
                ;;
            "logs")
                show_logs "frontend"
                ;;
            *)
                print_error "Usage: $0 frontend {start|stop|restart|logs}"
                exit 1
                ;;
        esac
        ;;
    "cleanup")
        cleanup
        ;;
    "help"|"-h"|"--help")
        echo "Little KB Service Management Script"
        echo
        echo "Usage: $0 {start|stop|restart|status|logs|cleanup|help}"
        echo "       $0 {backend|frontend} {start|stop|restart|logs}"
        echo
        echo "Commands:"
        echo "  start     - Start all services (backend + frontend)"
        echo "  stop      - Stop all services"
        echo "  restart   - Restart all services"
        echo "  status    - Check status of all services"
        echo "  logs      - Show logs for all services"
        echo "  cleanup   - Clean up log files and PID files"
        echo
        echo "Service-specific commands:"
        echo "  backend start    - Start only the backend service"
        echo "  backend stop     - Stop only the backend service"
        echo "  backend restart  - Restart only the backend service"
        echo "  backend logs     - Show backend logs"
        echo
        echo "  frontend start   - Start only the frontend service"
        echo "  frontend stop    - Stop only the frontend service"
        echo "  frontend restart - Restart only the frontend service"
        echo "  frontend logs    - Show frontend logs"
        echo
        echo "Examples:"
        echo "  $0 start                 # Start all services"
        echo "  $0 backend restart       # Restart only backend"
        echo "  $0 logs                  # Show all logs"
        echo "  $0 status                # Check service status"
        ;;
    *)
        print_error "Unknown command: ${1:-}"
        echo "Use '$0 help' for usage information"
        exit 1
        ;;
esac
