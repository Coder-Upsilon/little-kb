from app.main import app
import os

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("BACKEND_PORT", 39472))
    host = os.environ.get("BACKEND_HOST", "127.0.0.1")
    uvicorn.run(app, host=host, port=port)
