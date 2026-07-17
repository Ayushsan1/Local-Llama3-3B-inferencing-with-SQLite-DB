from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
from app.routes import auth, chat, models

# Compile database tables in SQLite automatically on startup
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Local AI Inference Management System",
    description="FastAPI backend coordinator for local LLM chats and Ollama integration",
    version="1.0.0"
)

# Configure CORS so local frontend files/ports can access the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allowed for local development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers prefixed with /api to maintain REST standards
app.include_router(auth.router, prefix="/api")
app.include_router(chat.router, prefix="/api")
app.include_router(models.router, prefix="/api")

@app.get("/api/health")
def health_check():
    return {"status": "healthy", "service": "Local AI Inference Backend"}
