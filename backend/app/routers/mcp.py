from fastapi import APIRouter, HTTPException
from typing import List, Optional
from pydantic import BaseModel

from app.services.mcp_service import mcp_manager

router = APIRouter()

class CreateSingleKBServerRequest(BaseModel):
    kb_id: str
    server_name: str
    description: str
    instructions: str
    port: Optional[int] = None

class CreateMultiKBServerRequest(BaseModel):
    kb_ids: List[str]
    server_name: str
    description: str
    instructions: str
    port: Optional[int] = None

class UpdateMCPServerRequest(BaseModel):
    instructions: str

class UpdateToolDescriptionsRequest(BaseModel):
    tool_descriptions: dict

class MCPServerResponse(BaseModel):
    id: str
    server_name: str
    description: str
    instructions: str
    created_date: str
    enabled: bool
    port: int
    base_url: str
    kb_id: Optional[str] = None
    kb_name: Optional[str] = None
    kb_ids: Optional[List[str]] = None
    kb_names: Optional[List[str]] = None
    type: Optional[str] = None

@router.get("/", response_model=List[MCPServerResponse])
async def list_mcp_servers():
    """List all MCP servers"""
    try:
        servers = mcp_manager.list_servers()
        return servers
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list MCP servers: {str(e)}")

@router.get("/{server_id}", response_model=MCPServerResponse)
async def get_mcp_server(server_id: str):
    """Get specific MCP server"""
    try:
        server = mcp_manager.get_server(server_id)
        if not server:
            raise HTTPException(status_code=404, detail="MCP server not found")
        return server
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get MCP server: {str(e)}")

@router.post("/single-kb", response_model=MCPServerResponse)
async def create_single_kb_server(request: CreateSingleKBServerRequest):
    """Create MCP server for a single knowledge base"""
    try:
        server_config = mcp_manager.create_single_kb_server(
            kb_id=request.kb_id,
            server_name=request.server_name,
            description=request.description,
            instructions=request.instructions,
            port=request.port
        )
        return server_config
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create MCP server: {str(e)}")

@router.post("/multi-kb", response_model=MCPServerResponse)
async def create_multi_kb_server(request: CreateMultiKBServerRequest):
    """Create MCP server for multiple knowledge bases"""
    try:
        server_config = mcp_manager.create_multi_kb_server(
            kb_ids=request.kb_ids,
            server_name=request.server_name,
            description=request.description,
            instructions=request.instructions,
            port=request.port
        )
        return server_config
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create multi-KB MCP server: {str(e)}")

@router.post("/{server_id}/start")
async def start_mcp_server(server_id: str):
    """Start MCP server"""
    try:
        success = mcp_manager.start_server(server_id)
        if not success:
            raise HTTPException(status_code=404, detail="MCP server not found")
        return {"message": "MCP server started successfully", "server_id": server_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start MCP server: {str(e)}")

@router.post("/{server_id}/stop")
async def stop_mcp_server(server_id: str):
    """Stop MCP server"""
    try:
        success = mcp_manager.stop_server(server_id)
        if not success:
            raise HTTPException(status_code=404, detail="MCP server not found")
        return {"message": "MCP server stopped successfully", "server_id": server_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to stop MCP server: {str(e)}")

@router.put("/{server_id}")
async def update_mcp_server(server_id: str, request: UpdateMCPServerRequest):
    """Update MCP server instructions"""
    try:
        success = mcp_manager.update_server_instructions(server_id, request.instructions)
        if not success:
            raise HTTPException(status_code=404, detail="MCP server not found")
        return {"message": "MCP server updated successfully", "server_id": server_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update MCP server: {str(e)}")

@router.put("/{server_id}/tool-descriptions")
async def update_tool_descriptions(server_id: str, request: UpdateToolDescriptionsRequest):
    """Update MCP server tool descriptions"""
    try:
        success = mcp_manager.update_tool_descriptions(server_id, request.tool_descriptions)
        if not success:
            raise HTTPException(status_code=404, detail="MCP server not found")
        return {"message": "Tool descriptions updated successfully", "server_id": server_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update tool descriptions: {str(e)}")

@router.delete("/{server_id}")
async def delete_mcp_server(server_id: str):
    """Delete MCP server"""
    try:
        success = mcp_manager.delete_server(server_id)
        if not success:
            raise HTTPException(status_code=404, detail="MCP server not found")
        return {"message": "MCP server deleted successfully", "server_id": server_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete MCP server: {str(e)}")

@router.get("/{server_id}/config")
async def get_mcp_server_config(server_id: str):
    """Get MCP server configuration for different clients"""
    try:
        server = mcp_manager.get_server(server_id)
        if not server:
            raise HTTPException(status_code=404, detail="MCP server not found")
        
        base_url = server.get("base_url", "")
        # Remove " - assigned" suffix and replace spaces with hyphens for config key
        server_name = server.get("server_name", f"kb-server-{server_id[:8]}")
        server_name = server_name.replace(" - assigned", "").replace(" ", "-")
        kb_name = server.get("kb_name", "")
        
        # Get tool descriptions or use defaults
        tool_descriptions = server.get("tool_descriptions", {})
        default_descriptions = {
            "search_knowledge_base": f"Search the '{kb_name}' knowledge base using semantic search",
            "get_knowledge_base_info": f"Get information about the '{kb_name}' knowledge base",
            "list_documents": f"List all documents in the '{kb_name}' knowledge base"
        }
        
        # Get parameter descriptions or use defaults
        search_params = tool_descriptions.get("search_knowledge_base_params", {})
        default_search_params = {
            "query": "Search query to find relevant documents",
            "limit": "Maximum number of results to return (default: 5)"
        }
        
        # Claude Desktop config (using mcp-remote-client)
        claude_config = {
            "command": "npx",
            "args": ["-y", "mcp-remote-client", base_url],
            "disabled": not server.get("enabled", True),
            "autoApprove": []
        }
        
        # Cline config (direct URL with streamableHttp type)
        cline_config = {
            "url": base_url,
            "type": "streamableHttp",
            "disabled": not server.get("enabled", True),
            "autoApprove": []
        }
        
        return {
            "server_name": server_name,
            "configs": {
                "claude": claude_config,
                "cline": cline_config
            },
            "instructions": server.get("instructions", ""),
            "tool_descriptions": tool_descriptions,
            "default_tool_descriptions": default_descriptions,
            "parameter_descriptions": search_params,
            "default_parameter_descriptions": default_search_params,
            "base_url": base_url
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get MCP server config: {str(e)}")
