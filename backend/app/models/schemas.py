from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from enum import Enum

class FileType(str, Enum):
    TEXT = "text"
    PDF = "pdf"
    IMAGE = "image"
    DOCX = "docx"

class KnowledgeBaseCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)

class KnowledgeBaseResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    created_date: datetime
    file_count: int

class KnowledgeBaseUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)

class DocumentResponse(BaseModel):
    id: str
    filename: str
    file_path: str
    kb_id: str
    file_type: FileType
    file_size: int
    processed_date: datetime
    chunk_count: int

class SearchQuery(BaseModel):
    query: str = Field(..., min_length=1, max_length=1000)
    kb_id: str
    limit: int = Field(default=10, ge=1, le=50)

class SearchResult(BaseModel):
    content: str
    filename: str
    file_type: FileType
    similarity_score: float
    chunk_index: int

class SearchResponse(BaseModel):
    query: str
    results: List[SearchResult]
    total_results: int
    processing_time: float

class ProcessingStatus(BaseModel):
    status: str  # "processing", "completed", "failed"
    message: Optional[str]
    progress: Optional[float]  # 0.0 to 1.0

class ErrorResponse(BaseModel):
    error: str
    detail: Optional[str]
    code: Optional[str]
