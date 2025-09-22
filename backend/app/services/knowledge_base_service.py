import json
import uuid
from typing import List, Dict, Any, Optional
from datetime import datetime
from pathlib import Path
import logging
import os

logger = logging.getLogger(__name__)

class KnowledgeBaseService:
    def __init__(self):
        self.data_file = Path("../knowledge-bases/kb_metadata.json")
        self.ensure_data_file()
    
    def ensure_data_file(self):
        """Ensure the metadata file exists"""
        self.data_file.parent.mkdir(parents=True, exist_ok=True)
        if not self.data_file.exists():
            with open(self.data_file, 'w') as f:
                json.dump({"knowledge_bases": {}, "documents": {}}, f)
    
    def load_data(self) -> Dict[str, Any]:
        """Load metadata from JSON file"""
        try:
            with open(self.data_file, 'r') as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Error loading data: {str(e)}")
            return {"knowledge_bases": {}, "documents": {}}
    
    def save_data(self, data: Dict[str, Any]):
        """Save metadata to JSON file"""
        try:
            with open(self.data_file, 'w') as f:
                json.dump(data, f, indent=2, default=str)
        except Exception as e:
            logger.error(f"Error saving data: {str(e)}")
            raise
    
    def create_knowledge_base(self, name: str, description: Optional[str] = None) -> Dict[str, Any]:
        """Create a new knowledge base"""
        try:
            data = self.load_data()
            
            # Check if name already exists
            for kb_id, kb_data in data["knowledge_bases"].items():
                if kb_data["name"] == name:
                    raise ValueError(f"Knowledge base with name '{name}' already exists")
            
            # Generate new KB ID
            kb_id = str(uuid.uuid4())
            
            # Create KB metadata
            kb_data = {
                "id": kb_id,
                "name": name,
                "description": description,
                "created_date": datetime.now().isoformat(),
                "file_count": 0
            }
            
            # Save to metadata
            data["knowledge_bases"][kb_id] = kb_data
            self.save_data(data)
            
            # Create directory for files
            kb_dir = Path(f"../knowledge-bases/{kb_id}")
            kb_dir.mkdir(parents=True, exist_ok=True)
            
            logger.info(f"Created knowledge base: {name} (ID: {kb_id})")
            return kb_data
            
        except Exception as e:
            logger.error(f"Error creating knowledge base: {str(e)}")
            raise
    
    def get_knowledge_base(self, kb_id: str) -> Optional[Dict[str, Any]]:
        """Get a knowledge base by ID"""
        try:
            data = self.load_data()
            return data["knowledge_bases"].get(kb_id)
        except Exception as e:
            logger.error(f"Error getting knowledge base {kb_id}: {str(e)}")
            return None
    
    def list_knowledge_bases(self) -> List[Dict[str, Any]]:
        """List all knowledge bases"""
        try:
            data = self.load_data()
            return list(data["knowledge_bases"].values())
        except Exception as e:
            logger.error(f"Error listing knowledge bases: {str(e)}")
            return []
    
    def update_knowledge_base(self, kb_id: str, name: Optional[str] = None, 
                            description: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Update a knowledge base"""
        try:
            data = self.load_data()
            
            if kb_id not in data["knowledge_bases"]:
                return None
            
            kb_data = data["knowledge_bases"][kb_id]
            
            # Check name uniqueness if updating name
            if name and name != kb_data["name"]:
                for other_kb_id, other_kb_data in data["knowledge_bases"].items():
                    if other_kb_id != kb_id and other_kb_data["name"] == name:
                        raise ValueError(f"Knowledge base with name '{name}' already exists")
                kb_data["name"] = name
            
            if description is not None:
                kb_data["description"] = description
            
            self.save_data(data)
            logger.info(f"Updated knowledge base: {kb_id}")
            return kb_data
            
        except Exception as e:
            logger.error(f"Error updating knowledge base {kb_id}: {str(e)}")
            raise
    
    def delete_knowledge_base(self, kb_id: str) -> bool:
        """Delete a knowledge base and all its files"""
        try:
            data = self.load_data()
            
            if kb_id not in data["knowledge_bases"]:
                return False
            
            # Delete all documents in this KB
            documents_to_delete = []
            for doc_id, doc_data in data["documents"].items():
                if doc_data["kb_id"] == kb_id:
                    documents_to_delete.append(doc_id)
            
            for doc_id in documents_to_delete:
                self.delete_document(doc_id)
            
            # Delete KB metadata
            del data["knowledge_bases"][kb_id]
            self.save_data(data)
            
            # Delete KB directory
            kb_dir = Path(f"../knowledge-bases/{kb_id}")
            if kb_dir.exists():
                import shutil
                shutil.rmtree(kb_dir)
            
            logger.info(f"Deleted knowledge base: {kb_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error deleting knowledge base {kb_id}: {str(e)}")
            return False
    
    def add_document(self, kb_id: str, document_id: str, filename: str, 
                    file_path: str, file_type: str, file_size: int, 
                    chunk_count: int) -> Dict[str, Any]:
        """Add a document to a knowledge base"""
        try:
            data = self.load_data()
            
            if kb_id not in data["knowledge_bases"]:
                raise ValueError(f"Knowledge base {kb_id} not found")
            
            # Create document metadata
            doc_data = {
                "id": document_id,
                "filename": filename,
                "file_path": file_path,
                "kb_id": kb_id,
                "file_type": file_type,
                "file_size": file_size,
                "processed_date": datetime.now().isoformat(),
                "chunk_count": chunk_count
            }
            
            # Save document metadata
            data["documents"][document_id] = doc_data
            
            # Update KB file count
            data["knowledge_bases"][kb_id]["file_count"] += 1
            
            self.save_data(data)
            logger.info(f"Added document {filename} to KB {kb_id}")
            return doc_data
            
        except Exception as e:
            logger.error(f"Error adding document to KB {kb_id}: {str(e)}")
            raise
    
    def get_document(self, document_id: str) -> Optional[Dict[str, Any]]:
        """Get a document by ID"""
        try:
            data = self.load_data()
            return data["documents"].get(document_id)
        except Exception as e:
            logger.error(f"Error getting document {document_id}: {str(e)}")
            return None
    
    def list_documents(self, kb_id: str) -> List[Dict[str, Any]]:
        """List all documents in a knowledge base"""
        try:
            data = self.load_data()
            documents = []
            
            for doc_id, doc_data in data["documents"].items():
                if doc_data["kb_id"] == kb_id:
                    documents.append(doc_data)
            
            # Sort by processed date (newest first)
            documents.sort(key=lambda x: x["processed_date"], reverse=True)
            return documents
            
        except Exception as e:
            logger.error(f"Error listing documents for KB {kb_id}: {str(e)}")
            return []
    
    def delete_document(self, document_id: str) -> bool:
        """Delete a document"""
        try:
            data = self.load_data()
            
            if document_id not in data["documents"]:
                return False
            
            doc_data = data["documents"][document_id]
            kb_id = doc_data["kb_id"]
            
            # Delete file from filesystem
            file_path = doc_data["file_path"]
            if os.path.exists(file_path):
                os.remove(file_path)
            
            # Remove from metadata
            del data["documents"][document_id]
            
            # Update KB file count
            if kb_id in data["knowledge_bases"]:
                data["knowledge_bases"][kb_id]["file_count"] -= 1
            
            self.save_data(data)
            logger.info(f"Deleted document: {document_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error deleting document {document_id}: {str(e)}")
            return False
    
    def get_kb_stats(self, kb_id: str) -> Dict[str, Any]:
        """Get statistics for a knowledge base"""
        try:
            data = self.load_data()
            
            if kb_id not in data["knowledge_bases"]:
                return {}
            
            kb_data = data["knowledge_bases"][kb_id]
            documents = self.list_documents(kb_id)
            
            total_size = sum(doc["file_size"] for doc in documents)
            total_chunks = sum(doc["chunk_count"] for doc in documents)
            
            file_types = {}
            for doc in documents:
                file_type = doc["file_type"]
                file_types[file_type] = file_types.get(file_type, 0) + 1
            
            return {
                "kb_id": kb_id,
                "name": kb_data["name"],
                "file_count": len(documents),
                "total_size": total_size,
                "total_chunks": total_chunks,
                "file_types": file_types,
                "created_date": kb_data["created_date"]
            }
            
        except Exception as e:
            logger.error(f"Error getting stats for KB {kb_id}: {str(e)}")
            return {}

# Global instance
kb_service = KnowledgeBaseService()
