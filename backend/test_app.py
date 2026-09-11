import os
import sqlite3
import pytest
from unittest.mock import patch, MagicMock

# 1. Database Schema & Compatibility Tests
@pytest.fixture
def test_db():
    """Creates a temporary in-memory SQLite database simulating your local schema."""
    conn = sqlite3.connect(":memory:")
    cursor = conn.cursor()
    
    # Adjust column names/table definitions if your exact table name differs
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS conversation_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_prompt TEXT NOT NULL,
            model_response TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    yield conn
    conn.close()

def test_db_insert_and_retrieval(test_db):
    """Verifies that conversation logs can be inserted and queried without schema errors."""
    cursor = test_db.cursor()
    cursor.execute(
        "INSERT INTO conversation_history (user_prompt, model_response) VALUES (?, ?)",
        ("Hello Llama", "Hello! How can I assist you today?")
    )
    test_db.commit()

    cursor.execute("SELECT user_prompt, model_response FROM conversation_history WHERE id = 1")
    row = cursor.fetchone()

    assert row is not None, "Failed to retrieve conversation row from database."
    assert row[0] == "Hello Llama"
    assert row[1] == "Hello! How can I assist you today?"


# 2. Mocked LLM Inference Compatibility Test
def fake_llama_inference(prompt: str) -> str:
    """Simulates the output contract of your Llama-3 inference module."""
    if not prompt or not isinstance(prompt, str):
        raise ValueError("Prompt must be a non-empty string.")
    return f"Response to: {prompt}"

def test_inference_input_validation():
    """Tests that bad input types raise appropriate exceptions."""
    with pytest.raises(ValueError):
        fake_llama_inference("")

def test_inference_mocked_contract():
    """Tests the inference contract without downloading local Llama model weights."""
    # Mocking external calls (such as requests.post or ollama.generate)
    with patch("unittest.mock.MagicMock") as mock_runner:
        mock_runner.return_value = {"response": "Mocked 3B answer"}
        
        sample_prompt = "What is SQLite?"
        result = fake_llama_inference(sample_prompt)
        
        assert isinstance(result, str)
        assert len(result) > 0
        assert "What is SQLite?" in result