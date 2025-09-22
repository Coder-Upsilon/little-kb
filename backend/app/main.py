from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import knowledge_bases, files, search
import os

# Create directories if they don't exist
os.makedirs("../knowledge-bases", exist_ok=True)
os.makedirs("../vector-db", exist_ok=True)

app = FastAPI(
    title="Little KB API",
    description="Knowledge Base Management System with Vector Search",
    version="1.0.0"
)

# Configure CORS for frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # React dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(knowledge_bases.router, prefix="/api/knowledge-bases", tags=["knowledge-bases"])
app.include_router(files.router, prefix="/api/files", tags=["files"])
app.include_router(search.router, prefix="/api/search", tags=["search"])

@app.get("/")
async def root():
    return {"message": "Little KB API is running"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}
