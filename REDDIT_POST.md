# Reddit Post for little-kb

## Title
[Project] little-kb - Self-hosted Vector Knowledge Base with Automatic MCP Server Generation for AI Tools

## Post Body

I built **little-kb**, a web app for creating searchable knowledge bases from your documents with automatic integration into AI coding assistants like Cline.

### What it does:
- Upload PDFs, DOCX, text files, and images into organized knowledge bases
- Automatically extracts text and creates vector embeddings for semantic search
- Search across all your documents using natural language queries
- **Automatically creates MCP (Model Context Protocol) servers** so AI tools can query your knowledge bases directly
- Clean web interface with drag-and-drop file management

### Why I built this:
I wanted a way to give AI assistants access to my project docs, API references, and research papers without manually copying content into chat. With little-kb, I can create a knowledge base, upload my docs, and instantly get an MCP server that tools like Cline can use to search through everything.

### Tech Stack:
- **Backend**: FastAPI + ChromaDB for vector storage
- **Frontend**: React + TypeScript + Material-UI
- **Embeddings**: sentence-transformers
- **Package Management**: uv for Python, npm for Node

### Key Features:
- Multiple knowledge bases with separate vector indexes
- Real semantic search (not just keyword matching)
- Automatic port management (no conflicts)
- Built-in service management script
- Zero-config MCP integration

### Example Use Case:
Create a "Godot Docs" knowledge base, upload the engine documentation, and your AI assistant can now search through all Godot docs when helping you code - without you having to paste documentation into chat.

**GitHub**: https://github.com/Coder-Upsilon/little-kb

Open source (MIT License). Would love feedback or contributions!

---

## Alternative Shorter Version (for communities preferring brevity)

### Title
little-kb - Turn Your Documents into AI-Accessible Knowledge Bases

### Post Body

Built a tool to solve a problem I kept running into: giving AI assistants access to my documentation and research papers.

**little-kb** creates searchable knowledge bases from your documents (PDF, DOCX, text, images) and automatically generates MCP servers so AI tools like Cline can query them directly.

Features:
- Semantic search across all uploaded documents
- Automatic vector indexing
- Web interface for file management
- Zero-config MCP integration
- Self-hosted

Tech: FastAPI + React + ChromaDB

**GitHub**: https://github.com/Coder-Upsilon/little-kb

Open to feedback!

---

## Suggested Subreddits

- r/selfhosted (focus on self-hosting aspect)
- r/opensource (open source project)
- r/Python (Python backend)
- r/programming (general programming)
- r/MachineLearning (vector search, embeddings)
- r/webdev (if emphasizing the web interface)
- r/devtools (developer tool)

## Tips for Posting

1. **Tailor the post** to each subreddit's culture and rules
2. **Include screenshots** or a demo GIF if possible
3. **Be responsive** to comments and questions
4. **Follow up** with any bugs or feature requests
5. **Consider doing a "Show HN"** on Hacker News as well
