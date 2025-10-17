# little-kb - Vector Storage & MCP Management Platform

A powerful web application for creating vector-indexed knowledge bases with automatic MCP server generation for seamless integration with AI tools like Cline.

## Features

- **Multiple Knowledge Bases**: Create and manage separate knowledge bases
- **File Management**: Upload, update, remove files via web interface
- **Vector Indexing**: Automatic text extraction and embedding generation
- **Semantic Search**: Query knowledge bases with natural language
- **File Support**: Text, PDF, images, DOCX files
- **Professional UI**: Material-UI components with drag-and-drop functionality
- **MCP Integration**: Automatic MCP server creation for external tool access
- **Service Management**: Built-in script for starting, stopping, and managing services

## Technology Stack

- **Backend**: Python with FastAPI, ChromaDB for vector storage
- **Frontend**: React with TypeScript and Material-UI
- **Package Management**: uv for Python dependencies, npm for Node.js
- **Vector Embeddings**: sentence-transformers for semantic search

## Installation

Clone the repository:
```bash
git clone https://github.com/Coder-Upsilon/little-kb.git
cd little-kb
```

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

## Port Configuration

little-kb supports configurable ports for all services with automatic port availability checking. Configure ports via `config.json`:

```json
{
  "backend": {
    "port": 8000,
    "host": "0.0.0.0"
  },
  "frontend": {
    "port": 3000
  },
  "mcp": {
    "start_port": 8100,
    "max_port": 8200
  }
}
```

### Auto-Port Selection

If a configured port is already in use, the system automatically finds the next available port:

```
[INFO] Starting backend on preferred port 8000...
[WARNING] Port 8000 is not available, searching for alternative...
[INFO] Found available port: 8001
[SUCCESS] Backend started on http://localhost:8001
```

### Port Ranges

- **Backend**: Preferred 8000, fallback range 8000-8100
- **Frontend**: Preferred 3000, fallback range 3000-3100
- **MCP Servers**: Configurable range (default 8100-8200)

### Custom Configuration

To use custom ports:
1. Edit `config.json` with your preferred ports
2. Start services with `./manage_services.sh start`
3. Services will use configured ports or find alternatives if occupied

For detailed port configuration options, troubleshooting, and production deployment guidelines, see [PORT_CONFIGURATION.md](PORT_CONFIGURATION.md).

## Service Management

Use the included service management script for easy control of all services:

```bash
# Start all services
./manage_services.sh start

# Stop all services
./manage_services.sh stop

# Restart all services
./manage_services.sh restart

# Check service status
./manage_services.sh status

# View logs
./manage_services.sh logs

# Individual service control
./manage_services.sh backend start
./manage_services.sh frontend restart
```

## MCP Integration

little-kb automatically creates MCP (Model Context Protocol) servers for each knowledge base, enabling external tools like Cline to query your knowledge bases.

### Features:
- **Automatic Server Creation**: Each knowledge base gets its own MCP server
- **Web Management**: Manage MCP servers through the web interface
- **Cline Integration**: Ready-to-use configurations for Cline
- **Multiple Tools**: Search, info, and document listing tools per knowledge base

### Using with Cline:
1. Create a knowledge base in little-kb
2. Go to "MCP Servers" in the web interface
3. Click the settings icon on any server to get the Cline configuration
4. Copy the configuration to your Cline MCP settings
5. Use the MCP tools to query your knowledge base from Cline

## Usage

1. **Create Knowledge Base**: Use the web interface to create a new knowledge base
2. **Upload Files**: Drag and drop or select files to upload (PDF, DOCX, text, images)
3. **Search**: Use natural language queries to search across your documents
4. **Manage**: View statistics, reindex, or delete knowledge bases as needed
5. **MCP Access**: Use the automatically created MCP servers with external tools

## Development

The application uses:
- FastAPI for the REST API backend
- ChromaDB for vector storage and similarity search
- React with Material-UI for the frontend
- sentence-transformers for generating embeddings

## Recent Updates

### Bug Fixes (January 2026)
- **Fixed Reindex Operation**: Resolved `'VectorService' object has no attribute 'rename_collection'` error
  - Implemented missing `rename_collection` method for zero-downtime reindexing
  - Collections are now properly renamed during reindex operations
  - Added batch processing (1000 items at a time) for efficient data migration
  - Includes proper error handling and logging for collection operations

## Future Enhancements

Potential features being explored:
- **URL-based Content Ingestion**: Add documents directly from web URLs
- **Documentation Scraping**: Pull API documentation from developer sites
- **External API Integration**: Fetch data from external sources for knowledge bases
- **Web Content Processing**: Process HTML/JSON content for indexing

Note: System has been verified to support curl for external URL access, enabling these future capabilities.

## License

This project is open source and available under the MIT License.
