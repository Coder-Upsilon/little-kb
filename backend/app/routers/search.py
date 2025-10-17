from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
import time
import logging
from app.models.schemas import SearchQuery, SearchResponse, SearchResult
from app.services.knowledge_base_service import kb_service
from app.services.vector_service import vector_service

logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/{kb_id}", response_model=SearchResponse)
async def search_knowledge_base(kb_id: str, search_query: SearchQuery):
    """Search for documents in a knowledge base using semantic search"""
    try:
        start_time = time.time()
        
        # Validate that kb_id matches the one in the query
        if search_query.kb_id != kb_id:
            raise HTTPException(
                status_code=400, 
                detail="Knowledge base ID in URL must match the one in query"
            )
        
        # Check if KB exists
        kb = kb_service.get_knowledge_base(kb_id)
        if not kb:
            raise HTTPException(status_code=404, detail="Knowledge base not found")
        
        # Check if vector collection exists
        if not vector_service.collection_exists(kb_id):
            raise HTTPException(
                status_code=404, 
                detail="No indexed documents found in this knowledge base"
            )
        
        # Get KB config
        kb_config = kb.get("config", {})
        embedding_model = kb_config.get("embedding_model", "all-MiniLM-L6-v2")
        search_config = kb_config.get("search", {})
        
        # Determine if we should use hybrid search
        use_hybrid = search_query.use_hybrid if search_query.use_hybrid is not None else search_config.get("hybrid_search", False)
        
        # Perform search with KB's settings
        search_results = vector_service.search(
            kb_id=kb_id,
            query=search_query.query,
            limit=search_query.limit,
            embedding_model=embedding_model,
            use_hybrid=use_hybrid,
            hybrid_alpha=search_config.get("hybrid_alpha", 0.5),
            bm25_k1=search_config.get("bm25_k1", 1.5),
            bm25_b=search_config.get("bm25_b", 0.75)
        )
        
        # Convert to response format
        results = []
        search_type = "hybrid" if use_hybrid else "vector"
        
        for result in search_results:
            results.append(SearchResult(
                content=result["content"],
                filename=result["filename"],
                file_type=result["file_type"],
                similarity_score=result["similarity_score"],
                chunk_index=result["chunk_index"],
                bm25_score=result.get("bm25_score"),
                hybrid_score=result.get("hybrid_score")
            ))
        
        processing_time = time.time() - start_time
        
        return SearchResponse(
            query=search_query.query,
            results=results,
            total_results=len(results),
            processing_time=round(processing_time, 3),
            search_type=search_type
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error searching knowledge base {kb_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Search failed")

@router.get("/{kb_id}")
async def search_knowledge_base_get(
    kb_id: str,
    q: str = Query(..., description="Search query"),
    limit: int = Query(10, ge=1, le=50, description="Maximum number of results")
):
    """Search for documents using GET request (for simple queries)"""
    try:
        # Create search query object
        search_query = SearchQuery(
            query=q,
            kb_id=kb_id,
            limit=limit
        )
        
        # Use the POST endpoint logic
        return await search_knowledge_base(kb_id, search_query)
        
    except Exception as e:
        logger.error(f"Error in GET search for KB {kb_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Search failed")

@router.get("/{kb_id}/similar/{document_id}")
async def find_similar_documents(
    kb_id: str, 
    document_id: str,
    limit: int = Query(5, ge=1, le=20, description="Maximum number of similar documents")
):
    """Find documents similar to a specific document"""
    try:
        # Check if KB exists
        kb = kb_service.get_knowledge_base(kb_id)
        if not kb:
            raise HTTPException(status_code=404, detail="Knowledge base not found")
        
        # Check if document exists
        doc = kb_service.get_document(document_id)
        if not doc or doc["kb_id"] != kb_id:
            raise HTTPException(status_code=404, detail="Document not found")
        
        # Get document content from vector store to use as query
        # This is a simplified approach - in practice, you might want to
        # use the document's embedding directly
        collection_name = f"kb_{kb_id}"
        try:
            from app.services.vector_service import vector_service
            collection = vector_service.chroma_client.get_collection(name=collection_name)
            
            # Get all chunks for this document
            doc_results = collection.get(
                where={"document_id": document_id},
                include=["documents"]
            )
            
            if not doc_results['documents']:
                raise HTTPException(status_code=404, detail="Document content not found in vector store")
            
            # Use the first chunk as the query (could be improved)
            query_text = doc_results['documents'][0]
            
            # Get KB config
            kb_config = kb.get("config", {})
            embedding_model = kb_config.get("embedding_model", "all-MiniLM-L6-v2")
            
            # Search for similar content, excluding the source document
            search_results = vector_service.search(
                kb_id=kb_id,
                query=query_text,
                limit=limit + 10,  # Get extra results to filter out source document
                embedding_model=embedding_model
            )
            
            # Filter out chunks from the source document
            filtered_results = []
            seen_documents = set()
            
            for result in search_results:
                if result["document_id"] != document_id:
                    # Only include one result per document
                    if result["document_id"] not in seen_documents:
                        filtered_results.append(SearchResult(
                            content=result["content"],
                            filename=result["filename"],
                            file_type=result["file_type"],
                            similarity_score=result["similarity_score"],
                            chunk_index=result["chunk_index"]
                        ))
                        seen_documents.add(result["document_id"])
                        
                        if len(filtered_results) >= limit:
                            break
            
            return {
                "source_document": {
                    "id": document_id,
                    "filename": doc["filename"],
                    "file_type": doc["file_type"]
                },
                "similar_documents": filtered_results,
                "total_results": len(filtered_results)
            }
            
        except Exception as e:
            logger.error(f"Error finding similar documents: {str(e)}")
            raise HTTPException(status_code=500, detail="Failed to find similar documents")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error finding similar documents for {document_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/{kb_id}/stats")
async def get_search_stats(kb_id: str):
    """Get search-related statistics for a knowledge base"""
    try:
        # Check if KB exists
        kb = kb_service.get_knowledge_base(kb_id)
        if not kb:
            raise HTTPException(status_code=404, detail="Knowledge base not found")
        
        # Get vector collection stats
        vector_stats = vector_service.get_collection_stats(kb_id)
        
        # Get KB stats
        kb_stats = kb_service.get_kb_stats(kb_id)
        
        return {
            "kb_id": kb_id,
            "kb_name": kb_stats.get("name", ""),
            "total_documents": kb_stats.get("file_count", 0),
            "total_chunks": vector_stats.get("total_chunks", 0),
            "searchable": vector_stats.get("total_chunks", 0) > 0,
            "file_types": kb_stats.get("file_types", {}),
            "collection_name": vector_stats.get("collection_name", f"kb_{kb_id}")
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting search stats for KB {kb_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/{kb_id}/batch-search")
async def batch_search(
    kb_id: str,
    queries: List[str],
    limit: int = Query(10, ge=1, le=50, description="Maximum results per query")
):
    """Perform multiple searches at once"""
    try:
        # Check if KB exists
        kb = kb_service.get_knowledge_base(kb_id)
        if not kb:
            raise HTTPException(status_code=404, detail="Knowledge base not found")
        
        if len(queries) > 10:
            raise HTTPException(status_code=400, detail="Maximum 10 queries per batch")
        
        if not queries:
            raise HTTPException(status_code=400, detail="No queries provided")
        
        start_time = time.time()
        results = []
        
        # Get KB config
        kb_config = kb.get("config", {})
        embedding_model = kb_config.get("embedding_model", "all-MiniLM-L6-v2")
        search_config = kb_config.get("search", {})
        use_hybrid = search_config.get("hybrid_search", False)
        
        for query in queries:
            if not query.strip():
                continue
                
            search_results = vector_service.search(
                kb_id=kb_id,
                query=query,
                limit=limit,
                embedding_model=embedding_model,
                use_hybrid=use_hybrid,
                hybrid_alpha=search_config.get("hybrid_alpha", 0.5),
                bm25_k1=search_config.get("bm25_k1", 1.5),
                bm25_b=search_config.get("bm25_b", 0.75)
            )
            
            formatted_results = []
            for result in search_results:
                formatted_results.append(SearchResult(
                    content=result["content"],
                    filename=result["filename"],
                    file_type=result["file_type"],
                    similarity_score=result["similarity_score"],
                    chunk_index=result["chunk_index"]
                ))
            
            results.append({
                "query": query,
                "results": formatted_results,
                "total_results": len(formatted_results)
            })
        
        processing_time = time.time() - start_time
        
        return {
            "batch_results": results,
            "total_queries": len(results),
            "processing_time": round(processing_time, 3)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in batch search for KB {kb_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Batch search failed")
