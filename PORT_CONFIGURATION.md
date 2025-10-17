# Port Configuration Guide

## Overview

The Little KB application now supports configurable ports for all services (backend, frontend, and MCP servers) with automatic port availability checking. If a configured port is already in use, the system will automatically find an available alternative port.

## Configuration File

The application uses a `config.json` file in the root directory to configure ports:

```json
{
  "backend": {
    "port": 8000,
    "host": "0.0.0.0"
  },
  "frontend": {
    "port": 3000
  },
  "mcp": {
    "start_port": 8100,
    "max_port": 8200
  }
}
```

### Configuration Options

#### Backend Configuration
- **port**: Preferred port for the FastAPI backend (default: 8000)
- **host**: Host address to bind to (default: "0.0.0.0")
- **Fallback range**: If preferred port is unavailable, will search ports 8000-8100

#### Frontend Configuration
- **port**: Preferred port for the React frontend (default: 3000)
- **Fallback range**: If preferred port is unavailable, will search ports 3000-3100

#### MCP Configuration
- **start_port**: Starting port number for MCP servers (default: 8100)
- **max_port**: Maximum port number for MCP servers (default: 8200)
- **Behavior**: Each new MCP server gets the next available port in this range

## Auto-Port Selection

### How It Works

1. **Preferred Port Check**: System first attempts to use the configured preferred port
2. **Availability Scan**: If port is in use, scans for the next available port in the range
3. **Automatic Assignment**: Assigns the first available port found
4. **Error Handling**: If no ports are available in range, startup fails with clear error message

### Port Checking Logic

The system uses socket binding to check port availability:
- Binds to the port with SO_REUSEADDR option
- Successfully binding indicates port is available
- Binding failure (OSError) indicates port is in use

## Usage

### Starting Services with Default Ports

```bash
./manage_services.sh start
```

This will:
- Start backend on port 8000 (or next available)
- Start frontend on port 3000 (or next available)
- Start enabled MCP servers starting from port 8100

### Starting with Custom Configuration

1. Edit `config.json` with your preferred ports:
```json
{
  "backend": {
    "port": 9000,
    "host": "0.0.0.0"
  },
  "frontend": {
    "port": 4000
  },
  "mcp": {
    "start_port": 9100,
    "max_port": 9200
  }
}
```

2. Start services:
```bash
./manage_services.sh start
```

### Direct Script Usage

#### Backend Only
```bash
cd backend
python3 run_backend.py
```

#### Frontend Only
```bash
cd frontend
./run_frontend.sh
```

## Port Conflict Resolution

### Scenario 1: Preferred Port In Use
```
[INFO] Starting backend on preferred port 8000...
[WARNING] Port 8000 is not available, searching for alternative...
[INFO] Found available port: 8001
[SUCCESS] Backend started on http://localhost:8001
```

### Scenario 2: No Available Ports
```
[ERROR] Could not find an available port between 8000 and 8100
[ERROR] Failed to start backend
```

**Resolution**: 
- Close unnecessary services using ports in the range
- Increase the max_port value in config.json
- Change the preferred port to a different range

## MCP Server Ports

MCP servers are assigned ports automatically:

1. **Port Range**: Defined by `mcp.start_port` and `mcp.max_port` in config.json
2. **Sequential Assignment**: Each server gets the next available port
3. **Persistence**: Port assignments are saved in `knowledge-bases/mcp_config.json`
4. **Auto-Recovery**: If a port becomes unavailable, system finds next free port

### Viewing MCP Server Ports

```bash
# Check MCP server status via API
curl http://localhost:8000/api/mcp/ | jq '.[].port'

# Check via manage script
./manage_services.sh status
```

### Manually Changing MCP Server Ports

MCP server ports are stored in `knowledge-bases/mcp_config.json`. To change a server's port:

1. Stop all services: `./manage_services.sh stop`
2. Edit `knowledge-bases/mcp_config.json`
3. Update the `port` and `base_url` fields for the server
4. Start services: `./manage_services.sh start`

## Troubleshooting

### Port Already in Use Errors

```bash
# Find process using a specific port (macOS/Linux)
lsof -i :8000

# Kill process by port
kill $(lsof -t -i:8000)

# Or use the manage script to handle cleanup
./manage_services.sh stop
./manage_services.sh start
```

### Services Won't Start

1. **Check Configuration**:
```bash
cat config.json
python3 -c "import json; print(json.load(open('config.json')))"
```

2. **Check Port Availability**:
```bash
# Test if port is free (returns nothing if free)
lsof -i :8000
```

3. **View Logs**:
```bash
./manage_services.sh logs backend
./manage_services.sh logs frontend
```

### MCP Servers Out of Ports

If you see "No available MCP ports in range", either:

1. **Increase Port Range**:
```json
{
  "mcp": {
    "start_port": 8100,
    "max_port": 8300  // Increased from 8200
  }
}
```

2. **Remove Unused MCP Servers**:
   - Via UI: Navigate to MCP Server Management
   - Via API: `DELETE /api/mcp/{server_id}`

3. **Clean Up Old Configurations**:
```bash
# Backup first
cp knowledge-bases/mcp_config.json knowledge-bases/mcp_config.json.backup

# Edit to remove unused servers
nano knowledge-bases/mcp_config.json
```

## Environment Variables

The frontend startup script supports environment variables:

```bash
# Set custom port
PORT=4000 cd frontend && ./run_frontend.sh

# Set custom backend API URL
REACT_APP_API_URL=http://localhost:9000 PORT=4000 cd frontend && ./run_frontend.sh
```

## Best Practices

1. **Keep Default Ranges**: Unless necessary, use default port ranges to avoid conflicts
2. **Document Changes**: If changing ports, document in your deployment notes
3. **Firewall Rules**: Update firewall rules when changing port ranges
4. **Health Checks**: Verify all services after port changes:
   ```bash
   ./manage_services.sh status
   ```

5. **Load Balancers**: If using load balancers, update backend pool configurations

## Production Deployment

For production deployments:

1. **Use Fixed Ports**: Set specific ports in config.json and disable auto-seeking
2. **Firewall Configuration**: Ensure ports are accessible
3. **Reverse Proxy**: Consider using nginx/Apache as reverse proxy
4. **Process Management**: Use systemd/supervisor instead of manage_services.sh
5. **Port Security**: Don't expose MCP ports publicly unless necessary

Example nginx configuration:
```nginx
upstream backend {
    server localhost:8000;
}

upstream frontend {
    server localhost:3000;
}

server {
    listen 80;
    server_name yourdomain.com;

    location /api {
        proxy_pass http://backend;
    }

    location / {
        proxy_pass http://frontend;
    }
}
```

## API Reference

### Check Port Availability (Internal)
```python
from backend.app.utils.port_utils import is_port_available, find_available_port

# Check if port is available
if is_port_available(8000):
    print("Port 8000 is available")

# Find next available port
port = find_available_port(start_port=8000, max_port=8100)
print(f"Available port: {port}")
```

### Get MCP Server Configuration
```bash
# Get all MCP servers and their ports
curl http://localhost:8000/api/mcp/

# Get specific server config
curl http://localhost:8000/api/mcp/{server_id}/config
```

## Summary

- **Flexible Configuration**: Easy port configuration via config.json
- **Auto-Recovery**: Automatic port selection when conflicts occur
- **Range Support**: Configurable port ranges for each service type
- **Production Ready**: Suitable for both development and production use
- **Clear Feedback**: Informative logging about port selection decisions

For questions or issues, check the logs or refer to the main README.md file.
