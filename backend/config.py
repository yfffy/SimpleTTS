from pydantic import BaseSettings
from typing import List
import os

class Settings(BaseSettings):
    # Authentication
    auth_username: str = "admin"
    auth_password: str = "admin123"  # Should be changed in production
    
    # File retention and limits
    max_file_age_days: int = 7
    max_file_size_mb: int = 10
    max_text_length: int = 10000
    
    # Directories
    upload_dir: str = "uploads"
    output_dir: str = "outputs"
    temp_dir: str = "temp"
    
    # API settings
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    cors_origins: List[str] = ["*"]
    
    # Rate limiting
    upload_rate_limit: str = "10/minute"
    tts_rate_limit: str = "30/minute"
    batch_rate_limit: str = "5/minute"
    
    # TTS settings
    default_voice: str = "en-US-AndrewNeural"
    voices_cache_ttl: int = 3600  # 1 hour in seconds
    
    # Logging
    log_level: str = "INFO"
    log_format: str = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    
    # Cleanup settings
    cleanup_interval_hours: int = 24
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

# Global settings instance
settings = Settings() 