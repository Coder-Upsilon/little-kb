import os
import uuid
from typing import List, Dict, Any, Optional
from pathlib import Path
import logging
from PIL import Image
import pytesseract
import PyPDF2
from docx import Document
import re

logger = logging.getLogger(__name__)

class FileProcessor:
    def __init__(self):
        self.chunk_size = 500  # tokens per chunk
        self.chunk_overlap = 50  # overlap between chunks
        
    def determine_file_type(self, filename: str) -> str:
        """Determine file type from filename extension"""
        ext = Path(filename).suffix.lower()
        
        if ext in ['.txt', '.md', '.py', '.js', '.html', '.css', '.json', '.xml']:
            return 'text'
        elif ext == '.pdf':
            return 'pdf'
        elif ext in ['.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.gif']:
            return 'image'
        elif ext in ['.docx', '.doc']:
            return 'docx'
        else:
            return 'text'  # Default to text
    
    def extract_text_from_file(self, file_path: str, file_type: str) -> str:
        """Extract text content from different file types"""
        try:
            if file_type == 'text':
                return self._extract_text_from_text_file(file_path)
            elif file_type == 'pdf':
                return self._extract_text_from_pdf(file_path)
            elif file_type == 'image':
                return self._extract_text_from_image(file_path)
            elif file_type == 'docx':
                return self._extract_text_from_docx(file_path)
            else:
                logger.warning(f"Unsupported file type: {file_type}")
                return ""
        except Exception as e:
            logger.error(f"Error extracting text from {file_path}: {str(e)}")
            return ""
    
    def _extract_text_from_text_file(self, file_path: str) -> str:
        """Extract text from plain text files"""
        try:
            with open(file_path, 'r', encoding='utf-8') as file:
                return file.read()
        except UnicodeDecodeError:
            # Try with different encoding
            with open(file_path, 'r', encoding='latin-1') as file:
                return file.read()
    
    def _extract_text_from_pdf(self, file_path: str) -> str:
        """Extract text from PDF files"""
        text = ""
        try:
            with open(file_path, 'rb') as file:
                pdf_reader = PyPDF2.PdfReader(file)
                
                for page_num in range(len(pdf_reader.pages)):
                    page = pdf_reader.pages[page_num]
                    page_text = page.extract_text()
                    text += page_text + "\n"
                
                # If no text extracted (scanned PDF), try OCR
                if not text.strip():
                    logger.info(f"No text found in PDF {file_path}, attempting OCR")
                    # Note: This would require pdf2image for full OCR support
                    # For now, return empty string
                    return ""
                
                return text
        except Exception as e:
            logger.error(f"Error reading PDF {file_path}: {str(e)}")
            return ""
    
    def _extract_text_from_image(self, file_path: str) -> str:
        """Extract text from images using OCR"""
        try:
            image = Image.open(file_path)
            text = pytesseract.image_to_string(image)
            return text
        except Exception as e:
            logger.error(f"Error performing OCR on {file_path}: {str(e)}")
            return ""
    
    def _extract_text_from_docx(self, file_path: str) -> str:
        """Extract text from DOCX files"""
        try:
            doc = Document(file_path)
            text = ""
            
            for paragraph in doc.paragraphs:
                text += paragraph.text + "\n"
            
            # Extract text from tables
            for table in doc.tables:
                for row in table.rows:
                    for cell in row.cells:
                        text += cell.text + " "
                    text += "\n"
            
            return text
        except Exception as e:
            logger.error(f"Error reading DOCX {file_path}: {str(e)}")
            return ""
    
    def chunk_text(self, text: str) -> List[str]:
        """Split text into chunks for vector storage"""
        if not text.strip():
            return []
        
        # Simple sentence-based chunking
        sentences = re.split(r'[.!?]+', text)
        chunks = []
        current_chunk = ""
        
        for sentence in sentences:
            sentence = sentence.strip()
            if not sentence:
                continue
            
            # Rough token estimation (words * 1.3)
            sentence_tokens = len(sentence.split()) * 1.3
            current_tokens = len(current_chunk.split()) * 1.3
            
            if current_tokens + sentence_tokens > self.chunk_size and current_chunk:
                # Add current chunk and start new one with overlap
                chunks.append(current_chunk.strip())
                
                # Create overlap by keeping last few sentences
                overlap_sentences = current_chunk.split('.')[-2:]  # Keep last 2 sentences
                current_chunk = '. '.join(overlap_sentences) + '. ' + sentence
            else:
                current_chunk += sentence + '. '
        
        # Add the last chunk
        if current_chunk.strip():
            chunks.append(current_chunk.strip())
        
        # Filter out very short chunks
        chunks = [chunk for chunk in chunks if len(chunk.split()) > 10]
        
        return chunks
    
    def process_file(self, file_path: str, filename: str, kb_id: str) -> Dict[str, Any]:
        """Process a file and return document data for vector storage"""
        try:
            # Determine file type
            file_type = self.determine_file_type(filename)
            
            # Extract text
            text = self.extract_text_from_file(file_path, file_type)
            
            if not text.strip():
                logger.warning(f"No text extracted from {filename}")
                return {
                    "success": False,
                    "error": "No text content found in file"
                }
            
            # Chunk text
            chunks = self.chunk_text(text)
            
            if not chunks:
                logger.warning(f"No chunks created from {filename}")
                return {
                    "success": False,
                    "error": "Could not create text chunks from file"
                }
            
            # Generate document ID
            document_id = str(uuid.uuid4())
            
            # Get file size
            file_size = os.path.getsize(file_path)
            
            return {
                "success": True,
                "document_id": document_id,
                "filename": filename,
                "file_type": file_type,
                "file_size": file_size,
                "chunks": chunks,
                "chunk_count": len(chunks),
                "text_length": len(text)
            }
            
        except Exception as e:
            logger.error(f"Error processing file {filename}: {str(e)}")
            return {
                "success": False,
                "error": f"Processing failed: {str(e)}"
            }
    
    def save_file(self, file_content: bytes, filename: str, kb_id: str) -> str:
        """Save uploaded file to knowledge base directory"""
        try:
            # Create knowledge base directory
            kb_dir = Path(f"../knowledge-bases/{kb_id}")
            kb_dir.mkdir(parents=True, exist_ok=True)
            
            # Generate unique filename to avoid conflicts
            file_ext = Path(filename).suffix
            file_stem = Path(filename).stem
            unique_filename = f"{file_stem}_{uuid.uuid4().hex[:8]}{file_ext}"
            
            file_path = kb_dir / unique_filename
            
            # Save file
            with open(file_path, 'wb') as f:
                f.write(file_content)
            
            logger.info(f"Saved file {unique_filename} to {kb_dir}")
            return str(file_path)
            
        except Exception as e:
            logger.error(f"Error saving file {filename}: {str(e)}")
            raise
    
    def delete_file(self, file_path: str) -> bool:
        """Delete a file from the filesystem"""
        try:
            if os.path.exists(file_path):
                os.remove(file_path)
                logger.info(f"Deleted file {file_path}")
                return True
            else:
                logger.warning(f"File not found: {file_path}")
                return False
        except Exception as e:
            logger.error(f"Error deleting file {file_path}: {str(e)}")
            return False

# Global instance
file_processor = FileProcessor()
