from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import knowledge_bases, files, search, mcp
import os

# Create directories if they don't exist
os.makedirs("knowledge-bases", exist_ok=True)
os.makedirs("vector-db", exist_ok=True)

app = FastAPI(
    title="VectorVault API",
    description="Knowledge Base Management System with Vector Search",
    version="1.0.0"
)

# Configure CORS for frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],  # React dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(knowledge_bases.router, prefix="/api/knowledge-bases", tags=["knowledge-bases"])
app.include_router(files.router, prefix="/api/files", tags=["files"])
app.include_router(search.router, prefix="/api/search", tags=["search"])
app.include_router(mcp.router, prefix="/api/mcp", tags=["mcp"])

@app.get("/")
async def root():
    return {"message": "VectorVault API is running"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

@app.on_event("startup")
async def startup_event():
    """Initialize services on startup"""
    import logging
    logger = logging.getLogger(__name__)
    logger.info("Starting Little KB backend...")
    
    # Initialize vector database
    try:
        from app.services.vector_service import vector_service
        vector_service.initialize()
        logger.info("Vector service initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize vector service: {e}")
        # Don't raise - continue startup even if vector service fails
    
    # Start enabled MCP servers
    try:
        from app.services.mcp_service import mcp_manager
        mcp_manager.startup_enabled_servers()
        logger.info("MCP server startup completed")
    except Exception as e:
        logger.error(f"Failed to start MCP servers: {e}")
        # Don't raise - continue startup even if MCP servers fail
    
    logger.info("Little KB backend started successfully")
