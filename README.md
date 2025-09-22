# Little KB - Knowledge Base Management Webapp

A Python-based webapp for managing multiple knowledge bases with vector storage and semantic search capabilities.

## Features

- **Multiple Knowledge Bases**: Create and manage separate knowledge bases
- **File Management**: Upload, update, remove files via web interface
- **Vector Indexing**: Automatic text extraction and embedding generation
- **Semantic Search**: Query knowledge bases with natural language
- **File Support**: Text, PDF, images, DOCX files
- **Professional UI**: Material-UI components with drag-and-drop functionality

## Technology Stack

- **Backend**: Python with FastAPI, ChromaDB for vector storage
- **Frontend**: React with TypeScript and Material-UI
- **Package Management**: uv for Python dependencies, npm for Node.js
- **Vector Embeddings**: sentence-transformers for semantic search

## Quick Start

### Backend Setup
```bash
cd backend
uv sync
uv run python main.py
```

### Frontend Setup
```bash
cd frontend
npm install
npm start
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Documentation: http://localhost:8000/docs

## Project Structure

```
little-kb/
├── backend/           # FastAPI backend
│   ├── app/
│   │   ├── models/    # Pydantic schemas
│   │   ├── routers/   # API endpoints
│   │   └── services/  # Business logic
│   └── main.py
├── frontend/          # React frontend
│   └── src/
│       ├── components/
│       └── services/
├── memory-bank/       # Project documentation
└── README.md
```

## Usage

1. **Create Knowledge Base**: Use the web interface to create a new knowledge base
2. **Upload Files**: Drag and drop or select files to upload (PDF, DOCX, text, images)
3. **Search**: Use natural language queries to search across your documents
4. **Manage**: View statistics, reindex, or delete knowledge bases as needed

## Development

The application uses:
- FastAPI for the REST API backend
- ChromaDB for vector storage and similarity search
- React with Material-UI for the frontend
- sentence-transformers for generating embeddings

## License

This project is open source and available under the MIT License.
