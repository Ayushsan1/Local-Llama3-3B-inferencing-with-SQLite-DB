from datetime import datetime
from pydantic import BaseModel, Field, field_validator
import re

class UserBase(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)

class UserCreate(UserBase):
    password: str = Field(..., min_length=8, max_length=100)

    # Validates that username only contains alphanumeric, dashes, and underscores
    @field_validator("username")
    @classmethod
    def validate_username(cls, v: str) -> str:
        if not re.match(r"^[a-zA-Z0-9_-]+$", v):
            raise ValueError("Username can only contain alphanumeric characters, underscores, and hyphens.")
        return v

class UserResponse(UserBase):
    id: int
    created_at: datetime

    # Pydantic v2 configuration to allow serialization from database ORM objects
    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    token_type: str
    username: str

class TokenData(BaseModel):
    username: str | None = None


class MessageBase(BaseModel):
    role: str = Field(..., description="Role of the message author: 'user', 'assistant', or 'system'")
    content: str = Field(..., min_length=1)

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        if v not in ("user", "assistant", "system"):
            raise ValueError("Role must be 'user', 'assistant', or 'system'")
        return v

class MessageCreate(MessageBase):
    pass

class MessageResponse(MessageBase):
    id: int
    created_at: datetime

    model_config = {"from_attributes": True}


class ConversationBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    model_name: str = Field(..., min_length=1, max_length=100)
    temperature: float = Field(default=0.7, ge=0.0, le=1.0)
    max_tokens: int = Field(default=2048, ge=1, le=8192)

class ConversationCreate(BaseModel):
    title: str = Field(default="New Conversation", min_length=1, max_length=255)
    model_name: str = Field(..., min_length=1, max_length=100)
    temperature: float = Field(default=0.7, ge=0.0, le=1.0)
    max_tokens: int = Field(default=2048, ge=1, le=8192)

class ConversationUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    temperature: float | None = Field(default=None, ge=0.0, le=1.0)
    max_tokens: int | None = Field(default=None, ge=1, le=8192)

class ConversationResponse(ConversationBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

class ConversationDetailResponse(ConversationResponse):
    messages: list[MessageResponse] = []

    model_config = {"from_attributes": True}

class ChatPromptRequest(BaseModel):
    prompt: str = Field(..., min_length=1)
