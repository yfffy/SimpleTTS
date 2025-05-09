import os
import chardet
import nltk
import tempfile
import asyncio
import aiofiles
import uuid
import zipfile
import io
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import edge_tts
import shutil
from pathlib import Path
from fastapi.staticfiles import StaticFiles
import json
import datetime

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
    filename: Optional[str] = None

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

class ProcessedFilesInfo(BaseModel):
    file_ids: List[str]
    
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
    # Generate a unique ID for the file
    file_id = str(uuid.uuid4())
    
    # Get the filename safely
    original_filename = file.filename
    if not original_filename:
        original_filename = "uploaded_file.txt"
    
    file_path = UPLOAD_DIR / f"{file_id}_{original_filename}"
    
    # Save the uploaded file
    async with aiofiles.open(file_path, 'wb') as out_file:
        content = await file.read()
        await out_file.write(content)
    
    # Detect encoding and convert to UTF-8 if necessary
    rawdata = open(file_path, 'rb').read()
    result = chardet.detect(rawdata)
    encoding = result['encoding']
    confidence = result.get('confidence', 0)
    
    # Create UTF-8 version of the file
    with open(file_path, 'rb') as source_file:
        content = source_file.read()
    
    # If the file is not UTF-8, convert it
    if encoding and encoding.lower() != 'utf-8':
        try:
            decoded_content = content.decode(encoding)
            utf8_path = UPLOAD_DIR / f"{file_id}_utf8_{original_filename}"
            with open(utf8_path, 'w', encoding='utf-8') as utf8_file:
                utf8_file.write(decoded_content)
        except Exception as e:
            return {"error": f"Failed to convert file to UTF-8: {str(e)}"}
    else:
        # File is already UTF-8, just create a copy with the expected name
        utf8_path = UPLOAD_DIR / f"{file_id}_utf8_{original_filename}"
        with open(utf8_path, 'wb') as utf8_file:
            utf8_file.write(content)
    
    return {
        "file_id": file_id,
        "filename": original_filename,
        "original_encoding": encoding,
        "encoding_confidence": confidence,
        "size": len(content)
    }

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
        # Process TTS in the background
        await process_text_to_speech(
            request.text, 
            str(output_path), 
            request.voice, 
            request.rate, 
            request.volume, 
            request.pitch
        )
        
        # Store metadata for this generation
        metadata = {
            "output_id": output_id,
            "created_at": datetime.datetime.now().isoformat(),
            "text_length": len(request.text),
            "voice": request.voice,
            "original_name": request.filename if hasattr(request, 'filename') and request.filename else "text_to_speech.txt"
        }
        
        metadata_path = TEMP_DIR / f"{output_id}.tts_info"
        async with aiofiles.open(metadata_path, 'w') as f:
            await f.write(json.dumps(metadata))
        
        return {
            "success": True,
            "output_id": output_id,
            "output_url": f"/outputs/{output_id}.mp3"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TTS processing failed: {str(e)}")

@app.post("/batch-process")
async def batch_process(request: BatchProcessRequest):
    """Batch process multiple files"""
    output_files = []
    batch_id = str(uuid.uuid4())
    
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
        
        # Store batch information in temp directory for filename tracking
        batch_info = {
            "batch_id": batch_id,
            "created_at": datetime.datetime.now().isoformat(),
            "files": output_files
        }
        
        batch_info_path = TEMP_DIR / f"{batch_id}.batch_info"
        async with aiofiles.open(batch_info_path, 'w') as f:
            await f.write(json.dumps(batch_info))
        
        return {
            "success": True,
            "files": output_files
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Batch processing failed: {str(e)}")

@app.post("/create-zip")
async def create_zip(file_info: ProcessedFilesInfo):
    """Create a ZIP archive of the specified output files"""
    try:
        # Create a buffer for the ZIP file
        zip_buffer = io.BytesIO()
        
        # Create a ZIP file in the buffer
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            for file_id in file_info.file_ids:
                # Get the file path
                file_path = OUTPUT_DIR / f"{file_id}.mp3"
                
                if not file_path.exists():
                    continue
                
                # Add the file to the ZIP archive
                zip_file.write(file_path, arcname=f"{file_id}.mp3")
        
        # Reset the buffer position to the beginning
        zip_buffer.seek(0)
        
        # Create a unique ID for the ZIP file
        zip_id = str(uuid.uuid4())
        
        # Return the buffer as a streaming response
        return StreamingResponse(
            zip_buffer,
            media_type="application/zip",
            headers={
                "Content-Disposition": f"attachment; filename=tts_batch_{zip_id}.zip"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create ZIP file: {str(e)}")

@app.get("/download/{output_id}")
async def download_file(output_id: str):
    """Download processed audio file"""
    # Remove .mp3 extension if present in the output_id
    clean_id = output_id.replace('.mp3', '')
    
    file_path = OUTPUT_DIR / f"{clean_id}.mp3"
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail=f"File not found: {clean_id}.mp3")
    
    # Try to find the original filename from the metadata if it exists
    original_filename = f"{clean_id}.mp3"  # Default fallback
    
    # Check if this is a batch file with metadata
    batch_file_info = None
    for batch_path in TEMP_DIR.glob("*.batch_info"):
        async with aiofiles.open(batch_path, 'r') as f:
            batch_data = await f.read()
            try:
                batch_info = json.loads(batch_data)
                for file_info in batch_info.get("files", []):
                    if file_info.get("output_id") == clean_id:
                        batch_file_info = file_info
                        break
                if batch_file_info:
                    break
            except:
                pass
    
    if batch_file_info and "original_name" in batch_file_info:
        original_name = batch_file_info["original_name"]
        if not original_name.lower().endswith('.mp3'):
            original_filename = original_name.rsplit('.', 1)[0] + '.mp3'
        else:
            original_filename = original_name
    
    return FileResponse(
        path=file_path, 
        filename=original_filename, 
        media_type="audio/mpeg"
    )

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

@app.get("/uploads")
async def list_uploads():
    """List all uploaded files"""
    try:
        files = [f.name for f in UPLOAD_DIR.glob("*")]
        return files
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list files: {str(e)}")

@app.get("/file/{filename}")
async def get_file_content(filename: str):
    """Get the content of a file"""
    file_path = UPLOAD_DIR / filename
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    try:
        async with aiofiles.open(file_path, 'r', encoding='utf-8') as file:
            content = await file.read()
        return content
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read file: {str(e)}")

@app.get("/file-content/{file_id}")
async def get_file_content_by_id(file_id: str):
    """Get the content of a file by its ID"""
    try:
        # Find the UTF-8 converted file
        utf8_files = list(UPLOAD_DIR.glob(f"{file_id}_utf8_*"))
        
        if not utf8_files:
            raise HTTPException(status_code=404, detail=f"File {file_id} not found")
        
        utf8_file = utf8_files[0]
        
        # Read the file content
        async with aiofiles.open(utf8_file, 'r', encoding='utf-8') as file:
            content = await file.read()
        
        # Get the original filename without the prefix
        original_name = utf8_file.name.replace(f"{file_id}_utf8_", "")
        
        return {
            "content": content,
            "filename": original_name
        }
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=f"Failed to read file: {str(e)}")

async def cleanup_old_files():
    """Clean up old files to prevent disk space issues"""
    try:
        # Get the current time
        now = datetime.datetime.now()
        
        # Clean up files older than 7 days (adjust as needed)
        max_age = datetime.timedelta(days=7)
        
        # Clean up uploaded files
        for file_path in UPLOAD_DIR.glob("*"):
            if file_path.is_file():
                file_age = now - datetime.datetime.fromtimestamp(file_path.stat().st_mtime)
                if file_age > max_age:
                    file_path.unlink()
        
        # Clean up output files
        for file_path in OUTPUT_DIR.glob("*"):
            if file_path.is_file():
                file_age = now - datetime.datetime.fromtimestamp(file_path.stat().st_mtime)
                if file_age > max_age:
                    file_path.unlink()
        
        # Clean up temp files
        for file_path in TEMP_DIR.glob("*"):
            if file_path.is_file():
                file_age = now - datetime.datetime.fromtimestamp(file_path.stat().st_mtime)
                if file_age > max_age:
                    file_path.unlink()
        
        print(f"Cleanup completed at {now.isoformat()}")
    except Exception as e:
        print(f"Error during cleanup: {str(e)}")

@app.on_event("startup")
async def startup_event():
    """Startup event handler"""
    # Schedule periodic cleanup
    asyncio.create_task(periodic_cleanup())

async def periodic_cleanup():
    """Run cleanup job periodically"""
    while True:
        await cleanup_old_files()
        # Wait for 24 hours before the next cleanup
        await asyncio.sleep(24 * 60 * 60)  # 24 hours in seconds

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True) 