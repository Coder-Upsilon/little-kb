import chromadb
from chromadb.config import Settings
from sentence_transformers import SentenceTransformer
from typing import List, Dict, Any, Optional
import os
import logging

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
        
        # Initialize sentence transformer model
        self.embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
        
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
    
    def add_documents(self, kb_id: str, documents: List[Dict[str, Any]]) -> bool:
        """Add documents to a knowledge base collection"""
        try:
            collection_name = f"kb_{kb_id}"
            collection = self.chroma_client.get_collection(name=collection_name)
            
            # Prepare data for ChromaDB
            ids = []
            embeddings = []
            metadatas = []
            documents_text = []
            
            for doc in documents:
                # Generate embeddings for each chunk
                chunk_embeddings = self.embedding_model.encode(doc['chunks'])
                
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
            
            return True
            
        except Exception as e:
            logger.error(f"Error removing document {document_id} from kb_id {kb_id}: {str(e)}")
            return False
    
    def search(self, kb_id: str, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Search for similar documents in a knowledge base"""
        try:
            collection_name = f"kb_{kb_id}"
            collection = self.chroma_client.get_collection(name=collection_name)
            
            # Generate query embedding
            query_embedding = self.embedding_model.encode([query])[0]
            
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
            
            logger.info(f"Search in {collection_name} returned {len(search_results)} results")
            return search_results
            
        except Exception as e:
            logger.error(f"Error searching in kb_id {kb_id}: {str(e)}")
            return []
    
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

# Global instance
vector_service = VectorService()
