from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./chats.db"
    SECRET_KEY: str = "super-secret-key-change-in-production-1234567890!"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours
    OLLAMA_BASE_URL: str = "http://localhost:11434"

    # SettingsConfigDict tells Pydantic to read environment variables from a .env file if it exists
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

settings = Settings()
