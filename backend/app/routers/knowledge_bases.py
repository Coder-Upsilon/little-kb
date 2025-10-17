from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from typing import List, Dict, Any
from app.models.schemas import (
    KnowledgeBaseCreate, 
    KnowledgeBaseResponse, 
    KnowledgeBaseUpdate,
    ErrorResponse
)
from app.services.knowledge_base_service import kb_service
from app.services.vector_service import vector_service
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

router = APIRouter()

# In-memory progress tracking
reindex_progress: Dict[str, Dict[str, Any]] = {}

# In-memory KB lock tracking (during reindex, prevent uploads/config changes)
kb_locks: Dict[str, bool] = {}

@router.post("/", response_model=KnowledgeBaseResponse)
async def create_knowledge_base(kb_data: KnowledgeBaseCreate):
    """Create a new knowledge base"""
    try:
        # Create knowledge base
        config_dict = kb_data.config.model_dump() if kb_data.config else None
        kb = kb_service.create_knowledge_base(
            name=kb_data.name,
            description=kb_data.description,
            config=config_dict
        )
        
        # Create vector collection
        success = vector_service.create_collection(kb["id"])
        if not success:
            # Rollback KB creation if vector collection fails
            kb_service.delete_knowledge_base(kb["id"])
            raise HTTPException(
                status_code=500,
                detail="Failed to create vector collection"
            )
        
        return KnowledgeBaseResponse(**kb)
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating knowledge base: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/{kb_id}/mcp-server")
async def get_knowledge_base_mcp_server(kb_id: str):
    """Get the MCP server for a knowledge base"""
    try:
        # Check if KB exists
        kb = kb_service.get_knowledge_base(kb_id)
        if not kb:
            raise HTTPException(status_code=404, detail="Knowledge base not found")
        
        # Get MCP server for this KB
        mcp_server = kb_service.get_kb_mcp_server(kb_id)
        
        if not mcp_server:
            return {"message": "No MCP server found for this knowledge base", "mcp_server": None}
        
        return {"mcp_server": mcp_server}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting MCP server for knowledge base {kb_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/", response_model=List[KnowledgeBaseResponse])
async def list_knowledge_bases():
    """List all knowledge bases"""
    try:
        kbs = kb_service.list_knowledge_bases()
        return [KnowledgeBaseResponse(**kb) for kb in kbs]
    except Exception as e:
        logger.error(f"Error listing knowledge bases: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/{kb_id}", response_model=KnowledgeBaseResponse)
async def get_knowledge_base(kb_id: str):
    """Get a specific knowledge base"""
    try:
        kb = kb_service.get_knowledge_base(kb_id)
        if not kb:
            raise HTTPException(status_code=404, detail="Knowledge base not found")
        
        return KnowledgeBaseResponse(**kb)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting knowledge base {kb_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.put("/{kb_id}", response_model=KnowledgeBaseResponse)
async def update_knowledge_base(kb_id: str, kb_update: KnowledgeBaseUpdate):
    """Update a knowledge base"""
    try:
        config_dict = kb_update.config.model_dump() if kb_update.config else None
        kb = kb_service.update_knowledge_base(
            kb_id=kb_id,
            name=kb_update.name,
            description=kb_update.description,
            config=config_dict
        )
        
        if not kb:
            raise HTTPException(status_code=404, detail="Knowledge base not found")
        
        return KnowledgeBaseResponse(**kb)
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating knowledge base {kb_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.delete("/{kb_id}")
async def delete_knowledge_base(kb_id: str):
    """Delete a knowledge base and all its data"""
    try:
        # Check if KB exists
        kb = kb_service.get_knowledge_base(kb_id)
        if not kb:
            raise HTTPException(status_code=404, detail="Knowledge base not found")
        
        # Delete vector collection
        vector_service.delete_collection(kb_id)
        
        # Delete knowledge base
        success = kb_service.delete_knowledge_base(kb_id)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to delete knowledge base")
        
        return {"message": "Knowledge base deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting knowledge base {kb_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/{kb_id}/stats")
async def get_knowledge_base_stats(kb_id: str):
    """Get statistics for a knowledge base"""
    try:
        # Check if KB exists
        kb = kb_service.get_knowledge_base(kb_id)
        if not kb:
            raise HTTPException(status_code=404, detail="Knowledge base not found")
        
        # Get stats from KB service
        kb_stats = kb_service.get_kb_stats(kb_id)
        
        # Get vector collection stats
        vector_stats = vector_service.get_collection_stats(kb_id)
        
        # Combine stats
        stats = {
            **kb_stats,
            "vector_chunks": vector_stats.get("total_chunks", 0)
        }
        
        return stats
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting stats for knowledge base {kb_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/{kb_id}/config")
async def get_knowledge_base_config(kb_id: str):
    """Get configuration for a knowledge base"""
    try:
        kb = kb_service.get_knowledge_base(kb_id)
        if not kb:
            raise HTTPException(status_code=404, detail="Knowledge base not found")
        
        return kb.get("config", {})
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting config for KB {kb_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.put("/{kb_id}/config")
async def update_knowledge_base_config(kb_id: str, config: dict):
    """Update configuration for a knowledge base"""
    try:
        kb = kb_service.get_knowledge_base(kb_id)
        if not kb:
            raise HTTPException(status_code=404, detail="Knowledge base not found")
        
        # Update config
        updated_kb = kb_service.update_knowledge_base(
            kb_id=kb_id,
            config=config
        )
        
        if not updated_kb:
            raise HTTPException(status_code=404, detail="Knowledge base not found")
        
        return {"message": "Configuration updated successfully", "config": updated_kb.get("config", {})}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating config for KB {kb_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/config/embedding-models")
async def get_available_embedding_models():
    """Get list of available embedding models"""
    import json
    from pathlib import Path
    
    try:
        config_path = Path(__file__).parent.parent.parent.parent / "config.json"
        with open(config_path, 'r') as f:
            app_config = json.load(f)
            models = app_config.get("embedding", {}).get("available_models", [])
            return {"models": models}
    except Exception as e:
        logger.error(f"Error loading embedding models: {str(e)}")
        # Return default models if config can't be loaded
        return {
            "models": [
                {
                    "id": "all-MiniLM-L6-v2",
                    "name": "MiniLM L6 v2 (Fast, Lightweight)",
                    "dimensions": 384,
                    "size_mb": 80,
                    "description": "Fast and efficient, good for general purpose"
                },
                {
                    "id": "all-mpnet-base-v2",
                    "name": "MPNet Base v2 (Balanced, Recommended)",
                    "dimensions": 768,
                    "size_mb": 420,
                    "description": "Best balance of quality and speed, recommended for most use cases"
                },
                {
                    "id": "BAAI/bge-large-en-v1.5",
                    "name": "BGE Large (High Quality)",
                    "dimensions": 1024,
                    "size_mb": 1340,
                    "description": "State-of-the-art quality, slightly slower"
                },
                {
                    "id": "BAAI/bge-base-en-v1.5",
                    "name": "BGE Base (Good Quality)",
                    "dimensions": 768,
                    "size_mb": 420,
                    "description": "Good quality with reasonable speed"
                }
            ]
        }

def _perform_reindex(kb_id: str, kb: dict, documents: list):
    """Background task to perform reindexing with zero downtime"""
    from app.services.file_processor import file_processor
    
    total = len(documents)
    reindexed_count = 0
    failed_count = 0
    temp_collection_id = f"{kb_id}_temp_reindex"
    
    try:
        # Lock the KB
        kb_locks[kb_id] = True
        
        # Initialize progress
        reindex_progress[kb_id] = {
            "status": "in_progress",
            "total": total,
            "processed": 0,
            "succeeded": 0,
            "failed": 0,
            "percentage": 0,
            "current_file": None,
            "current_file_progress": 0,
            "started_at": datetime.now().isoformat(),
            "can_cancel": True
        }
        
        # Create temporary collection (old one stays active)
        success = vector_service.create_collection(temp_collection_id)
        if not success:
            logger.error(f"Failed to create temporary vector collection for KB {kb_id}")
            reindex_progress[kb_id]["status"] = "error"
            reindex_progress[kb_id]["error"] = "Failed to create temporary vector collection"
            kb_locks[kb_id] = False
            return
        
        # Reprocess all documents into TEMP collection (old stays active)
        for idx, doc in enumerate(documents):
            # Check if cancelled
            if kb_id in reindex_progress and reindex_progress[kb_id].get("status") == "cancelled":
                logger.info(f"Reindex cancelled for KB {kb_id}")
                vector_service.delete_collection(temp_collection_id)
                kb_locks[kb_id] = False
                return
            
            try:
                # Update current file
                reindex_progress[kb_id]["current_file"] = doc["filename"]
                reindex_progress[kb_id]["current_file_progress"] = 0
                
                # Get KB config for chunking settings
                kb_config = kb.get("config", {})
                chunking_config = kb_config.get("chunking", {})
                
                # Process file again with KB's chunking settings
                result = file_processor.process_file(
                    doc["file_path"], 
                    doc["filename"], 
                    kb_id,
                    chunk_size=chunking_config.get("chunk_size"),
                    chunk_overlap=chunking_config.get("chunk_overlap"),
                    overlap_enabled=chunking_config.get("overlap_enabled", True)
                )
                
                if result["success"]:
                    # Update progress - extraction done, starting embedding
                    reindex_progress[kb_id]["current_file_progress"] = 10
                    
                    # Add to TEMP vector storage with KB's embedding model
                    embedding_model = kb_config.get("embedding_model", "all-MiniLM-L6-v2")
                    vector_data = [{
                        "document_id": doc["id"],
                        "filename": doc["filename"],
                        "file_type": doc["file_type"],
                        "chunks": result["chunks"]
                    }]
                    
                    # Progress callback to update current file progress
                    def update_embedding_progress(progress_pct):
                        if kb_id in reindex_progress:
                            reindex_progress[kb_id]["current_file_progress"] = progress_pct
                    
                    # Add to TEMP collection
                    vector_success = vector_service.add_documents(
                        temp_collection_id,  # Use temp collection!
                        vector_data, 
                        embedding_model,
                        progress_callback=update_embedding_progress
                    )
                    
                    # Update progress - embedding complete
                    reindex_progress[kb_id]["current_file_progress"] = 100
                    
                    if vector_success:
                        reindexed_count += 1
                    else:
                        failed_count += 1
                else:
                    failed_count += 1
                    
            except Exception as e:
                logger.error(f"Error reindexing document {doc['id']}: {str(e)}")
                failed_count += 1
            
            # Update progress
            processed = idx + 1
            reindex_progress[kb_id].update({
                "processed": processed,
                "succeeded": reindexed_count,
                "failed": failed_count,
                "percentage": round((processed / total) * 100, 1),
                "current_file": None if processed == total else reindex_progress[kb_id].get("current_file"),
                "current_file_progress": 0
            })
        
        # ATOMIC SWAP: Delete old collection and rename temp to production
        logger.info(f"Swapping collections for KB {kb_id}: deleting old, renaming temp")
        vector_service.delete_collection(kb_id)
        success = vector_service.rename_collection(temp_collection_id, kb_id)
        
        if not success:
            logger.error(f"Failed to rename temp collection for KB {kb_id}")
            reindex_progress[kb_id]["status"] = "error"
            reindex_progress[kb_id]["error"] = "Failed to swap collections"
            kb_locks[kb_id] = False
            return
        
        # Mark as completed
        reindex_progress[kb_id]["status"] = "completed"
        reindex_progress[kb_id]["completed_at"] = datetime.now().isoformat()
        reindex_progress[kb_id]["can_cancel"] = False
        
        # Unlock the KB
        kb_locks[kb_id] = False
        
        logger.info(f"Reindexing completed for KB {kb_id}: {reindexed_count} succeeded, {failed_count} failed")
        
    except Exception as e:
        logger.error(f"Error in background reindex for KB {kb_id}: {str(e)}")
        if kb_id in reindex_progress:
            reindex_progress[kb_id]["status"] = "error"
            reindex_progress[kb_id]["error"] = str(e)
            reindex_progress[kb_id]["can_cancel"] = False
        
        # Cleanup temp collection on error
        try:
            vector_service.delete_collection(temp_collection_id)
        except:
            pass
        
        # Unlock KB
        kb_locks[kb_id] = False

@router.get("/{kb_id}/reindex/progress")
async def get_reindex_progress(kb_id: str):
    """Get the progress of an ongoing reindex operation"""
    if kb_id not in reindex_progress:
        return {"status": "not_found", "message": "No reindex operation found for this knowledge base"}
    
    return reindex_progress[kb_id]

@router.post("/{kb_id}/reindex")
async def reindex_knowledge_base(kb_id: str, background_tasks: BackgroundTasks):
    """Start reindexing all documents in a knowledge base (runs in background)"""
    try:
        # Check if KB exists
        kb = kb_service.get_knowledge_base(kb_id)
        if not kb:
            raise HTTPException(status_code=404, detail="Knowledge base not found")
        
        # Get all documents in KB
        documents = kb_service.list_documents(kb_id)
        
        if not documents:
            return {"message": "No documents to reindex", "status": "completed"}
        
        # Check if already reindexing
        if kb_id in reindex_progress and reindex_progress[kb_id]["status"] == "in_progress":
            return {
                "message": "Reindex already in progress",
                "status": "in_progress",
                "progress": reindex_progress[kb_id]
            }
        
        # Add reindex task to background
        background_tasks.add_task(_perform_reindex, kb_id, kb, documents)
        
        return {
            "message": f"Reindexing started for {len(documents)} documents",
            "status": "in_progress",
            "total_documents": len(documents)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error starting reindex for knowledge base {kb_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")
