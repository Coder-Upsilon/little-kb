#!/bin/bash

# Frontend startup script with configurable port and auto-seeking

# Load configuration
CONFIG_FILE="../config.json"
FRONTEND_PORT=3000
BACKEND_PORT=8000

if [ -f "$CONFIG_FILE" ]; then
    # Extract ports from config.json using node if available, otherwise use defaults
    if command -v node &> /dev/null; then
        FRONTEND_PORT=$(node -e "try { const c = require('$CONFIG_FILE'); console.log(c.frontend?.port || 3000); } catch(e) { console.log(3000); }")
        BACKEND_PORT=$(node -e "try { const c = require('$CONFIG_FILE'); console.log(c.backend?.port || 8000); } catch(e) { console.log(8000); }")
    fi
fi

echo "Frontend configuration:"
echo "  Preferred port: $FRONTEND_PORT"
echo "  Backend API: http://localhost:$BACKEND_PORT"

# Function to check if port is available
is_port_available() {
    ! lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null 2>&1
}

# Find available port
find_available_port() {
    local start_port=$1
    local max_port=$((start_port + 100))
    
    for port in $(seq $start_port $max_port); do
        if is_port_available $port; then
            echo $port
            return 0
        fi
    done
    
    echo ""
    return 1
}

# Try to use preferred port, or find an available one
if is_port_available $FRONTEND_PORT; then
    PORT=$FRONTEND_PORT
    echo "Using preferred port: $PORT"
else
    echo "Port $FRONTEND_PORT is not available, searching for alternative..."
    PORT=$(find_available_port $FRONTEND_PORT)
    
    if [ -z "$PORT" ]; then
        echo "Error: Could not find an available port"
        exit 1
    fi
    
    echo "Using alternative port: $PORT"
fi

# Set environment variables for React
export PORT=$PORT
export REACT_APP_API_URL="http://localhost:$BACKEND_PORT"

# Start React development server
echo "Starting frontend on port $PORT..."
npm start
