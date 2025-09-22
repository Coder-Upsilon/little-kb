# System Patterns: Little KB Architecture

## Overall Architecture
```
Frontend (React) <-> REST API (FastAPI) <-> Vector DB (ChromaDB) + File Storage
```

## Key Components

### Backend Services
1. **Knowledge Base Service**: CRUD operations for knowledge bases
2. **File Processing Service**: Extract text from various file formats
3. **Vector Service**: Generate embeddings and manage ChromaDB
4. **Search Service**: Semantic search across vector collections

### File Processing Pipeline
```
File Upload -> Text Extraction -> Chunking -> Embedding Generation -> Vector Storage
```

### Data Models
- **Knowledge Base**: ID, name, description, created_date, file_count
- **Document**: ID, filename, file_path, kb_id, file_type, processed_date
- **Vector Entry**: Document chunks with embeddings, metadata, source info

## Technical Patterns

### File Processing Strategy
- **Text Files**: Direct content reading
- **PDFs**: PyPDF2 for text + pytesseract OCR for scanned content
- **Images**: pytesseract OCR for text extraction
- **DOCX**: python-docx for structured content extraction

### Chunking Strategy
- Split documents into 500-token chunks with 50-token overlap
- Preserve paragraph boundaries when possible
- Include metadata (source file, chunk index) with each vector

### Vector Storage Pattern
- One ChromaDB collection per knowledge base
- Embeddings generated using sentence-transformers (all-MiniLM-L6-v2)
- Metadata includes: filename, chunk_index, file_type, processed_date

### API Design Patterns
- RESTful endpoints with clear resource hierarchy
- Consistent error handling and response formats
- File upload with multipart/form-data
- Async processing for large files

## Directory Structure
```
little-kb/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app entry
│   │   ├── models/              # Pydantic models
│   │   ├── routers/             # API route handlers
│   │   ├── services/            # Business logic
│   │   └── utils/               # Helper functions
│   └── pyproject.toml           # uv configuration
├── frontend/                    # React application
├── knowledge-bases/             # File storage directory
└── vector-db/                   # ChromaDB persistence
```

## Error Handling Patterns
- Graceful degradation for unsupported file types
- Retry logic for embedding generation
- Clear error messages for file processing failures
- Rollback mechanisms for failed operations
