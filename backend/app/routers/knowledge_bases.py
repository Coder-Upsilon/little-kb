from fastapi import APIRouter, HTTPException, Depends
from typing import List
from app.models.schemas import (
    KnowledgeBaseCreate, 
    KnowledgeBaseResponse, 
    KnowledgeBaseUpdate,
    ErrorResponse
)
from app.services.knowledge_base_service import kb_service
from app.services.vector_service import vector_service
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/", response_model=KnowledgeBaseResponse)
async def create_knowledge_base(kb_data: KnowledgeBaseCreate):
    """Create a new knowledge base"""
    try:
        # Create knowledge base
        kb = kb_service.create_knowledge_base(
            name=kb_data.name,
            description=kb_data.description
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
        kb = kb_service.update_knowledge_base(
            kb_id=kb_id,
            name=kb_update.name,
            description=kb_update.description
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

@router.post("/{kb_id}/reindex")
async def reindex_knowledge_base(kb_id: str):
    """Reindex all documents in a knowledge base"""
    try:
        # Check if KB exists
        kb = kb_service.get_knowledge_base(kb_id)
        if not kb:
            raise HTTPException(status_code=404, detail="Knowledge base not found")
        
        # Get all documents in KB
        documents = kb_service.list_documents(kb_id)
        
        if not documents:
            return {"message": "No documents to reindex"}
        
        # Delete existing vector collection
        vector_service.delete_collection(kb_id)
        
        # Create new collection
        success = vector_service.create_collection(kb_id)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to create new vector collection")
        
        # Reprocess all documents
        from app.services.file_processor import file_processor
        
        reindexed_count = 0
        failed_count = 0
        
        for doc in documents:
            try:
                # Process file again
                result = file_processor.process_file(
                    doc["file_path"], 
                    doc["filename"], 
                    kb_id
                )
                
                if result["success"]:
                    # Add to vector storage
                    vector_data = [{
                        "document_id": doc["id"],
                        "filename": doc["filename"],
                        "file_type": doc["file_type"],
                        "chunks": result["chunks"]
                    }]
                    
                    vector_success = vector_service.add_documents(kb_id, vector_data)
                    if vector_success:
                        reindexed_count += 1
                    else:
                        failed_count += 1
                else:
                    failed_count += 1
                    
            except Exception as e:
                logger.error(f"Error reindexing document {doc['id']}: {str(e)}")
                failed_count += 1
        
        return {
            "message": f"Reindexing completed",
            "reindexed_count": reindexed_count,
            "failed_count": failed_count,
            "total_documents": len(documents)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error reindexing knowledge base {kb_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")
