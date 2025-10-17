import chromadb
from chromadb.config import Settings
from sentence_transformers import SentenceTransformer
from typing import List, Dict, Any, Optional
import os
import logging
import numpy as np
from rank_bm25 import BM25Okapi
import json

logger = logging.getLogger(__name__)

class VectorService:
    def __init__(self):
        # Initialize ChromaDB client
        self.chroma_client = chromadb.PersistentClient(
            path="../vector-db",
            settings=Settings(
                anonymized_telemetry=False,
                allow_reset=True
            )
        )
        
        # Cache for embedding models
        self.embedding_models: Dict[str, SentenceTransformer] = {}
        
        # Cache for BM25 indices per KB
        self.bm25_indices: Dict[str, BM25Okapi] = {}
        
    def get_embedding_model(self, model_id: str) -> SentenceTransformer:
        """Get or load an embedding model"""
        if model_id not in self.embedding_models:
            logger.info(f"Loading embedding model: {model_id}")
            try:
                self.embedding_models[model_id] = SentenceTransformer(model_id)
            except Exception as e:
                logger.error(f"Error loading model {model_id}: {e}")
                # Fallback to default model
                logger.info("Falling back to default model: all-MiniLM-L6-v2")
                model_id = 'all-MiniLM-L6-v2'
                if model_id not in self.embedding_models:
                    self.embedding_models[model_id] = SentenceTransformer(model_id)
        
        return self.embedding_models[model_id]
        
    def create_collection(self, kb_id: str) -> bool:
        """Create a new collection for a knowledge base"""
        try:
            collection_name = f"kb_{kb_id}"
            self.chroma_client.create_collection(
                name=collection_name,
                metadata={"kb_id": kb_id}
            )
            logger.info(f"Created collection: {collection_name}")
            return True
        except Exception as e:
            logger.error(f"Error creating collection for kb_id {kb_id}: {str(e)}")
            return False
    
    def delete_collection(self, kb_id: str) -> bool:
        """Delete a collection for a knowledge base"""
        try:
            collection_name = f"kb_{kb_id}"
            self.chroma_client.delete_collection(name=collection_name)
            logger.info(f"Deleted collection: {collection_name}")
            return True
        except Exception as e:
            logger.error(f"Error deleting collection for kb_id {kb_id}: {str(e)}")
            return False
    
    def add_documents(self, kb_id: str, documents: List[Dict[str, Any]], embedding_model: str = 'all-MiniLM-L6-v2', 
                     progress_callback=None) -> bool:
        """Add documents to a knowledge base collection"""
        try:
            collection_name = f"kb_{kb_id}"
            collection = self.chroma_client.get_collection(name=collection_name)
            
            # Get the appropriate embedding model
            model = self.get_embedding_model(embedding_model)
            
            # Prepare data for ChromaDB
            ids = []
            embeddings = []
            metadatas = []
            documents_text = []
            
            for doc in documents:
                # Generate embeddings for each chunk with progress tracking
                chunks = doc['chunks']
                total_chunks = len(chunks)
                
                # Encode in batches to show progress
                batch_size = 32  # sentence-transformers default
                chunk_embeddings = []
                
                for i in range(0, total_chunks, batch_size):
                    batch = chunks[i:i + batch_size]
                    batch_emb = model.encode(batch, show_progress_bar=False)
                    chunk_embeddings.extend(batch_emb)
                    
                    # Update progress
                    if progress_callback:
                        processed = min(i + batch_size, total_chunks)
                        progress_pct = int((processed / total_chunks) * 90) + 10  # 10-100%
                        progress_callback(progress_pct)
                
                for i, (chunk, embedding) in enumerate(zip(doc['chunks'], chunk_embeddings)):
                    chunk_id = f"{doc['document_id']}_chunk_{i}"
                    ids.append(chunk_id)
                    embeddings.append(embedding.tolist())
                    documents_text.append(chunk)
                    metadatas.append({
                        "document_id": doc['document_id'],
                        "filename": doc['filename'],
                        "file_type": doc['file_type'],
                        "chunk_index": i,
                        "total_chunks": len(doc['chunks'])
                    })
            
            # Add to collection
            collection.add(
                ids=ids,
                embeddings=embeddings,
                documents=documents_text,
                metadatas=metadatas
            )
            
            # Invalidate BM25 cache for this KB
            if kb_id in self.bm25_indices:
                del self.bm25_indices[kb_id]
            
            logger.info(f"Added {len(ids)} chunks to collection {collection_name}")
            return True
            
        except Exception as e:
            logger.error(f"Error adding documents to kb_id {kb_id}: {str(e)}")
            return False
    
    def remove_document(self, kb_id: str, document_id: str) -> bool:
        """Remove a document from a knowledge base collection"""
        try:
            collection_name = f"kb_{kb_id}"
            collection = self.chroma_client.get_collection(name=collection_name)
            
            # Get all chunk IDs for this document
            results = collection.get(
                where={"document_id": document_id}
            )
            
            if results['ids']:
                collection.delete(ids=results['ids'])
                logger.info(f"Removed document {document_id} from collection {collection_name}")
            
            # Invalidate BM25 cache for this KB
            if kb_id in self.bm25_indices:
                del self.bm25_indices[kb_id]
            
            return True
            
        except Exception as e:
            logger.error(f"Error removing document {document_id} from kb_id {kb_id}: {str(e)}")
            return False
    
    def _build_bm25_index(self, kb_id: str) -> Optional[BM25Okapi]:
        """Build BM25 index for a knowledge base"""
        try:
            collection_name = f"kb_{kb_id}"
            collection = self.chroma_client.get_collection(name=collection_name)
            
            # Get all documents
            results = collection.get(include=["documents"])
            
            if not results['documents']:
                return None
            
            # Tokenize documents for BM25
            tokenized_corpus = [doc.lower().split() for doc in results['documents']]
            
            # Build BM25 index
            bm25 = BM25Okapi(tokenized_corpus)
            
            return bm25
            
        except Exception as e:
            logger.error(f"Error building BM25 index for kb_id {kb_id}: {str(e)}")
            return None
    
    def _get_bm25_index(self, kb_id: str) -> Optional[BM25Okapi]:
        """Get or build BM25 index for a knowledge base"""
        if kb_id not in self.bm25_indices:
            self.bm25_indices[kb_id] = self._build_bm25_index(kb_id)
        
        return self.bm25_indices[kb_id]
    
    def search(self, kb_id: str, query: str, limit: int = 10, 
               embedding_model: str = 'all-MiniLM-L6-v2',
               use_hybrid: bool = False, hybrid_alpha: float = 0.5,
               bm25_k1: float = 1.5, bm25_b: float = 0.75) -> List[Dict[str, Any]]:
        """Search for similar documents in a knowledge base
        
        Args:
            kb_id: Knowledge base ID
            query: Search query
            limit: Maximum number of results
            embedding_model: Model to use for embeddings
            use_hybrid: Whether to use hybrid search (vector + BM25)
            hybrid_alpha: Weight for vector search (1.0 = pure vector, 0.0 = pure BM25)
            bm25_k1: BM25 k1 parameter
            bm25_b: BM25 b parameter
        """
        try:
            collection_name = f"kb_{kb_id}"
            collection = self.chroma_client.get_collection(name=collection_name)
            
            if use_hybrid:
                return self._hybrid_search(
                    kb_id, collection, query, limit, embedding_model, 
                    hybrid_alpha, bm25_k1, bm25_b
                )
            else:
                return self._vector_search(
                    kb_id, collection, query, limit, embedding_model
                )
            
        except Exception as e:
            logger.error(f"Error searching in kb_id {kb_id}: {str(e)}")
            return []
    
    def _vector_search(self, kb_id: str, collection, query: str, limit: int,
                       embedding_model: str) -> List[Dict[str, Any]]:
        """Perform pure vector search"""
        # Get the appropriate embedding model
        model = self.get_embedding_model(embedding_model)
        
        # Generate query embedding
        query_embedding = model.encode([query])[0]
        
        # Search in collection
        results = collection.query(
            query_embeddings=[query_embedding.tolist()],
            n_results=limit,
            include=["documents", "metadatas", "distances"]
        )
        
        # Format results
        search_results = []
        if results['documents'] and results['documents'][0]:
            for i, (doc, metadata, distance) in enumerate(zip(
                results['documents'][0],
                results['metadatas'][0],
                results['distances'][0]
            )):
                # Convert distance to similarity score (ChromaDB uses cosine distance)
                similarity_score = 1 - distance
                
                search_results.append({
                    "content": doc,
                    "filename": metadata.get("filename", ""),
                    "file_type": metadata.get("file_type", ""),
                    "similarity_score": similarity_score,
                    "chunk_index": metadata.get("chunk_index", 0),
                    "document_id": metadata.get("document_id", "")
                })
        
        logger.info(f"Vector search in kb_{kb_id} returned {len(search_results)} results")
        return search_results
    
    def _hybrid_search(self, kb_id: str, collection, query: str, limit: int,
                       embedding_model: str, alpha: float, 
                       bm25_k1: float, bm25_b: float) -> List[Dict[str, Any]]:
        """Perform hybrid search combining vector and BM25"""
        # Get more results than needed for reranking
        fetch_limit = min(limit * 3, 100)
        
        # Get vector search results
        vector_results = self._vector_search(kb_id, collection, query, fetch_limit, embedding_model)
        
        if not vector_results:
            return []
        
        # Get BM25 index
        bm25 = self._get_bm25_index(kb_id)
        
        if bm25 is None:
            logger.warning(f"BM25 index not available for kb_{kb_id}, falling back to vector search")
            return vector_results[:limit]
        
        # Get all documents for BM25 scoring
        all_docs = collection.get(include=["documents", "metadatas"])
        
        if not all_docs['documents']:
            return vector_results[:limit]
        
        # Calculate BM25 scores
        tokenized_query = query.lower().split()
        bm25_scores = bm25.get_scores(tokenized_query)
        
        # Normalize scores to [0, 1] range
        max_bm25 = max(bm25_scores) if max(bm25_scores) > 0 else 1
        normalized_bm25 = bm25_scores / max_bm25
        
        # Create mapping of content to BM25 score
        content_to_bm25 = {doc: score for doc, score in zip(all_docs['documents'], normalized_bm25)}
        
        # Combine scores
        hybrid_results = []
        for result in vector_results:
            content = result['content']
            vector_score = result['similarity_score']
            bm25_score = content_to_bm25.get(content, 0.0)
            
            # Hybrid score: weighted combination
            hybrid_score = alpha * vector_score + (1 - alpha) * bm25_score
            
            hybrid_results.append({
                **result,
                "bm25_score": float(bm25_score),
                "hybrid_score": float(hybrid_score)
            })
        
        # Sort by hybrid score
        hybrid_results.sort(key=lambda x: x['hybrid_score'], reverse=True)
        
        logger.info(f"Hybrid search in kb_{kb_id} returned {len(hybrid_results[:limit])} results")
        return hybrid_results[:limit]
    
    def get_collection_stats(self, kb_id: str) -> Dict[str, Any]:
        """Get statistics for a knowledge base collection"""
        try:
            collection_name = f"kb_{kb_id}"
            collection = self.chroma_client.get_collection(name=collection_name)
            
            # Get collection count
            count = collection.count()
            
            return {
                "total_chunks": count,
                "collection_name": collection_name
            }
            
        except Exception as e:
            logger.error(f"Error getting stats for kb_id {kb_id}: {str(e)}")
            return {"total_chunks": 0, "collection_name": f"kb_{kb_id}"}
    
    def collection_exists(self, kb_id: str) -> bool:
        """Check if a collection exists for a knowledge base"""
        try:
            collection_name = f"kb_{kb_id}"
            collections = self.chroma_client.list_collections()
            return any(col.name == collection_name for col in collections)
        except Exception as e:
            logger.error(f"Error checking collection existence for kb_id {kb_id}: {str(e)}")
            return False
    
    def rename_collection(self, old_kb_id: str, new_kb_id: str) -> bool:
        """Rename a collection by copying data to new collection and deleting old one
        
        Note: ChromaDB doesn't support native rename, so we copy and delete
        """
        try:
            old_collection_name = f"kb_{old_kb_id}"
            new_collection_name = f"kb_{new_kb_id}"
            
            logger.info(f"Renaming collection from {old_collection_name} to {new_collection_name}")
            
            # Get the old collection
            old_collection = self.chroma_client.get_collection(name=old_collection_name)
            
            # Get all data from old collection
            results = old_collection.get(include=["embeddings", "documents", "metadatas"])
            
            if not results['ids']:
                # Empty collection, just create new and delete old
                logger.info(f"Collection {old_collection_name} is empty, creating new empty collection")
                self.chroma_client.create_collection(name=new_collection_name)
                self.chroma_client.delete_collection(name=old_collection_name)
                return True
            
            # Create new collection
            new_collection = self.chroma_client.create_collection(
                name=new_collection_name,
                metadata={"kb_id": new_kb_id}
            )
            
            # Copy all data to new collection in batches
            batch_size = 1000
            total_items = len(results['ids'])
            
            for i in range(0, total_items, batch_size):
                end_idx = min(i + batch_size, total_items)
                
                new_collection.add(
                    ids=results['ids'][i:end_idx],
                    embeddings=results['embeddings'][i:end_idx],
                    documents=results['documents'][i:end_idx],
                    metadatas=results['metadatas'][i:end_idx]
                )
                
                logger.info(f"Copied {end_idx}/{total_items} items to {new_collection_name}")
            
            # Delete old collection
            self.chroma_client.delete_collection(name=old_collection_name)
            
            # Invalidate BM25 caches for both IDs
            if old_kb_id in self.bm25_indices:
                del self.bm25_indices[old_kb_id]
            if new_kb_id in self.bm25_indices:
                del self.bm25_indices[new_kb_id]
            
            logger.info(f"Successfully renamed collection from {old_collection_name} to {new_collection_name}")
            return True
            
        except Exception as e:
            logger.error(f"Error renaming collection from {old_kb_id} to {new_kb_id}: {str(e)}")
            return False

# Global instance
vector_service = VectorService()
