from sqlalchemy.orm import Session
from sqlalchemy import desc
from sqlalchemy.sql import func
from app import models, schemas

def list_conversations(db: Session, user_id: int):
    # Sorts by updated_at descending to show recent conversations at the top
    return db.query(models.Conversation).filter(
        models.Conversation.user_id == user_id
    ).order_by(desc(models.Conversation.updated_at)).all()

def get_conversation(db: Session, conversation_id: int, user_id: int):
    # Securely retrieve conversation only if it belongs to the active user
    return db.query(models.Conversation).filter(
        models.Conversation.id == conversation_id,
        models.Conversation.user_id == user_id
    ).first()

def create_conversation(db: Session, conversation_in: schemas.ConversationCreate, user_id: int):
    new_chat = models.Conversation(
        user_id=user_id,
        title=conversation_in.title,
        model_name=conversation_in.model_name,
        temperature=conversation_in.temperature,
        max_tokens=conversation_in.max_tokens
    )
    db.add(new_chat)
    db.commit()
    db.refresh(new_chat)
    return new_chat

def update_conversation(db: Session, conversation_id: int, conversation_in: schemas.ConversationUpdate, user_id: int):
    chat = get_conversation(db, conversation_id, user_id)
    if not chat:
        return None
    
    # Extract only fields that were explicitly set in the request
    update_data = conversation_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(chat, key, value)
    
    db.commit()
    db.refresh(chat)
    return chat

def delete_conversation(db: Session, conversation_id: int, user_id: int) -> bool:
    chat = get_conversation(db, conversation_id, user_id)
    if not chat:
        return False
    
    db.delete(chat)
    db.commit()
    return True

def create_message(db: Session, conversation_id: int, role: str, content: str):
    new_message = models.Message(
        conversation_id=conversation_id,
        role=role,
        content=content
    )
    db.add(new_message)
    
    # Touch conversation timestamp to update its position in the sidebar list
    chat = db.query(models.Conversation).filter(models.Conversation.id == conversation_id).first()
    if chat:
        chat.updated_at = func.now()
        
    db.commit()
    db.refresh(new_message)
    return new_message
