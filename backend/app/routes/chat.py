from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
import json
from app.database import get_db
from app import models, schemas
from app.services import auth_service, chat_service, ollama_service

router = APIRouter(prefix="/chats", tags=["Chats"])

@router.get("", response_model=list[schemas.ConversationResponse])
def get_conversations(
    current_user: models.User = Depends(auth_service.get_current_user),
    db: Session = Depends(get_db)
):
    # Returns conversation list for sidebar
    return chat_service.list_conversations(db, current_user.id)

@router.post("", response_model=schemas.ConversationResponse, status_code=status.HTTP_201_CREATED)
def create_conversation(
    conversation_in: schemas.ConversationCreate,
    current_user: models.User = Depends(auth_service.get_current_user),
    db: Session = Depends(get_db)
):
    # Create empty conversation thread owned by user
    return chat_service.create_conversation(db, conversation_in, current_user.id)

@router.get("/{chat_id}", response_model=schemas.ConversationDetailResponse)
def get_conversation_history(
    chat_id: int,
    current_user: models.User = Depends(auth_service.get_current_user),
    db: Session = Depends(get_db)
):
    # Fetch details and message history with ownership verification
    chat = chat_service.get_conversation(db, chat_id, current_user.id)
    if not chat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )
    return chat

@router.put("/{chat_id}", response_model=schemas.ConversationResponse)
def update_conversation_config(
    chat_id: int,
    conversation_in: schemas.ConversationUpdate,
    current_user: models.User = Depends(auth_service.get_current_user),
    db: Session = Depends(get_db)
):
    # Update title or parameters
    chat = chat_service.update_conversation(db, chat_id, conversation_in, current_user.id)
    if not chat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )
    return chat

@router.delete("/{chat_id}")
def delete_conversation(
    chat_id: int,
    current_user: models.User = Depends(auth_service.get_current_user),
    db: Session = Depends(get_db)
):
    # Remove chat thread and associated messages
    success = chat_service.delete_conversation(db, chat_id, current_user.id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )
    return {"message": "Conversation successfully deleted"}

@router.post("/{chat_id}/stream")
async def stream_prompt(
    chat_id: int,
    prompt_in: schemas.ChatPromptRequest,
    current_user: models.User = Depends(auth_service.get_current_user),
    db: Session = Depends(get_db)
):
    # Verify chat ownership
    chat = chat_service.get_conversation(db, chat_id, current_user.id)
    if not chat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )
    
    # Save the user's prompt to the database first
    chat_service.create_message(db, chat_id, "user", prompt_in.prompt)
    
    # Re-fetch conversation to include the newly added user message in the context
    chat = chat_service.get_conversation(db, chat_id, current_user.id)
    
    async def event_generator():
        accumulated_response = []
        async for sse_chunk in ollama_service.stream_chat_completion(
            model_name=chat.model_name,
            messages=chat.messages,
            temperature=chat.temperature,
            max_tokens=chat.max_tokens
        ):
            if sse_chunk.startswith("data: "):
                json_str = sse_chunk[6:].strip()
                try:
                    data = json.loads(json_str)
                    
                    # Abort if the service reported an error during generator loop
                    if "error" in data:
                        yield sse_chunk
                        return
                    
                    # Accumulate token string
                    token = data.get("message", {}).get("content", "")
                    if token:
                        accumulated_response.append(token)
                    
                    yield sse_chunk
                    
                    # Once Ollama marks completion, write full response to database
                    if data.get("done", False):
                        full_content = "".join(accumulated_response)
                        if full_content:
                            chat_service.create_message(db, chat_id, "assistant", full_content)
                except Exception:
                    yield sse_chunk
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive"
        }
    )
