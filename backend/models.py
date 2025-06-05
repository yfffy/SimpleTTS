from pydantic import BaseModel, validator, Field
from typing import List, Optional
import re

# Import settings with fallback
try:
    from config import settings
except ImportError:
    # Fallback for when config is not available
    class MockSettings:
        max_text_length = 10000
    settings = MockSettings()

class TTSRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=settings.max_text_length)
    voice: str = Field(..., min_length=1)
    rate: Optional[str] = Field("+0%", regex=r"^[+-]\d+%$")
    volume: Optional[str] = Field("+0%", regex=r"^[+-]\d+%$")
    pitch: Optional[str] = Field("+0Hz", regex=r"^[+-]\d+Hz$")
    filename: Optional[str] = None

    @validator('text')
    def validate_text(cls, v):
        """Sanitize text input"""
        if not v.strip():
            raise ValueError("Text cannot be empty")
        # Remove potential malicious content but preserve basic formatting
        cleaned = re.sub(r'[<>\"\'&]', '', v)
        return cleaned.strip()

    @validator('filename')
    def validate_filename(cls, v):
        """Sanitize filename"""
        if v:
            # Remove invalid filename characters
            sanitized = re.sub(r'[^\w\-_\.]', '_', v)
            # Ensure filename isn't too long
            if len(sanitized) > 255:
                sanitized = sanitized[:251] + ".txt"
            return sanitized
        return v

    @validator('voice')
    def validate_voice(cls, v):
        """Ensure voice name is not empty and contains valid characters"""
        if not v.strip():
            raise ValueError("Voice cannot be empty")
        # Basic validation for voice name format
        if not re.match(r'^[a-zA-Z0-9\-_]+$', v):
            raise ValueError("Invalid voice name format")
        return v

class BatchProcessRequest(BaseModel):
    file_ids: List[str] = Field(..., min_items=1, max_items=50)
    voice: str = Field(..., min_length=1)
    rate: Optional[str] = Field("+0%", regex=r"^[+-]\d+%$")
    volume: Optional[str] = Field("+0%", regex=r"^[+-]\d+%$")
    pitch: Optional[str] = Field("+0Hz", regex=r"^[+-]\d+Hz$")

    @validator('file_ids')
    def validate_file_ids(cls, v):
        """Validate file IDs format"""
        for file_id in v:
            if not re.match(r'^[a-f0-9\-]{36}$', file_id):  # UUID format
                raise ValueError(f"Invalid file ID format: {file_id}")
        return v

    @validator('voice')
    def validate_voice(cls, v):
        """Ensure voice name is valid"""
        if not v.strip():
            raise ValueError("Voice cannot be empty")
        if not re.match(r'^[a-zA-Z0-9\-_]+$', v):
            raise ValueError("Invalid voice name format")
        return v

class VoiceInfo(BaseModel):
    name: str
    gender: str
    locale: str

    class Config:
        schema_extra = {
            "example": {
                "name": "en-US-AndrewNeural",
                "gender": "Male",
                "locale": "en-US"
            }
        }

class ProcessedFilesInfo(BaseModel):
    file_ids: List[str] = Field(..., min_items=1, max_items=100)

    @validator('file_ids')
    def validate_file_ids(cls, v):
        """Validate file IDs format"""
        for file_id in v:
            if not re.match(r'^[a-f0-9\-]{36}$', file_id):  # UUID format
                raise ValueError(f"Invalid file ID format: {file_id}")
        return v

class UploadResponse(BaseModel):
    file_id: str
    filename: str
    original_encoding: str
    encoding_confidence: float
    size: int

class TTSResponse(BaseModel):
    success: bool
    output_id: str
    output_url: str
    message: Optional[str] = None

class BatchProcessResponse(BaseModel):
    success: bool
    files: List[dict]
    message: Optional[str] = None

class ProcessedFile(BaseModel):
    file_id: str
    original_name: str
    output_id: str
    output_url: str

class ErrorResponse(BaseModel):
    detail: str
    error_code: Optional[str] = None
    timestamp: Optional[str] = None

class FileContentResponse(BaseModel):
    content: str
    filename: str
    file_size: int
    encoding: str

class SuccessResponse(BaseModel):
    success: bool
    message: str
    data: Optional[dict] = None 