from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from typing import List
import time
import logging
from app.models.schemas import DocumentResponse, ProcessingStatus
from app.services.knowledge_base_service import kb_service
from app.services.file_processor import file_processor
from app.services.vector_service import vector_service

logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/{kb_id}/upload", response_model=DocumentResponse)
async def upload_file(
    kb_id: str,
    file: UploadFile = File(...)
):
    """Upload and process a file to a knowledge base"""
    try:
        # Check if KB exists
        kb = kb_service.get_knowledge_base(kb_id)
        if not kb:
            raise HTTPException(status_code=404, detail="Knowledge base not found")
        
        # Validate file
        if not file.filename:
            raise HTTPException(status_code=400, detail="No filename provided")
        
        # Check file size (limit to 50MB)
        MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB
        file_content = await file.read()
        
        if len(file_content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=413, 
                detail="File too large. Maximum size is 50MB"
            )
        
        if len(file_content) == 0:
            raise HTTPException(status_code=400, detail="Empty file")
        
        # Save file to filesystem
        try:
            file_path = file_processor.save_file(file_content, file.filename, kb_id)
        except Exception as e:
            logger.error(f"Error saving file: {str(e)}")
            raise HTTPException(status_code=500, detail="Failed to save file")
        
        # Process file
        try:
            result = file_processor.process_file(file_path, file.filename, kb_id)
            
            if not result["success"]:
                # Clean up saved file if processing failed
                file_processor.delete_file(file_path)
                raise HTTPException(
                    status_code=422, 
                    detail=f"File processing failed: {result.get('error', 'Unknown error')}"
                )
            
            # Add document to knowledge base metadata
            doc_data = kb_service.add_document(
                kb_id=kb_id,
                document_id=result["document_id"],
                filename=file.filename,
                file_path=file_path,
                file_type=result["file_type"],
                file_size=result["file_size"],
                chunk_count=result["chunk_count"]
            )
            
            # Add to vector storage
            vector_data = [{
                "document_id": result["document_id"],
                "filename": file.filename,
                "file_type": result["file_type"],
                "chunks": result["chunks"]
            }]
            
            vector_success = vector_service.add_documents(kb_id, vector_data)
            
            if not vector_success:
                # Rollback: delete document and file
                kb_service.delete_document(result["document_id"])
                file_processor.delete_file(file_path)
                raise HTTPException(
                    status_code=500,
                    detail="Failed to add document to vector storage"
                )
            
            logger.info(f"Successfully uploaded and processed file: {file.filename}")
            return DocumentResponse(**doc_data)
            
        except HTTPException:
            raise
        except Exception as e:
            # Clean up on any error
            file_processor.delete_file(file_path)
            logger.error(f"Error processing file {file.filename}: {str(e)}")
            raise HTTPException(status_code=500, detail="File processing failed")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading file: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/{kb_id}/documents", response_model=List[DocumentResponse])
async def list_documents(kb_id: str):
    """List all documents in a knowledge base"""
    try:
        # Check if KB exists
        kb = kb_service.get_knowledge_base(kb_id)
        if not kb:
            raise HTTPException(status_code=404, detail="Knowledge base not found")
        
        documents = kb_service.list_documents(kb_id)
        return [DocumentResponse(**doc) for doc in documents]
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error listing documents for KB {kb_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/document/{document_id}", response_model=DocumentResponse)
async def get_document(document_id: str):
    """Get a specific document"""
    try:
        doc = kb_service.get_document(document_id)
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")
        
        return DocumentResponse(**doc)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting document {document_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.delete("/document/{document_id}")
async def delete_document(document_id: str):
    """Delete a document"""
    try:
        # Get document info
        doc = kb_service.get_document(document_id)
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")
        
        kb_id = doc["kb_id"]
        
        # Remove from vector storage
        vector_service.remove_document(kb_id, document_id)
        
        # Delete document from KB service (this also deletes the file)
        success = kb_service.delete_document(document_id)
        
        if not success:
            raise HTTPException(status_code=500, detail="Failed to delete document")
        
        return {"message": "Document deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting document {document_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/document/{document_id}/reprocess")
async def reprocess_document(document_id: str):
    """Reprocess a document (re-extract text and update vectors)"""
    try:
        # Get document info
        doc = kb_service.get_document(document_id)
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")
        
        kb_id = doc["kb_id"]
        file_path = doc["file_path"]
        filename = doc["filename"]
        
        # Check if file still exists
        import os
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="Source file not found")
        
        # Remove existing vectors
        vector_service.remove_document(kb_id, document_id)
        
        # Reprocess file
        result = file_processor.process_file(file_path, filename, kb_id)
        
        if not result["success"]:
            raise HTTPException(
                status_code=422,
                detail=f"File reprocessing failed: {result.get('error', 'Unknown error')}"
            )
        
        # Update document metadata
        data = kb_service.load_data()
        if document_id in data["documents"]:
            data["documents"][document_id]["chunk_count"] = result["chunk_count"]
            data["documents"][document_id]["processed_date"] = doc["processed_date"]  # Keep original date
            kb_service.save_data(data)
        
        # Add new vectors
        vector_data = [{
            "document_id": document_id,
            "filename": filename,
            "file_type": result["file_type"],
            "chunks": result["chunks"]
        }]
        
        vector_success = vector_service.add_documents(kb_id, vector_data)
        
        if not vector_success:
            raise HTTPException(
                status_code=500,
                detail="Failed to update vector storage"
            )
        
        return {
            "message": "Document reprocessed successfully",
            "chunk_count": result["chunk_count"],
            "text_length": result["text_length"]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error reprocessing document {document_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/{kb_id}/supported-formats")
async def get_supported_formats():
    """Get list of supported file formats"""
    return {
        "supported_formats": [
            {
                "type": "text",
                "extensions": [".txt", ".md", ".py", ".js", ".html", ".css", ".json", ".xml"],
                "description": "Plain text files and code files"
            },
            {
                "type": "pdf",
                "extensions": [".pdf"],
                "description": "PDF documents (text extraction)"
            },
            {
                "type": "image",
                "extensions": [".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".gif"],
                "description": "Images with text (OCR)"
            },
            {
                "type": "docx",
                "extensions": [".docx"],
                "description": "Microsoft Word documents"
            }
        ],
        "max_file_size": "50MB",
        "notes": [
            "PDF files with scanned content may not extract text properly",
            "Image OCR quality depends on image clarity and text size",
            "Large files may take longer to process"
        ]
    }
