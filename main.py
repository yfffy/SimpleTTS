import os
import chardet
import nltk
import tempfile
import asyncio
import aiofiles
import uuid
import logging
from datetime import datetime
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, validator
from typing import List, Optional
import edge_tts
import shutil
from pathlib import Path
from fastapi.staticfiles import StaticFiles

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(f'tts_{datetime.now().strftime("%Y%m%d")}.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Download NLTK data if it doesn't exist
try:
    nltk.data.find('tokenizers/punkt')
except LookupError:
    nltk.download('punkt')

app = FastAPI(title="Edge TTS Web Interface")

# Setup CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create directories if they don't exist
UPLOAD_DIR = Path("uploads")
OUTPUT_DIR = Path("outputs")
TEMP_DIR = Path("temp")

for directory in [UPLOAD_DIR, OUTPUT_DIR, TEMP_DIR]:
    directory.mkdir(exist_ok=True)

# Serve static files
app.mount("/outputs", StaticFiles(directory="outputs"), name="outputs")

# Models
class TTSRequest(BaseModel):
    text: str
    voice: str
    rate: Optional[str] = "+0%"
    volume: Optional[str] = "+0%"
    pitch: Optional[str] = "+0Hz"

    @validator('rate')
    def validate_rate(cls, v):
        if not v.endswith('%'):
            raise ValueError('Rate must end with %')
        try:
            int(v[:-1])
        except ValueError:
            raise ValueError('Rate must be a valid percentage')
        return v

    @validator('volume')
    def validate_volume(cls, v):
        if not v.endswith('%'):
            raise ValueError('Volume must end with %')
        try:
            int(v[:-1])
        except ValueError:
            raise ValueError('Volume must be a valid percentage')
        return v

    @validator('pitch')
    def validate_pitch(cls, v):
        if not v.endswith('Hz'):
            raise ValueError('Pitch must end with Hz')
        try:
            int(v[:-2])
        except ValueError:
            raise ValueError('Pitch must be a valid frequency')
        return v

class BatchProcessRequest(BaseModel):
    file_ids: List[str]
    voice: str
    rate: Optional[str] = "+0%"
    volume: Optional[str] = "+0%"
    pitch: Optional[str] = "+0Hz"

class VoiceInfo(BaseModel):
    name: str
    gender: str
    locale: str

@app.get("/")
async def read_root():
    return {"message": "Edge TTS Web API is running"}

@app.get("/voices")
async def get_voices():
    """Get all available voices from Edge TTS"""
    voices = await edge_tts.list_voices()
    formatted_voices = [
        VoiceInfo(
            name=voice["Name"],
            gender=voice["Gender"],
            locale=voice["Locale"]
        )
        for voice in voices
    ]
    return formatted_voices

@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    """Upload a file for processing"""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
    
    # Check file size (limit to 10MB)
    MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 10MB")
    
    # Generate a unique ID for the file
    file_id = str(uuid.uuid4())
    file_path = UPLOAD_DIR / f"{file_id}_{file.filename}"
    
    try:
        # Save the uploaded file
        async with aiofiles.open(file_path, 'wb') as out_file:
            await out_file.write(content)
        
        logger.info(f"File uploaded successfully: {file.filename}")
        
        # Detect encoding and convert to UTF-8 if necessary
        rawdata = open(file_path, 'rb').read()
        result = chardet.detect(rawdata)
        encoding = result['encoding']
        
        # Create UTF-8 version of the file
        with open(file_path, 'rb') as file:
            content = file.read()
        
        # If the file is not UTF-8, convert it
        if encoding and encoding.lower() != 'utf-8':
            try:
                decoded_content = content.decode(encoding)
                utf8_path = UPLOAD_DIR / f"{file_id}_utf8_{file.filename}"
                with open(utf8_path, 'w', encoding='utf-8') as utf8_file:
                    utf8_file.write(decoded_content)
                logger.info(f"File converted from {encoding} to UTF-8")
            except Exception as e:
                logger.error(f"Failed to convert file to UTF-8: {str(e)}", exc_info=True)
                raise HTTPException(status_code=500, detail=f"Failed to convert file to UTF-8: {str(e)}")
        else:
            # File is already UTF-8, just create a copy with the expected name
            utf8_path = UPLOAD_DIR / f"{file_id}_utf8_{file.filename}"
            with open(utf8_path, 'wb') as utf8_file:
                utf8_file.write(content)
        
        return {
            "file_id": file_id,
            "filename": file.filename,
            "original_encoding": encoding,
            "size": len(content)
        }
    except Exception as e:
        logger.error(f"File upload failed: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"File upload failed: {str(e)}")

async def process_text_to_speech(text: str, output_file: str, voice: str, rate: str, volume: str, pitch: str):
    """Process text to speech using Edge TTS"""
    communicate = edge_tts.Communicate(text, voice, rate=rate, volume=volume, pitch=pitch)
    await communicate.save(output_file)

@app.post("/tts")
async def text_to_speech(request: TTSRequest, background_tasks: BackgroundTasks):
    """Convert text to speech"""
    output_id = str(uuid.uuid4())
    output_path = OUTPUT_DIR / f"{output_id}.mp3"
    
    try:
        logger.info(f"Processing TTS request for voice: {request.voice}")
        # Process TTS in the background
        await process_text_to_speech(
            request.text, 
            str(output_path), 
            request.voice, 
            request.rate, 
            request.volume, 
            request.pitch
        )
        
        logger.info(f"Successfully generated audio file: {output_id}.mp3")
        return {
            "success": True,
            "output_id": output_id,
            "output_url": f"/outputs/{output_id}.mp3"
        }
    except Exception as e:
        logger.error(f"TTS processing failed: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"TTS processing failed: {str(e)}")

@app.post("/batch-process")
async def batch_process(request: BatchProcessRequest):
    """Batch process multiple files"""
    output_files = []
    
    try:
        for file_id in request.file_ids:
            # Find the UTF-8 converted file
            utf8_files = list(UPLOAD_DIR.glob(f"{file_id}_utf8_*"))
            
            if not utf8_files:
                raise HTTPException(status_code=404, detail=f"File {file_id} not found")
            
            utf8_file = utf8_files[0]
            
            # Read the file content
            with open(utf8_file, 'r', encoding='utf-8') as f:
                text = f.read()
            
            # Create output file
            output_id = str(uuid.uuid4())
            output_path = OUTPUT_DIR / f"{output_id}.mp3"
            
            # Process TTS
            await process_text_to_speech(
                text, 
                str(output_path), 
                request.voice, 
                request.rate, 
                request.volume, 
                request.pitch
            )
            
            # Add to output files
            original_name = utf8_file.name.replace(f"{file_id}_utf8_", "")
            output_files.append({
                "file_id": file_id,
                "original_name": original_name,
                "output_id": output_id,
                "output_url": f"/outputs/{output_id}.mp3"
            })
        
        return {
            "success": True,
            "files": output_files
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Batch processing failed: {str(e)}")

@app.get("/download/{output_id}")
async def download_file(output_id: str):
    """Download processed audio file"""
    file_path = OUTPUT_DIR / f"{output_id}.mp3"
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    return FileResponse(path=file_path, filename=f"{output_id}.mp3", media_type="audio/mpeg")

@app.delete("/file/{file_id}")
async def delete_file(file_id: str):
    """Delete an uploaded file"""
    # Find all files with this ID
    files = list(UPLOAD_DIR.glob(f"{file_id}*"))
    
    if not files:
        raise HTTPException(status_code=404, detail="File not found")
    
    # Delete all files with this ID
    for file in files:
        file.unlink()
    
    return {"success": True, "message": f"Files with ID {file_id} deleted"}

@app.delete("/output/{output_id}")
async def delete_output(output_id: str):
    """Delete a processed output file"""
    file_path = OUTPUT_DIR / f"{output_id}.mp3"
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Output file not found")
    
    file_path.unlink()
    
    return {"success": True, "message": f"Output {output_id} deleted"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True) 