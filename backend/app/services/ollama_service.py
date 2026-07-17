import httpx
import json
from fastapi import HTTPException, status
from app.config import settings
from app import models

async def get_installed_models() -> list[str]:
    url = f"{settings.OLLAMA_BASE_URL}/api/tags"
    try:
        # Run asynchronous HTTP client request
        async with httpx.AsyncClient() as client:
            response = await client.get(url, timeout=5.0)
            if response.status_code != 200:
                return []
            
            data = response.json()
            # Extract tags names from Ollama schema array
            model_names = [model["name"] for model in data.get("models", [])]
            return model_names
            
    except (httpx.ConnectError, httpx.ConnectTimeout):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Ollama daemon is offline. Please start it using 'ollama serve' in your terminal."
        )

async def stream_chat_completion(
    model_name: str, 
    messages: list[models.Message], 
    temperature: float, 
    max_tokens: int
):
    url = f"{settings.OLLAMA_BASE_URL}/api/chat"
    
    # Map database row logs into Ollama input schemas, prefixing with a system prompt
    system_prompt = (
        "You are a concise and straightforward assistant. Keep your answers brief, "
        "direct, and to the point. Only write detailed or long explanations when "
        "explicitly asked. Do not exceed necessary token usage for simple definitions "
        "or simple questions."
    )
    formatted_messages = [{"role": "system", "content": system_prompt}] + [
        {"role": msg.role, "content": msg.content}
        for msg in messages
    ]
    
    payload = {
        "model": model_name,
        "messages": formatted_messages,
        "options": {
            "temperature": temperature,
            "num_predict": max_tokens
        },
        "stream": True
    }
    
    try:
        # Open an asynchronous stream socket to capture chunk emissions
        async with httpx.AsyncClient() as client:
            async with client.stream("POST", url, json=payload, timeout=60.0) as response:
                if response.status_code != 200:
                    yield f"data: {json.dumps({'error': 'Ollama returned error code ' + str(response.status_code)})}\n\n"
                    return
                
                async for line in response.aiter_lines():
                    if line:
                        # Yield token chunk as Server-Sent Event (SSE)
                        yield f"data: {line}\n\n"
                        
    except (httpx.ConnectError, httpx.ConnectTimeout):
        yield f"data: {json.dumps({'error': 'Lost connection to local Ollama daemon. Please verify it is active.'})}\n\n"
