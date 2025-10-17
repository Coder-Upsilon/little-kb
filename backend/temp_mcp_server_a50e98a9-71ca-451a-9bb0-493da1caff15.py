#!/usr/bin/env python3
"""
Temporary MCP Server for Knowledge Base: Demo Knowledge Base
Generated automatically by Little KB
"""

import asyncio
import json
import logging
import sys
import os
from pathlib import Path

# Add the backend directory to Python path
backend_dir = Path(__file__).parent / "backend"
if backend_dir.exists():
    sys.path.insert(0, str(backend_dir))

try:
    from app.services.mcp_service import KnowledgeBaseMCPServer, MultiKnowledgeBaseMCPServer
    from app.services.knowledge_base_service import kb_service
except ImportError as e:
    print(f"Import error: {e}")
    print("Make sure you're running this from the Little KB root directory")
    sys.exit(1)

import uvicorn

async def main():
    """Main function to start the MCP server"""
    server_config = {
        "id": "a50e98a9-71ca-451a-9bb0-493da1caff15",
        "kb_id": "05a43abc-abc9-4333-9a1d-4258d93f6749",
        "kb_name": "Demo Knowledge Base",
        "server_name": "test",
        "description": "test",
        "instructions": "test",
        "created_date": "2025-09-22T12:24:18.471988",
        "enabled": false,
        "port": 8100,
        "base_url": "http://localhost:8100/mcp"
}
    
    try:
        if server_config.get("type") == "multi_kb":
            # Multi-KB server
            kb_ids = server_config["kb_ids"]
            mcp_server = MultiKnowledgeBaseMCPServer(kb_ids, server_config)
        else:
            # Single KB server
            kb_id = server_config["kb_id"]
            kb_data = kb_service.get_knowledge_base(kb_id)
            if not kb_data:
                print(f"Knowledge base {kb_id} not found")
                return
            mcp_server = KnowledgeBaseMCPServer(kb_id, kb_data, server_config)
        
        # Create the Starlette app
        app = mcp_server.create_starlette_app()
        
        # Start the server
        config = uvicorn.Config(
            app=app,
            host="0.0.0.0",
            port=8100,
            log_level="info"
        )
        server = uvicorn.Server(config)
        await server.serve()
        
    except Exception as e:
        print(f"Error starting MCP server: {e}")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
