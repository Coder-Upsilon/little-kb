#!/usr/bin/env python3
"""
Backend startup script with configurable port and auto-seeking
"""
import json
import logging
import sys
import os
from pathlib import Path

# Ensure we're in the backend directory
os.chdir(Path(__file__).parent)

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def load_config():
    """Load configuration from config.json"""
    config_path = Path(__file__).parent.parent / "config.json"
    try:
        with open(config_path, 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        logger.warning(f"Config file not found at {config_path}, using defaults")
        return {
            "backend": {"port": 8000, "host": "0.0.0.0"},
            "frontend": {"port": 3000},
            "mcp": {"start_port": 8100, "max_port": 8200}
        }
    except Exception as e:
        logger.error(f"Error loading config: {e}")
        return {
            "backend": {"port": 8000, "host": "0.0.0.0"},
            "frontend": {"port": 3000},
            "mcp": {"start_port": 8100, "max_port": 8200}
        }

def main():
    # Load configuration
    config = load_config()
    backend_config = config.get("backend", {})
    
    preferred_port = backend_config.get("port", 8000)
    host = backend_config.get("host", "0.0.0.0")
    
    # Import here to ensure we're in the right environment
    try:
        from app.utils.port_utils import get_port_or_find_available
        import uvicorn
    except ImportError as e:
        logger.error(f"Failed to import required modules: {e}")
        logger.error("Make sure to run this script with: uv run python run_backend.py")
        sys.exit(1)
    
    # Try to use preferred port, or find an available one
    try:
        port = get_port_or_find_available(
            preferred_port=preferred_port,
            start_port=8000,
            max_port=8100,
            host=host
        )
        
        logger.info(f"Starting backend server on {host}:{port}")
        
        # Update CORS to include dynamically determined frontend port
        frontend_port = config.get("frontend", {}).get("port", 3000)
        
        # Start uvicorn server
        uvicorn.run(
            "app.main:app",
            host=host,
            port=port,
            reload=True,
            log_level="info"
        )
        
    except RuntimeError as e:
        logger.error(f"Failed to start backend: {e}")
        sys.exit(1)
    except KeyboardInterrupt:
        logger.info("Backend server stopped by user")
        sys.exit(0)

if __name__ == "__main__":
    main()
