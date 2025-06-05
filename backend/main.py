import os
import chardet
import nltk
import tempfile
import asyncio
import aiofiles
import uuid
import zipfile
import io
import logging
import traceback
from datetime import datetime, timedelta
from functools import lru_cache
from contextlib import asynccontextmanager

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks, Depends, Request
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.openapi.utils import get_openapi
from sqlalchemy.orm import Session
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

import edge_tts
import shutil
from pathlib import Path
import json

# Import our modules
from config import settings
from auth import verify_credentials, optional_auth
from database import get_db, create_tables, FileUpload, TTSGeneration, BatchProcess
from models import (
    TTSRequest, BatchProcessRequest, VoiceInfo, ProcessedFilesInfo,
    UploadResponse, TTSResponse, BatchProcessResponse, ErrorResponse,
    FileContentResponse, SuccessResponse
)

# Setup logging
logging.basicConfig(
    level=getattr(logging, settings.log_level.upper()),
    format=settings.log_format
)
logger = logging.getLogger(__name__)

# Download NLTK data if it doesn't exist
try:
    nltk.data.find('tokenizers/punkt')
except LookupError:
    logger.info("Downloading NLTK punkt tokenizer...")
    nltk.download('punkt')

# Rate limiter setup
limiter = Limiter(key_func=get_remote_address)

# Lifespan context manager for startup/shutdown events
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting SimpleTTS API...")
    
    # Create database tables
    create_tables()
    logger.info("Database tables created/verified")
    
    # Create directories if they don't exist
    for directory in [settings.upload_dir, settings.output_dir, settings.temp_dir]:
        Path(directory).mkdir(exist_ok=True)
    logger.info("Directories created/verified")
    
    # Start background cleanup task
    cleanup_task = asyncio.create_task(periodic_cleanup())
    logger.info("Background cleanup task started")
    
    yield
    
    # Shutdown
    logger.info("Shutting down SimpleTTS API...")
    cleanup_task.cancel()
    try:
        await cleanup_task
    except asyncio.CancelledError:
        logger.info("Cleanup task cancelled")

app = FastAPI(
    title="SimpleTTS API",
    version="1.0.0",
    description="Text-to-Speech API using Microsoft Edge TTS with authentication and rate limiting",
    lifespan=lifespan
)

# Setup rate limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Setup CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve static files
app.mount("/outputs", StaticFiles(directory=settings.output_dir), name="outputs")

# Custom exception handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    logger.error(f"HTTP {exc.status_code} error on {request.url}: {exc.detail}")
    from fastapi.responses import JSONResponse
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "detail": exc.detail,
            "error_code": f"HTTP_{exc.status_code}",
            "timestamp": datetime.utcnow().isoformat()
        }
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unexpected error on {request.url}: {str(exc)}\n{traceback.format_exc()}")
    from fastapi.responses import JSONResponse
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Internal server error",
            "error_code": "INTERNAL_ERROR",
            "timestamp": datetime.utcnow().isoformat()
        }
    )

# Cache for voices
@lru_cache(maxsize=1)
async def get_cached_voices():
    """Get and cache the list of available voices"""
    try:
        logger.info("Fetching voices from Edge TTS...")
        voices = await edge_tts.list_voices()
        logger.info(f"Retrieved {len(voices)} voices")
        return voices
    except Exception as e:
        logger.error(f"Failed to fetch voices: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch voices from TTS service")

# Utility functions
async def validate_file_size(file: UploadFile) -> None:
    """Validate uploaded file size"""
    max_size = settings.max_file_size_mb * 1024 * 1024
    
    # Read the file content to check size
    content = await file.read()
    if len(content) > max_size:
        raise HTTPException(
            status_code=413, 
            detail=f"File size exceeds maximum allowed size of {settings.max_file_size_mb}MB"
        )
    
    # Reset file pointer
    await file.seek(0)

async def validate_file_type(file: UploadFile) -> None:
    """Validate uploaded file type"""
    allowed_types = ["text/plain", "text/csv", "application/rtf", "text/markdown"]
    if file.content_type and file.content_type not in allowed_types:
        # Also check by file extension as a fallback
        if file.filename:
            ext = Path(file.filename).suffix.lower()
            if ext not in ['.txt', '.csv', '.rtf', '.md']:
                raise HTTPException(
                    status_code=400,
                    detail=f"File type {file.content_type} not allowed. Supported types: {allowed_types}"
                )

async def process_text_to_speech(text: str, output_file: str, voice: str, rate: str, volume: str, pitch: str):
    """Process text to speech using Edge TTS"""
    try:
        logger.info(f"Processing TTS: voice={voice}, text_length={len(text)}")
        communicate = edge_tts.Communicate(text, voice, rate=rate, volume=volume, pitch=pitch)
        await communicate.save(output_file)
        logger.info(f"TTS processing completed: {output_file}")
    except Exception as e:
        logger.error(f"TTS processing failed: {str(e)}")
        raise

async def safe_file_read(file_path: Path, encoding: str = 'utf-8', max_size: int = None) -> str:
    """Safely read file content with size limits"""
    if max_size is None:
        max_size = settings.max_text_length
    
    try:
        async with aiofiles.open(file_path, 'r', encoding=encoding) as f:
            content = ""
            chunk_size = 8192
            while len(content) < max_size:
                chunk = await f.read(chunk_size)
                if not chunk:
                    break
                content += chunk
                if len(content) > max_size:
                    raise HTTPException(
                        status_code=413,
                        detail=f"File content exceeds maximum text length of {max_size} characters"
                    )
            return content
    except UnicodeDecodeError:
        logger.error(f"Failed to decode file {file_path} with encoding {encoding}")
        raise HTTPException(status_code=400, detail=f"Failed to decode file with {encoding} encoding")

# API Endpoints

@app.get("/")
async def read_root():
    """API health check endpoint"""
    return {
        "message": "SimpleTTS API is running",
        "version": "1.0.0",
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat()
    }

@app.get("/voices", response_model=List[VoiceInfo])
async def get_voices():
    """Get all available voices from Edge TTS"""
    voices = await get_cached_voices()
    formatted_voices = [
        VoiceInfo(
            name=voice["Name"],
            gender=voice["Gender"],
            locale=voice["Locale"]
        )
        for voice in voices
    ]
    return formatted_voices

@app.post("/upload", response_model=UploadResponse)
@limiter.limit(settings.upload_rate_limit)
async def upload_file(
    request: Request,
    file: UploadFile = File(...),
    username: str = Depends(verify_credentials),
    db: Session = Depends(get_db)
):
    """Upload a file for processing"""
    logger.info(f"File upload initiated by {username}: {file.filename}")
    
    # Validate file
    await validate_file_size(file)
    await validate_file_type(file)
    
    try:
        # Generate a unique ID for the file
        file_id = str(uuid.uuid4())
        
        # Get the filename safely
        original_filename = file.filename or "uploaded_file.txt"
        safe_filename = re.sub(r'[^\w\-_\.]', '_', original_filename)
        
        file_path = Path(settings.upload_dir) / f"{file_id}_{safe_filename}"
        
        # Save the uploaded file
        content = await file.read()
        async with aiofiles.open(file_path, 'wb') as out_file:
            await out_file.write(content)
        
        # Detect encoding and convert to UTF-8 if necessary
        result = chardet.detect(content)
        encoding = result.get('encoding', 'utf-8')
        confidence = result.get('confidence', 0)
        
        logger.info(f"File encoding detected: {encoding} (confidence: {confidence})")
        
        # Create UTF-8 version of the file
        utf8_path = Path(settings.upload_dir) / f"{file_id}_utf8_{safe_filename}"
        
        if encoding and encoding.lower() != 'utf-8':
            try:
                decoded_content = content.decode(encoding)
                async with aiofiles.open(utf8_path, 'w', encoding='utf-8') as utf8_file:
                    await utf8_file.write(decoded_content)
            except Exception as e:
                logger.error(f"Failed to convert file to UTF-8: {str(e)}")
                raise HTTPException(status_code=400, detail=f"Failed to convert file to UTF-8: {str(e)}")
        else:
            # File is already UTF-8
            async with aiofiles.open(utf8_path, 'wb') as utf8_file:
                await utf8_file.write(content)
        
        # Save to database
        db_file = FileUpload(
            id=file_id,
            filename=safe_filename,
            original_filename=original_filename,
            file_size=len(content),
            encoding=encoding,
            encoding_confidence=confidence
        )
        db.add(db_file)
        db.commit()
        
        logger.info(f"File uploaded successfully: {file_id}")
        
        return UploadResponse(
            file_id=file_id,
            filename=safe_filename,
            original_encoding=encoding,
            encoding_confidence=confidence,
            size=len(content)
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"File upload failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"File upload failed: {str(e)}")

@app.post("/tts", response_model=TTSResponse)
@limiter.limit(settings.tts_rate_limit)
async def text_to_speech(
    request: Request,
    tts_request: TTSRequest,
    username: str = Depends(verify_credentials),
    db: Session = Depends(get_db)
):
    """Convert text to speech"""
    logger.info(f"TTS request from {username}: voice={tts_request.voice}, text_length={len(tts_request.text)}")
    
    output_id = str(uuid.uuid4())
    output_path = Path(settings.output_dir) / f"{output_id}.mp3"
    
    try:
        # Process TTS
        await process_text_to_speech(
            tts_request.text,
            str(output_path),
            tts_request.voice,
            tts_request.rate,
            tts_request.volume,
            tts_request.pitch
        )
        
        # Save to database
        db_generation = TTSGeneration(
            output_id=output_id,
            voice=tts_request.voice,
            text_length=len(tts_request.text),
            rate=tts_request.rate,
            volume=tts_request.volume,
            pitch=tts_request.pitch,
            original_name=tts_request.filename or "text_to_speech.txt"
        )
        db.add(db_generation)
        db.commit()
        
        logger.info(f"TTS processing completed: {output_id}")
        
        return TTSResponse(
            success=True,
            output_id=output_id,
            output_url=f"/outputs/{output_id}.mp3",
            message="Text-to-speech conversion completed successfully"
        )
        
    except Exception as e:
        logger.error(f"TTS processing failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"TTS processing failed: {str(e)}")

@app.post("/batch-process", response_model=BatchProcessResponse)
@limiter.limit(settings.batch_rate_limit)
async def batch_process(
    request: Request,
    batch_request: BatchProcessRequest,
    username: str = Depends(verify_credentials),
    db: Session = Depends(get_db)
):
    """Batch process multiple files"""
    logger.info(f"Batch processing request from {username}: {len(batch_request.file_ids)} files")
    
    output_files = []
    batch_id = str(uuid.uuid4())
    
    try:
        # Create batch record
        db_batch = BatchProcess(
            batch_id=batch_id,
            file_count=len(batch_request.file_ids),
            voice=batch_request.voice,
            rate=batch_request.rate,
            volume=batch_request.volume,
            pitch=batch_request.pitch
        )
        db.add(db_batch)
        db.commit()
        
        for file_id in batch_request.file_ids:
            # Find the UTF-8 converted file
            utf8_files = list(Path(settings.upload_dir).glob(f"{file_id}_utf8_*"))
            
            if not utf8_files:
                logger.error(f"File not found: {file_id}")
                raise HTTPException(status_code=404, detail=f"File {file_id} not found")
            
            utf8_file = utf8_files[0]
            
            # Read the file content safely
            text = await safe_file_read(utf8_file)
            
            # Create output file
            output_id = str(uuid.uuid4())
            output_path = Path(settings.output_dir) / f"{output_id}.mp3"
            
            # Process TTS
            await process_text_to_speech(
                text,
                str(output_path),
                batch_request.voice,
                batch_request.rate,
                batch_request.volume,
                batch_request.pitch
            )
            
            # Save to database
            original_name = utf8_file.name.replace(f"{file_id}_utf8_", "")
            db_generation = TTSGeneration(
                output_id=output_id,
                file_id=file_id,
                voice=batch_request.voice,
                text_length=len(text),
                rate=batch_request.rate,
                volume=batch_request.volume,
                pitch=batch_request.pitch,
                original_name=original_name,
                is_batch=True,
                batch_id=batch_id
            )
            db.add(db_generation)
            
            # Add to output files
            output_files.append({
                "file_id": file_id,
                "original_name": original_name,
                "output_id": output_id,
                "output_url": f"/outputs/{output_id}.mp3"
            })
        
        # Mark batch as completed
        db_batch.is_completed = True
        db.commit()
        
        logger.info(f"Batch processing completed: {batch_id}")
        
        return BatchProcessResponse(
            success=True,
            files=output_files,
            message=f"Successfully processed {len(output_files)} files"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Batch processing failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Batch processing failed: {str(e)}")

@app.post("/create-zip")
async def create_zip(
    file_info: ProcessedFilesInfo,
    username: str = Depends(verify_credentials)
):
    """Create a ZIP archive of the specified output files"""
    logger.info(f"ZIP creation request from {username}: {len(file_info.file_ids)} files")
    
    try:
        # Create a buffer for the ZIP file
        zip_buffer = io.BytesIO()
        
        # Create a ZIP file in the buffer
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            for file_id in file_info.file_ids:
                # Get the file path
                file_path = Path(settings.output_dir) / f"{file_id}.mp3"
                
                if not file_path.exists():
                    logger.warning(f"File not found for ZIP: {file_id}")
                    continue
                
                # Add the file to the ZIP archive
                zip_file.write(file_path, arcname=f"{file_id}.mp3")
        
        # Reset the buffer position to the beginning
        zip_buffer.seek(0)
        
        # Create a unique ID for the ZIP file
        zip_id = str(uuid.uuid4())
        
        logger.info(f"ZIP file created: {zip_id}")
        
        # Return the buffer as a streaming response
        return StreamingResponse(
            io.BytesIO(zip_buffer.read()),
            media_type="application/zip",
            headers={
                "Content-Disposition": f"attachment; filename=tts_batch_{zip_id}.zip"
            }
        )
        
    except Exception as e:
        logger.error(f"Failed to create ZIP file: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create ZIP file: {str(e)}")

@app.get("/download/{output_id}")
async def download_file(output_id: str, username: str = Depends(verify_credentials), db: Session = Depends(get_db)):
    """Download processed audio file"""
    logger.info(f"Download request from {username}: {output_id}")
    
    # Remove .mp3 extension if present in the output_id
    clean_id = output_id.replace('.mp3', '')
    
    file_path = Path(settings.output_dir) / f"{clean_id}.mp3"
    
    if not file_path.exists():
        logger.error(f"File not found: {clean_id}.mp3")
        raise HTTPException(status_code=404, detail=f"File not found: {clean_id}.mp3")
    
    # Try to get original filename from database
    db_generation = db.query(TTSGeneration).filter(TTSGeneration.output_id == clean_id).first()
    
    if db_generation and db_generation.original_name:
        original_name = db_generation.original_name
        if not original_name.lower().endswith('.mp3'):
            original_filename = Path(original_name).stem + '.mp3'
        else:
            original_filename = original_name
    else:
        original_filename = f"{clean_id}.mp3"
    
    logger.info(f"File download: {original_filename}")
    
    return FileResponse(
        path=file_path,
        filename=original_filename,
        media_type="audio/mpeg"
    )

@app.delete("/file/{file_id}", response_model=SuccessResponse)
async def delete_file(file_id: str, username: str = Depends(verify_credentials), db: Session = Depends(get_db)):
    """Delete an uploaded file"""
    logger.info(f"File deletion request from {username}: {file_id}")
    
    # Find all files with this ID
    files = list(Path(settings.upload_dir).glob(f"{file_id}*"))
    
    if not files:
        raise HTTPException(status_code=404, detail="File not found")
    
    # Delete all files with this ID
    for file in files:
        file.unlink()
    
    # Mark as deleted in database
    db_file = db.query(FileUpload).filter(FileUpload.id == file_id).first()
    if db_file:
        db_file.is_deleted = True
        db.commit()
    
    logger.info(f"Files deleted: {file_id}")
    
    return SuccessResponse(
        success=True,
        message=f"Files with ID {file_id} deleted successfully"
    )

@app.delete("/output/{output_id}", response_model=SuccessResponse)
async def delete_output(output_id: str, username: str = Depends(verify_credentials), db: Session = Depends(get_db)):
    """Delete a processed output file"""
    logger.info(f"Output deletion request from {username}: {output_id}")
    
    file_path = Path(settings.output_dir) / f"{output_id}.mp3"
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Output file not found")
    
    file_path.unlink()
    
    # Mark as deleted in database
    db_generation = db.query(TTSGeneration).filter(TTSGeneration.output_id == output_id).first()
    if db_generation:
        db_generation.is_deleted = True
        db.commit()
    
    logger.info(f"Output deleted: {output_id}")
    
    return SuccessResponse(
        success=True,
        message=f"Output {output_id} deleted successfully"
    )

@app.get("/uploads")
async def list_uploads(username: str = Depends(verify_credentials)):
    """List all uploaded files"""
    try:
        files = [f.name for f in Path(settings.upload_dir).glob("*")]
        return {"files": files}
    except Exception as e:
        logger.error(f"Failed to list files: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to list files: {str(e)}")

@app.get("/file-content/{file_id}", response_model=FileContentResponse)
async def get_file_content_by_id(file_id: str, username: str = Depends(verify_credentials)):
    """Get the content of a file by its ID"""
    logger.info(f"File content request from {username}: {file_id}")
    
    try:
        # Find the UTF-8 converted file
        utf8_files = list(Path(settings.upload_dir).glob(f"{file_id}_utf8_*"))
        
        if not utf8_files:
            raise HTTPException(status_code=404, detail=f"File {file_id} not found")
        
        utf8_file = utf8_files[0]
        
        # Read the file content safely
        content = await safe_file_read(utf8_file)
        
        # Get file stats
        file_stats = utf8_file.stat()
        
        # Get the original filename without the prefix
        original_name = utf8_file.name.replace(f"{file_id}_utf8_", "")
        
        return FileContentResponse(
            content=content,
            filename=original_name,
            file_size=file_stats.st_size,
            encoding="utf-8"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to read file: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to read file: {str(e)}")

# Background tasks
async def cleanup_old_files():
    """Clean up old files to prevent disk space issues"""
    try:
        logger.info("Starting file cleanup...")
        
        # Get the current time
        now = datetime.utcnow()
        
        # Clean up files older than specified days
        max_age = timedelta(days=settings.max_file_age_days)
        
        cleanup_count = 0
        
        # Clean up uploaded files
        for file_path in Path(settings.upload_dir).glob("*"):
            if file_path.is_file():
                file_age = now - datetime.fromtimestamp(file_path.stat().st_mtime)
                if file_age > max_age:
                    file_path.unlink()
                    cleanup_count += 1
        
        # Clean up output files
        for file_path in Path(settings.output_dir).glob("*"):
            if file_path.is_file():
                file_age = now - datetime.fromtimestamp(file_path.stat().st_mtime)
                if file_age > max_age:
                    file_path.unlink()
                    cleanup_count += 1
        
        # Clean up temp files
        for file_path in Path(settings.temp_dir).glob("*"):
            if file_path.is_file():
                file_age = now - datetime.fromtimestamp(file_path.stat().st_mtime)
                if file_age > max_age:
                    file_path.unlink()
                    cleanup_count += 1
        
        logger.info(f"Cleanup completed: {cleanup_count} files removed")
        
    except Exception as e:
        logger.error(f"Error during cleanup: {str(e)}")

async def periodic_cleanup():
    """Run cleanup job periodically"""
    while True:
        try:
            await cleanup_old_files()
            # Wait for specified hours before the next cleanup
            await asyncio.sleep(settings.cleanup_interval_hours * 60 * 60)
        except asyncio.CancelledError:
            logger.info("Periodic cleanup task cancelled")
            break
        except Exception as e:
            logger.error(f"Error in periodic cleanup: {str(e)}")
            await asyncio.sleep(60)  # Wait 1 minute before retrying

# Custom OpenAPI schema
def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    openapi_schema = get_openapi(
        title="SimpleTTS API",
        version="1.0.0",
        description="Text-to-Speech API using Microsoft Edge TTS with authentication and rate limiting",
        routes=app.routes,
    )
    openapi_schema["info"]["x-logo"] = {
        "url": "https://fastapi.tiangolo.com/img/logo-margin/logo-teal.png"
    }
    app.openapi_schema = openapi_schema
    return app.openapi_schema

app.openapi = custom_openapi

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=True
    ) 