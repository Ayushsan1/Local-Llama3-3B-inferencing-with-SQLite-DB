from fastapi import APIRouter, Depends
from app.services import auth_service, ollama_service
from app import models

router = APIRouter(prefix="/models", tags=["Models"])

@router.get("")
async def get_models(current_user: models.User = Depends(auth_service.get_current_user)):
    # Protected endpoint to fetch installed models lists
    installed_models = await ollama_service.get_installed_models()
    return installed_models
