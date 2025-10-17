import asyncio
import contextlib
import json
import logging
import os
import threading
import sys
import uuid
from collections.abc import AsyncIterator
from datetime import datetime
from typing import Any, Dict, List, Optional

import anyio
import mcp.types as types
import uvicorn
from fastapi import HTTPException
from mcp.server.lowlevel import Server
from mcp.server.streamable_http_manager import StreamableHTTPSessionManager
from starlette.applications import Starlette
from starlette.middleware.cors import CORSMiddleware
from starlette.routing import Mount
from starlette.types import Receive, Scope, Send

from .knowledge_base_service import kb_service
from .vector_service import vector_service

logger = logging.getLogger(__name__)

class KnowledgeBaseMCPServer:
    """MCP Server for a specific knowledge base"""
    
    def __init__(self, kb_id: str, kb_data: dict, server_config: dict):
        self.kb_id = kb_id
        self.kb_data = kb_data
        self.server_config = server_config
        self.port = server_config.get('port', 8100)
        
        # Get custom tool descriptions or use defaults
        self.tool_descriptions = server_config.get('tool_descriptions', {})
        
        # Create MCP server
        self.app = Server(f"kb-{kb_data['name']}-{kb_id[:8]}")
        self.setup_handlers()
        
        # Create session manager
        self.session_manager = StreamableHTTPSessionManager(
            app=self.app,
            event_store=None,
            json_response=False,
            stateless=True,
        )
        
    def setup_handlers(self):
        """Setup MCP tool and resource handlers"""
        
        @self.app.list_tools()
        async def list_tools() -> List[types.Tool]:
            # Get custom tool descriptions or use defaults
            search_desc = self.tool_descriptions.get(
                "search_knowledge_base",
                f"Search the '{self.kb_data['name']}' knowledge base using semantic search"
            )
            info_desc = self.tool_descriptions.get(
                "get_knowledge_base_info",
                f"Get information about the '{self.kb_data['name']}' knowledge base"
            )
            list_desc = self.tool_descriptions.get(
                "list_documents",
                f"List all documents in the '{self.kb_data['name']}' knowledge base"
            )
            
            # Get parameter descriptions or use defaults
            search_params = self.tool_descriptions.get("search_knowledge_base_params", {})
            query_desc = search_params.get("query", "Search query to find relevant documents")
            limit_desc = search_params.get("limit", "Maximum number of results to return (default: 5)")
            
            return [
                types.Tool(
                    name="search_knowledge_base",
                    description=search_desc,
                    inputSchema={
                        "type": "object",
                        "required": ["query"],
                        "properties": {
                            "query": {
                                "type": "string",
                                "description": query_desc
                            },
                            "limit": {
                                "type": "number",
                                "description": limit_desc,
                                "minimum": 1,
                                "maximum": 20
                            }
                        }
                    }
                ),
                types.Tool(
                    name="get_knowledge_base_info",
                    description=info_desc,
                    inputSchema={
                        "type": "object",
                        "properties": {}
                    }
                ),
                types.Tool(
                    name="list_documents",
                    description=list_desc,
                    inputSchema={
                        "type": "object",
                        "properties": {}
                    }
                )
            ]
        
        @self.app.call_tool()
        async def call_tool(name: str, arguments: Dict[str, Any]) -> List[types.ContentBlock]:
            try:
                if name == "search_knowledge_base":
                    query = arguments.get("query", "")
                    limit = arguments.get("limit", 5)
                    
                    if not query:
                        return [types.TextContent(
                            type="text",
                            text="Error: Query parameter is required"
                        )]
                    
                    # Get KB configuration for search settings
                    kb_config = self.kb_data.get("config", {})
                    embedding_model = kb_config.get("embedding_model", "all-MiniLM-L6-v2")
                    search_config = kb_config.get("search", {})
                    use_hybrid = search_config.get("hybrid_search", False)
                    
                    # Perform search using vector service with KB's settings
                    results = vector_service.search(
                        kb_id=self.kb_id,
                        query=query,
                        limit=limit,
                        embedding_model=embedding_model,
                        use_hybrid=use_hybrid,
                        hybrid_alpha=search_config.get("hybrid_alpha", 0.5),
                        bm25_k1=search_config.get("bm25_k1", 1.5),
                        bm25_b=search_config.get("bm25_b", 0.75)
                    )
                    
                    if not results:
                        return [types.TextContent(
                            type="text",
                            text=f"No results found for query: '{query}'"
                        )]
                    
                    # Format results
                    formatted_results = []
                    for i, result in enumerate(results, 1):
                        formatted_results.append(
                            f"**Result {i}** (Score: {result.get('similarity_score', 0):.3f})\n"
                            f"**Source:** {result.get('filename', 'Unknown')}\n"
                            f"**Content:** {result.get('content', '')}\n"
                        )
                    
                    return [types.TextContent(
                        type="text",
                        text=f"Search results for '{query}' in {self.kb_data['name']}:\n\n" + 
                             "\n---\n".join(formatted_results)
                    )]
                
                elif name == "get_knowledge_base_info":
                    # Get knowledge base statistics
                    stats = kb_service.get_knowledge_base_stats(self.kb_id)
                    
                    info = {
                        "name": self.kb_data['name'],
                        "description": self.kb_data.get('description', ''),
                        "id": self.kb_id,
                        "created_date": self.kb_data.get('created_date', ''),
                        "file_count": stats.get('file_count', 0),
                        "total_chunks": stats.get('total_chunks', 0),
                        "last_updated": stats.get('last_updated', ''),
                        "instructions": self.server_config.get('instructions', '')
                    }
                    
                    return [types.TextContent(
                        type="text",
                        text=f"Knowledge Base Information:\n\n" + 
                             json.dumps(info, indent=2)
                    )]
                
                elif name == "list_documents":
                    # Get list of documents
                    documents = kb_service.list_files(self.kb_id)
                    
                    if not documents:
                        return [types.TextContent(
                            type="text",
                            text="No documents found in this knowledge base."
                        )]
                    
                    doc_list = []
                    for doc in documents:
                        doc_list.append(
                            f"- **{doc.get('filename', 'Unknown')}** "
                            f"({doc.get('file_type', 'unknown')} - "
                            f"{doc.get('file_size', 0)} bytes)"
                        )
                    
                    return [types.TextContent(
                        type="text",
                        text=f"Documents in {self.kb_data['name']}:\n\n" + 
                             "\n".join(doc_list)
                    )]
                
                else:
                    return [types.TextContent(
                        type="text",
                        text=f"Unknown tool: {name}"
                    )]
                    
            except Exception as e:
                logger.error(f"Error in MCP tool {name}: {str(e)}")
                return [types.TextContent(
                    type="text",
                    text=f"Error executing {name}: {str(e)}"
                )]
    
    async def handle_streamable_http(self, scope: Scope, receive: Receive, send: Send) -> None:
        """Handle streamable HTTP requests"""
        await self.session_manager.handle_request(scope, receive, send)
    
    @contextlib.asynccontextmanager
    async def lifespan(self, app: Starlette) -> AsyncIterator[None]:
        """Context manager for session manager"""
        async with self.session_manager.run():
            logger.info(f"MCP server for KB '{self.kb_data['name']}' started on port {self.port}")
            try:
                yield
            finally:
                logger.info(f"MCP server for KB '{self.kb_data['name']}' shutting down...")
    
    def create_starlette_app(self) -> Starlette:
        """Create the Starlette ASGI application"""
        starlette_app = Starlette(
            debug=True,
            routes=[
                Mount("/mcp", app=self.handle_streamable_http),
            ],
            lifespan=self.lifespan,
        )
        
        # Add CORS middleware
        starlette_app = CORSMiddleware(
            starlette_app,
            allow_origins=["*"],
            allow_methods=["GET", "POST", "DELETE"],
            expose_headers=["Mcp-Session-Id"],
        )
        
        return starlette_app


class MultiKnowledgeBaseMCPServer:
    """MCP Server that can search across multiple knowledge bases"""
    
    def __init__(self, kb_ids: List[str], server_config: dict):
        self.kb_ids = kb_ids
        self.server_config = server_config
        self.port = server_config.get('port', 8101)
        
        # Get knowledge base data
        self.kb_data = {}
        for kb_id in kb_ids:
            kb_info = kb_service.get_knowledge_base(kb_id)
            if kb_info:
                self.kb_data[kb_id] = kb_info
        
        # Create MCP server
        kb_names = [self.kb_data[kb_id]['name'] for kb_id in self.kb_data.keys()]
        self.app = Server(f"multi-kb-{'-'.join(kb_names[:2])}")
        self.setup_handlers()
        
        # Create session manager
        self.session_manager = StreamableHTTPSessionManager(
            app=self.app,
            event_store=None,
            json_response=False,
            stateless=True,
        )
    
    def setup_handlers(self):
        """Setup MCP tool handlers for multi-KB operations"""
        
        @self.app.list_tools()
        async def list_tools() -> List[types.Tool]:
            return [
                types.Tool(
                    name="search_all_knowledge_bases",
                    description="Search across all configured knowledge bases",
                    inputSchema={
                        "type": "object",
                        "required": ["query"],
                        "properties": {
                            "query": {
                                "type": "string",
                                "description": "Search query to find relevant documents"
                            },
                            "limit": {
                                "type": "number",
                                "description": "Maximum number of results per knowledge base (default: 3)",
                                "minimum": 1,
                                "maximum": 10
                            }
                        }
                    }
                ),
                types.Tool(
                    name="search_specific_knowledge_bases",
                    description="Search specific knowledge bases by name or ID",
                    inputSchema={
                        "type": "object",
                        "required": ["query", "knowledge_bases"],
                        "properties": {
                            "query": {
                                "type": "string",
                                "description": "Search query to find relevant documents"
                            },
                            "knowledge_bases": {
                                "type": "array",
                                "items": {"type": "string"},
                                "description": "List of knowledge base names or IDs to search"
                            },
                            "limit": {
                                "type": "number",
                                "description": "Maximum number of results per knowledge base (default: 5)",
                                "minimum": 1,
                                "maximum": 10
                            }
                        }
                    }
                ),
                types.Tool(
                    name="list_available_knowledge_bases",
                    description="List all available knowledge bases",
                    inputSchema={
                        "type": "object",
                        "properties": {}
                    }
                )
            ]
        
        @self.app.call_tool()
        async def call_tool(name: str, arguments: Dict[str, Any]) -> List[types.ContentBlock]:
            try:
                if name == "search_all_knowledge_bases":
                    query = arguments.get("query", "")
                    limit = arguments.get("limit", 3)
                    
                    if not query:
                        return [types.TextContent(
                            type="text",
                            text="Error: Query parameter is required"
                        )]
                    
                    all_results = []
                    for kb_id, kb_info in self.kb_data.items():
                        # Get KB configuration for search settings
                        kb_config = kb_info.get("config", {})
                        embedding_model = kb_config.get("embedding_model", "all-MiniLM-L6-v2")
                        search_config = kb_config.get("search", {})
                        use_hybrid = search_config.get("hybrid_search", False)
                        
                        results = vector_service.search(
                            kb_id=kb_id,
                            query=query,
                            limit=limit,
                            embedding_model=embedding_model,
                            use_hybrid=use_hybrid,
                            hybrid_alpha=search_config.get("hybrid_alpha", 0.5),
                            bm25_k1=search_config.get("bm25_k1", 1.5),
                            bm25_b=search_config.get("bm25_b", 0.75)
                        )
                        if results:
                            all_results.append({
                                'kb_name': kb_info['name'],
                                'kb_id': kb_id,
                                'results': results
                            })
                    
                    if not all_results:
                        return [types.TextContent(
                            type="text",
                            text=f"No results found for query: '{query}'"
                        )]
                    
                    # Format results by knowledge base
                    formatted_output = [f"Search results for '{query}' across all knowledge bases:\n"]
                    
                    for kb_results in all_results:
                        formatted_output.append(f"\n## {kb_results['kb_name']}")
                        for i, result in enumerate(kb_results['results'], 1):
                            formatted_output.append(
                                f"**{i}.** {result.get('filename', 'Unknown')} "
                                f"(Score: {result.get('similarity_score', 0):.3f})\n"
                                f"{result.get('content', '')}\n"
                            )
                    
                    return [types.TextContent(
                        type="text",
                        text="\n".join(formatted_output)
                    )]
                
                elif name == "search_specific_knowledge_bases":
                    query = arguments.get("query", "")
                    kb_names_or_ids = arguments.get("knowledge_bases", [])
                    limit = arguments.get("limit", 5)
                    
                    if not query or not kb_names_or_ids:
                        return [types.TextContent(
                            type="text",
                            text="Error: Both query and knowledge_bases parameters are required"
                        )]
                    
                    # Find matching knowledge bases
                    target_kbs = {}
                    for kb_id, kb_info in self.kb_data.items():
                        if (kb_id in kb_names_or_ids or 
                            kb_info['name'] in kb_names_or_ids):
                            target_kbs[kb_id] = kb_info
                    
                    if not target_kbs:
                        return [types.TextContent(
                            type="text",
                            text=f"No matching knowledge bases found for: {kb_names_or_ids}"
                        )]
                    
                    all_results = []
                    for kb_id, kb_info in target_kbs.items():
                        # Get KB configuration for search settings
                        kb_config = kb_info.get("config", {})
                        embedding_model = kb_config.get("embedding_model", "all-MiniLM-L6-v2")
                        search_config = kb_config.get("search", {})
                        use_hybrid = search_config.get("hybrid_search", False)
                        
                        results = vector_service.search(
                            kb_id=kb_id,
                            query=query,
                            limit=limit,
                            embedding_model=embedding_model,
                            use_hybrid=use_hybrid,
                            hybrid_alpha=search_config.get("hybrid_alpha", 0.5),
                            bm25_k1=search_config.get("bm25_k1", 1.5),
                            bm25_b=search_config.get("bm25_b", 0.75)
                        )
                        if results:
                            all_results.append({
                                'kb_name': kb_info['name'],
                                'kb_id': kb_id,
                                'results': results
                            })
                    
                    if not all_results:
                        return [types.TextContent(
                            type="text",
                            text=f"No results found for query: '{query}'"
                        )]
                    
                    # Format results
                    formatted_output = [f"Search results for '{query}' in selected knowledge bases:\n"]
                    
                    for kb_results in all_results:
                        formatted_output.append(f"\n## {kb_results['kb_name']}")
                        for i, result in enumerate(kb_results['results'], 1):
                            formatted_output.append(
                                f"**{i}.** {result.get('filename', 'Unknown')} "
                                f"(Score: {result.get('similarity_score', 0):.3f})\n"
                                f"{result.get('content', '')}\n"
                            )
                    
                    return [types.TextContent(
                        type="text",
                        text="\n".join(formatted_output)
                    )]
                
                elif name == "list_available_knowledge_bases":
                    kb_list = []
                    for kb_id, kb_info in self.kb_data.items():
                        stats = kb_service.get_knowledge_base_stats(kb_id)
                        kb_list.append(
                            f"- **{kb_info['name']}** (ID: {kb_id})\n"
                            f"  Description: {kb_info.get('description', 'No description')}\n"
                            f"  Files: {stats.get('file_count', 0)}, "
                            f"Chunks: {stats.get('total_chunks', 0)}"
                        )
                    
                    return [types.TextContent(
                        type="text",
                        text="Available Knowledge Bases:\n\n" + "\n\n".join(kb_list)
                    )]
                
                else:
                    return [types.TextContent(
                        type="text",
                        text=f"Unknown tool: {name}"
                    )]
                    
            except Exception as e:
                logger.error(f"Error in multi-KB MCP tool {name}: {str(e)}")
                return [types.TextContent(
                    type="text",
                    text=f"Error executing {name}: {str(e)}"
                )]
    
    async def handle_streamable_http(self, scope: Scope, receive: Receive, send: Send) -> None:
        """Handle streamable HTTP requests"""
        await self.session_manager.handle_request(scope, receive, send)
    
    @contextlib.asynccontextmanager
    async def lifespan(self, app: Starlette) -> AsyncIterator[None]:
        """Context manager for session manager"""
        async with self.session_manager.run():
            logger.info(f"Multi-KB MCP server started on port {self.port}")
            try:
                yield
            finally:
                logger.info("Multi-KB MCP server shutting down...")
    
    def create_starlette_app(self) -> Starlette:
        """Create the Starlette ASGI application"""
        starlette_app = Starlette(
            debug=True,
            routes=[
                Mount("/mcp", app=self.handle_streamable_http),
            ],
            lifespan=self.lifespan,
        )
        
        # Add CORS middleware
        starlette_app = CORSMiddleware(
            starlette_app,
            allow_origins=["*"],
            allow_methods=["GET", "POST", "DELETE"],
            expose_headers=["Mcp-Session-Id"],
        )
        
        return starlette_app


class MCPServerManager:
    """Manages MCP servers for knowledge bases"""
    
    def __init__(self):
        self.config_file = "knowledge-bases/mcp_config.json"
        self.running_servers = {}  # server_id -> (thread, uvicorn_server)
        self.load_config()
        self.load_app_config()
    
    def load_app_config(self):
        """Load application configuration for MCP port settings"""
        try:
            import json
            from pathlib import Path
            config_path = Path(__file__).parent.parent.parent.parent / "config.json"
            with open(config_path, 'r') as f:
                app_config = json.load(f)
                self.mcp_start_port = app_config.get("mcp", {}).get("start_port", 8100)
                self.mcp_max_port = app_config.get("mcp", {}).get("max_port", 8200)
        except Exception as e:
            logger.warning(f"Could not load app config: {e}, using defaults")
            self.mcp_start_port = 8100
            self.mcp_max_port = 8200
    
    def load_config(self):
        """Load MCP server configuration"""
        try:
            if os.path.exists(self.config_file):
                with open(self.config_file, 'r') as f:
                    self.config = json.load(f)
            else:
                self.config = {"mcp_servers": {}}
        except Exception as e:
            logger.error(f"Error loading MCP config: {e}")
            self.config = {"mcp_servers": {}}
    
    def save_config(self):
        """Save MCP server configuration"""
        try:
            os.makedirs(os.path.dirname(self.config_file), exist_ok=True)
            with open(self.config_file, 'w') as f:
                json.dump(self.config, f, indent=2)
        except Exception as e:
            logger.error(f"Error saving MCP config: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to save MCP config: {e}")
    
    def create_single_kb_server(self, kb_id: str, server_name: str, description: str, 
                               instructions: str, port: Optional[int] = None) -> dict:
        """Create MCP server for a single knowledge base"""
        # Get knowledge base info
        kb_data = kb_service.get_knowledge_base(kb_id)
        if not kb_data:
            raise HTTPException(status_code=404, detail="Knowledge base not found")
        
        # Generate server ID and assign port
        server_id = str(uuid.uuid4())
        if port is None:
            port = self._get_next_available_port()
        
        # Create server config (disabled by default)
        server_config = {
            "id": server_id,
            "kb_id": kb_id,
            "kb_name": kb_data['name'],
            "server_name": server_name,
            "description": description,
            "instructions": instructions,
            "created_date": datetime.now().isoformat(),
            "enabled": False,  # Disabled by default
            "port": port,
            "base_url": f"http://localhost:{port}/mcp",
            "status": "stopped",
            "error_message": None
        }
        
        # Save to config
        self.config["mcp_servers"][server_id] = server_config
        self.save_config()
        
        return server_config
    
    def create_multi_kb_server(self, kb_ids: List[str], server_name: str, 
                              description: str, instructions: str, 
                              port: Optional[int] = None) -> dict:
        """Create MCP server for multiple knowledge bases"""
        # Validate knowledge bases exist
        kb_names = []
        for kb_id in kb_ids:
            kb_data = kb_service.get_knowledge_base(kb_id)
            if not kb_data:
                raise HTTPException(status_code=404, detail=f"Knowledge base {kb_id} not found")
            kb_names.append(kb_data['name'])
        
        # Generate server ID and assign port
        server_id = str(uuid.uuid4())
        if port is None:
            port = self._get_next_available_port()
        
        # Create server config (disabled by default)
        server_config = {
            "id": server_id,
            "kb_ids": kb_ids,
            "kb_names": kb_names,
            "server_name": server_name,
            "description": description,
            "instructions": instructions,
            "created_date": datetime.now().isoformat(),
            "enabled": False,  # Disabled by default
            "port": port,
            "base_url": f"http://localhost:{port}/mcp",
            "type": "multi_kb",
            "status": "stopped",
            "error_message": None
        }
        
        # Save to config
        self.config["mcp_servers"][server_id] = server_config
        self.save_config()
        
        return server_config
    
    def _get_next_available_port(self) -> int:
        """Get next available port starting from configured MCP start port"""
        from ..utils.port_utils import find_available_port
        
        used_ports = set()
        for server in self.config["mcp_servers"].values():
            used_ports.add(server.get("port", self.mcp_start_port))
        
        # Start checking from mcp_start_port
        port = self.mcp_start_port
        while port in used_ports and port <= self.mcp_max_port:
            port += 1
        
        # If we've gone through all used ports, find an actually available port
        if port > self.mcp_max_port:
            logger.error(f"All MCP ports exhausted between {self.mcp_start_port} and {self.mcp_max_port}")
            raise RuntimeError(f"No available MCP ports in range {self.mcp_start_port}-{self.mcp_max_port}")
        
        # Check if the port is actually available on the system
        available_port = find_available_port(port, self.mcp_max_port, "0.0.0.0")
        if available_port is None:
            raise RuntimeError(f"Could not find available port between {port} and {self.mcp_max_port}")
        
        return available_port
    
    def list_servers(self) -> List[dict]:
        """List all MCP servers"""
        return list(self.config["mcp_servers"].values())
    
    def get_server(self, server_id: str) -> Optional[dict]:
        """Get specific MCP server config"""
        return self.config["mcp_servers"].get(server_id)
    
    def update_server_instructions(self, server_id: str, instructions: str) -> bool:
        """Update MCP server instructions and restart if running"""
        if server_id not in self.config["mcp_servers"]:
            return False
        
        # Check if server is currently running
        was_enabled = self.config["mcp_servers"][server_id].get("enabled", False)
        
        # Update instructions in config
        self.config["mcp_servers"][server_id]["instructions"] = instructions
        self.save_config()
        
        # Restart server if it was running to apply new instructions
        if was_enabled and server_id in self.running_servers:
            logger.info(f"Restarting MCP server {server_id} to apply updated instructions")
            self.stop_server(server_id)
            self.start_server(server_id)
        
        logger.info(f"Updated instructions for MCP server {server_id}")
        return True
    
    def update_tool_descriptions(self, server_id: str, tool_descriptions: Dict[str, str]) -> bool:
        """Update MCP server tool descriptions and restart if running"""
        if server_id not in self.config["mcp_servers"]:
            return False
        
        # Check if server is currently running
        was_enabled = self.config["mcp_servers"][server_id].get("enabled", False)
        
        # Update tool descriptions in config
        self.config["mcp_servers"][server_id]["tool_descriptions"] = tool_descriptions
        self.save_config()
        
        # Restart server if it was running to apply new tool descriptions
        if was_enabled and server_id in self.running_servers:
            logger.info(f"Restarting MCP server {server_id} to apply updated tool descriptions")
            self.stop_server(server_id)
            self.start_server(server_id)
        
        logger.info(f"Updated tool descriptions for MCP server {server_id}")
        return True
    
    def delete_server(self, server_id: str) -> bool:
        """Delete MCP server (public method with protection)"""
        if server_id not in self.config["mcp_servers"]:
            return False
        
        server_config = self.config["mcp_servers"][server_id]
        
        # Check if this is a default assigned server (cannot be deleted)
        server_name = server_config.get("server_name", "")
        if server_name.endswith(" - assigned"):
            logger.warning(f"Cannot delete default assigned MCP server: {server_name}")
            raise HTTPException(
                status_code=400, 
                detail="Cannot delete default assigned MCP server. Default servers are automatically managed."
            )
        
        return self._delete_server_internal(server_id)
    
    def _delete_server_internal(self, server_id: str) -> bool:
        """Internal method to delete MCP server (bypasses protection)"""
        if server_id not in self.config["mcp_servers"]:
            return False
        
        # Stop server if running
        self.stop_server(server_id)
        
        # Remove from config
        del self.config["mcp_servers"][server_id]
        self.save_config()
        return True
    
    def delete_servers_for_kb(self, kb_id: str) -> int:
        """Delete all MCP servers for a knowledge base (including assigned servers)"""
        deleted_count = 0
        servers_to_delete = []
        
        # Find all servers for this KB
        for server_id, server_config in self.config["mcp_servers"].items():
            if server_config.get('kb_id') == kb_id:
                servers_to_delete.append(server_id)
        
        # Delete all found servers using internal method
        for server_id in servers_to_delete:
            if self._delete_server_internal(server_id):
                deleted_count += 1
                logger.info(f"Deleted MCP server {server_id} for KB {kb_id}")
        
        return deleted_count
    
    def _run_mcp_server_in_thread(self, server_config: dict) -> None:
        """Run MCP server in a separate thread"""
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
                    logger.error(f"Knowledge base {kb_id} not found")
                    return
                mcp_server = KnowledgeBaseMCPServer(kb_id, kb_data, server_config)
            
            # Create the Starlette app
            app = mcp_server.create_starlette_app()
            
            # Create uvicorn config - use 127.0.0.1 for security
            config = uvicorn.Config(
                app=app,
                host="127.0.0.1",
                port=server_config["port"],
                log_level="info"
            )
            
            # Create and store the uvicorn server
            uvicorn_server = uvicorn.Server(config)
            
            # Store the server reference for shutdown
            if server_config["id"] in self.running_servers:
                thread, _ = self.running_servers[server_config["id"]]
                self.running_servers[server_config["id"]] = (thread, uvicorn_server)
            
            # Run the server
            asyncio.run(uvicorn_server.serve())
            
        except Exception as e:
            logger.error(f"Error running MCP server {server_config['id']}: {e}")
    
    def start_server(self, server_id: str) -> bool:
        """Start MCP server in a thread"""
        if server_id not in self.config["mcp_servers"]:
            return False
        
        server_config = self.config["mcp_servers"][server_id]
        
        # Check if already running
        if server_id in self.running_servers:
            thread, uvicorn_server = self.running_servers[server_id]
            if thread.is_alive():
                logger.info(f"MCP server {server_id} is already running")
                return True
            else:
                # Thread died, remove from running servers
                del self.running_servers[server_id]
        
        try:
            # Clear any previous error message
            self.config["mcp_servers"][server_id]["error_message"] = None
            self.config["mcp_servers"][server_id]["status"] = "starting"
            self.save_config()
            
            # Create and start thread
            thread = threading.Thread(
                target=self._run_mcp_server_in_thread,
                args=(server_config,),
                daemon=True,
                name=f"MCP-Server-{server_id[:8]}"
            )
            
            # Store the thread (uvicorn_server will be set by the thread)
            self.running_servers[server_id] = (thread, None)
            
            # Start the thread
            thread.start()
            
            # Update config
            self.config["mcp_servers"][server_id]["enabled"] = True
            self.config["mcp_servers"][server_id]["status"] = "running"
            self.save_config()
            
            logger.info(f"Started MCP server {server_id} on port {server_config['port']}")
            return True
            
        except Exception as e:
            error_msg = f"Error starting MCP server {server_id}: {e}"
            logger.error(error_msg)
            
            # Update status with error
            self.config["mcp_servers"][server_id]["enabled"] = False
            self.config["mcp_servers"][server_id]["status"] = "error"
            self.config["mcp_servers"][server_id]["error_message"] = str(e)
            self.save_config()
            
            return False
    
    def stop_server(self, server_id: str) -> bool:
        """Stop MCP server thread"""
        if server_id not in self.config["mcp_servers"]:
            return False
        
        try:
            # Stop the server if running
            if server_id in self.running_servers:
                thread, uvicorn_server = self.running_servers[server_id]
                
                # Try to gracefully shutdown uvicorn server
                if uvicorn_server:
                    uvicorn_server.should_exit = True
                
                # Wait for thread to finish
                if thread.is_alive():
                    thread.join(timeout=5)
                
                del self.running_servers[server_id]
            
            # Update config
            self.config["mcp_servers"][server_id]["enabled"] = False
            self.config["mcp_servers"][server_id]["status"] = "stopped"
            self.config["mcp_servers"][server_id]["error_message"] = None
            self.save_config()
            
            logger.info(f"Stopped MCP server {server_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error stopping MCP server {server_id}: {e}")
            return False
    
    def startup_enabled_servers(self) -> None:
        """Start all enabled MCP servers on service startup"""
        logger.info("Starting enabled MCP servers...")
        
        enabled_servers = []
        for server_id, server_config in self.config["mcp_servers"].items():
            if server_config.get("enabled", False):
                enabled_servers.append((server_id, server_config))
        
        if not enabled_servers:
            logger.info("No enabled MCP servers found")
            return
        
        started_count = 0
        failed_count = 0
        
        for server_id, server_config in enabled_servers:
            try:
                logger.info(f"Starting MCP server: {server_config.get('server_name', server_id)}")
                if self.start_server(server_id):
                    started_count += 1
                else:
                    failed_count += 1
            except Exception as e:
                logger.error(f"Failed to start MCP server {server_id}: {e}")
                # Update status with error
                self.config["mcp_servers"][server_id]["enabled"] = False
                self.config["mcp_servers"][server_id]["status"] = "error"
                self.config["mcp_servers"][server_id]["error_message"] = str(e)
                failed_count += 1
        
        # Save any status updates
        if failed_count > 0:
            self.save_config()
        
        logger.info(f"MCP server startup complete: {started_count} started, {failed_count} failed")


# Global MCP server manager instance
mcp_manager = MCPServerManager()
