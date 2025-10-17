from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from enum import Enum

class FileType(str, Enum):
    TEXT = "text"
    PDF = "pdf"
    IMAGE = "image"
    DOCX = "docx"
    EPUB = "epub"

class ChunkingConfig(BaseModel):
    chunk_size: int = Field(default=500, ge=100, le=2000, description="Size of text chunks in tokens")
    chunk_overlap: int = Field(default=50, ge=0, le=500, description="Overlap between chunks in tokens")
    overlap_enabled: bool = Field(default=True, description="Whether to use overlapping chunks")

class SearchConfig(BaseModel):
    hybrid_search: bool = Field(default=False, description="Enable hybrid search (vector + BM25)")
    hybrid_alpha: float = Field(default=0.5, ge=0.0, le=1.0, description="Weight for vector search (1.0 = pure vector, 0.0 = pure BM25)")
    bm25_k1: float = Field(default=1.5, ge=0.0, le=3.0, description="BM25 term frequency saturation parameter")
    bm25_b: float = Field(default=0.75, ge=0.0, le=1.0, description="BM25 length normalization parameter")

class KnowledgeBaseConfig(BaseModel):
    embedding_model: str = Field(default="all-MiniLM-L6-v2", description="Embedding model to use")
    chunking: ChunkingConfig = Field(default_factory=ChunkingConfig)
    search: SearchConfig = Field(default_factory=SearchConfig)

class KnowledgeBaseCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    config: Optional[KnowledgeBaseConfig] = Field(default_factory=KnowledgeBaseConfig)

class KnowledgeBaseResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    created_date: datetime
    file_count: int
    config: KnowledgeBaseConfig

class KnowledgeBaseUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    config: Optional[KnowledgeBaseConfig] = None

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
    use_hybrid: Optional[bool] = Field(None, description="Override KB's hybrid search setting for this query")

class SearchResult(BaseModel):
    content: str
    filename: str
    file_type: FileType
    similarity_score: float
    chunk_index: int
    bm25_score: Optional[float] = None
    hybrid_score: Optional[float] = None

class SearchResponse(BaseModel):
    query: str
    results: List[SearchResult]
    total_results: int
    processing_time: float
    search_type: str = Field(default="vector", description="Type of search used: vector, bm25, or hybrid")

class ProcessingStatus(BaseModel):
    status: str  # "processing", "completed", "failed"
    message: Optional[str]
    progress: Optional[float]  # 0.0 to 1.0

class EmbeddingModelInfo(BaseModel):
    id: str
    name: str
    dimensions: int
    size_mb: int
    description: str

class ErrorResponse(BaseModel):
    error: str
    detail: Optional[str]
    code: Optional[str]
