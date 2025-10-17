import socket
import logging
from typing import Optional

logger = logging.getLogger(__name__)

def is_port_available(port: int, host: str = "0.0.0.0") -> bool:
    """Check if a port is available"""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            sock.bind((host, port))
            return True
    except OSError:
        return False

def find_available_port(start_port: int, max_port: Optional[int] = None, host: str = "0.0.0.0") -> Optional[int]:
    """Find an available port starting from start_port"""
    if max_port is None:
        max_port = start_port + 100
    
    for port in range(start_port, max_port + 1):
        if is_port_available(port, host):
            logger.info(f"Found available port: {port}")
            return port
    
    logger.error(f"No available ports found between {start_port} and {max_port}")
    return None

def get_port_or_find_available(preferred_port: int, start_port: int, max_port: int, host: str = "0.0.0.0") -> int:
    """
    Try to use the preferred port, if not available, find an available one
    """
    if is_port_available(preferred_port, host):
        logger.info(f"Using preferred port: {preferred_port}")
        return preferred_port
    
    logger.warning(f"Preferred port {preferred_port} is not available, searching for alternative...")
    available_port = find_available_port(start_port, max_port, host)
    
    if available_port is None:
        raise RuntimeError(f"Could not find an available port between {start_port} and {max_port}")
    
    return available_port
