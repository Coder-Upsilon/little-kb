# Technical Context: Little KB

## Technology Stack

### Backend
- **Python 3.11+**: Core language
- **uv**: Fast Python package manager and project management
- **FastAPI**: Modern web framework with automatic API docs
- **ChromaDB**: Vector database for embeddings storage
- **sentence-transformers**: Text embedding generation
- **Pydantic**: Data validation and serialization

### File Processing Libraries
- **PyPDF2**: PDF text extraction
- **python-docx**: Word document processing
- **Pillow (PIL)**: Image processing
- **pytesseract**: OCR for images and scanned PDFs
- **python-multipart**: File upload handling

### Frontend
- **React 18**: UI framework
- **TypeScript**: Type safety
- **Axios**: HTTP client for API calls
- **Material-UI or Tailwind CSS**: Styling framework
- **React Router**: Client-side routing

## Development Setup

### Backend Setup
```bash
# Initialize with uv
uv init backend
cd backend
uv add fastapi uvicorn chromadb sentence-transformers
uv add PyPDF2 python-docx pillow pytesseract python-multipart
```

### Frontend Setup
```bash
# Create React app with TypeScript
npx create-react-app frontend --template typescript
cd frontend
npm install axios @mui/material @emotion/react @emotion/styled
```

## Key Dependencies

### Core Backend Dependencies
- `fastapi`: Web framework
- `uvicorn[standard]`: ASGI server
- `chromadb`: Vector database
- `sentence-transformers`: Embedding models
- `pydantic`: Data models

### File Processing Dependencies
- `PyPDF2`: PDF processing
- `python-docx`: Word document processing
- `Pillow`: Image processing
- `pytesseract`: OCR capabilities
- `python-multipart`: File uploads

### Development Dependencies
- `pytest`: Testing framework
- `black`: Code formatting
- `flake8`: Linting
- `mypy`: Type checking

## Configuration Patterns

### Environment Variables
- `CHROMADB_PATH`: Vector database storage path
- `KNOWLEDGE_BASES_PATH`: File storage directory
- `EMBEDDING_MODEL`: Sentence transformer model name
- `MAX_FILE_SIZE`: Upload size limit
- `CHUNK_SIZE`: Text chunking size
- `CHUNK_OVERLAP`: Overlap between chunks

### API Configuration
- CORS enabled for frontend development
- File upload limits configured
- Async request handling
- Automatic API documentation at `/docs`

## Deployment Considerations

### Local Development
- Backend runs on `http://localhost:8000`
- Frontend runs on `http://localhost:3000`
- ChromaDB persists to local directory
- Files stored in local `knowledge-bases/` directory

### Server Deployment
- Docker containerization ready
- Environment-based configuration
- Persistent volume mounts for data
- Reverse proxy configuration for production
