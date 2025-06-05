import pytest
import asyncio
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import tempfile
import os
from pathlib import Path

from main import app
from database import get_db, Base
from config import settings

# Create a test database
SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Override the get_db dependency
def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

# Create test client
client = TestClient(app)

@pytest.fixture(scope="module")
def setup_database():
    """Setup test database"""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)

@pytest.fixture
def auth_headers():
    """Return basic auth headers for testing"""
    import base64
    credentials = base64.b64encode(f"{settings.auth_username}:{settings.auth_password}".encode()).decode()
    return {"Authorization": f"Basic {credentials}"}

@pytest.fixture
def test_file():
    """Create a temporary test file"""
    with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
        f.write("This is a test file for TTS conversion.")
        temp_path = f.name
    
    yield temp_path
    
    # Cleanup
    if os.path.exists(temp_path):
        os.unlink(temp_path)

class TestAPI:
    """Test class for API endpoints"""
    
    def test_health_check(self):
        """Test the health check endpoint"""
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "SimpleTTS API is running"
        assert "version" in data
        assert "status" in data
        assert "timestamp" in data

    def test_get_voices(self):
        """Test the voices endpoint"""
        response = client.get("/voices")
        assert response.status_code == 200
        voices = response.json()
        assert isinstance(voices, list)
        assert len(voices) > 0
        # Check voice structure
        voice = voices[0]
        assert "name" in voice
        assert "gender" in voice
        assert "locale" in voice

    def test_upload_without_auth(self, test_file):
        """Test file upload without authentication"""
        with open(test_file, 'rb') as f:
            response = client.post("/upload", files={"file": f})
        assert response.status_code == 401

    def test_upload_with_auth(self, setup_database, auth_headers, test_file):
        """Test file upload with authentication"""
        with open(test_file, 'rb') as f:
            response = client.post(
                "/upload", 
                files={"file": (os.path.basename(test_file), f, "text/plain")},
                headers=auth_headers
            )
        assert response.status_code == 200
        data = response.json()
        assert "file_id" in data
        assert "filename" in data
        assert "original_encoding" in data
        assert "size" in data

    def test_upload_invalid_file_type(self, setup_database, auth_headers):
        """Test upload with invalid file type"""
        # Create a fake binary file
        with tempfile.NamedTemporaryFile(suffix='.exe', delete=False) as f:
            f.write(b'\x00\x01\x02\x03')
            temp_path = f.name
        
        try:
            with open(temp_path, 'rb') as f:
                response = client.post(
                    "/upload",
                    files={"file": (os.path.basename(temp_path), f, "application/octet-stream")},
                    headers=auth_headers
                )
            assert response.status_code == 400
        finally:
            os.unlink(temp_path)

    def test_upload_large_file(self, setup_database, auth_headers):
        """Test upload with file too large"""
        # Create a file larger than the limit
        large_content = "x" * (settings.max_file_size_mb * 1024 * 1024 + 1)
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
            f.write(large_content)
            temp_path = f.name
        
        try:
            with open(temp_path, 'rb') as f:
                response = client.post(
                    "/upload",
                    files={"file": (os.path.basename(temp_path), f, "text/plain")},
                    headers=auth_headers
                )
            assert response.status_code == 413
        finally:
            os.unlink(temp_path)

    def test_tts_without_auth(self):
        """Test TTS without authentication"""
        response = client.post("/tts", json={
            "text": "Hello world",
            "voice": "en-US-AndrewNeural"
        })
        assert response.status_code == 401

    def test_tts_with_auth(self, setup_database, auth_headers):
        """Test TTS with authentication"""
        response = client.post("/tts", json={
            "text": "Hello world",
            "voice": "en-US-AndrewNeural"
        }, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "output_id" in data
        assert "output_url" in data

    def test_tts_invalid_data(self, setup_database, auth_headers):
        """Test TTS with invalid data"""
        # Test empty text
        response = client.post("/tts", json={
            "text": "",
            "voice": "en-US-AndrewNeural"
        }, headers=auth_headers)
        assert response.status_code == 422

        # Test invalid voice format
        response = client.post("/tts", json={
            "text": "Hello",
            "voice": "invalid voice name!"
        }, headers=auth_headers)
        assert response.status_code == 422

        # Test text too long
        long_text = "x" * (settings.max_text_length + 1)
        response = client.post("/tts", json={
            "text": long_text,
            "voice": "en-US-AndrewNeural"
        }, headers=auth_headers)
        assert response.status_code == 422

    def test_batch_process_without_auth(self):
        """Test batch processing without authentication"""
        response = client.post("/batch-process", json={
            "file_ids": ["test-id"],
            "voice": "en-US-AndrewNeural"
        })
        assert response.status_code == 401

    def test_batch_process_nonexistent_files(self, setup_database, auth_headers):
        """Test batch processing with nonexistent files"""
        response = client.post("/batch-process", json={
            "file_ids": ["nonexistent-id"],
            "voice": "en-US-AndrewNeural"
        }, headers=auth_headers)
        assert response.status_code == 404

    def test_file_operations_without_auth(self):
        """Test file operations without authentication"""
        # Test file listing
        response = client.get("/uploads")
        assert response.status_code == 401
        
        # Test file deletion
        response = client.delete("/file/test-id")
        assert response.status_code == 401
        
        # Test output deletion
        response = client.delete("/output/test-id")
        assert response.status_code == 401

    def test_file_listing_with_auth(self, setup_database, auth_headers):
        """Test file listing with authentication"""
        response = client.get("/uploads", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "files" in data
        assert isinstance(data["files"], list)

    def test_create_zip_without_auth(self):
        """Test ZIP creation without authentication"""
        response = client.post("/create-zip", json={
            "file_ids": ["test-id"]
        })
        assert response.status_code == 401

    def test_download_without_auth(self):
        """Test file download without authentication"""
        response = client.get("/download/test-id")
        assert response.status_code == 401

class TestModels:
    """Test Pydantic models validation"""
    
    def test_tts_request_validation(self):
        """Test TTSRequest model validation"""
        from models import TTSRequest
        
        # Valid request
        valid_request = TTSRequest(
            text="Hello world",
            voice="en-US-AndrewNeural",
            rate="+10%",
            volume="-5%",
            pitch="+50Hz"
        )
        assert valid_request.text == "Hello world"
        
        # Test text sanitization
        dirty_request = TTSRequest(
            text="Hello <script>alert('xss')</script> world",
            voice="en-US-AndrewNeural"
        )
        assert "<script>" not in dirty_request.text
        
        # Test filename sanitization
        filename_request = TTSRequest(
            text="Hello",
            voice="en-US-AndrewNeural",
            filename="bad/filename<>.txt"
        )
        assert "/" not in filename_request.filename
        assert "<" not in filename_request.filename

    def test_batch_request_validation(self):
        """Test BatchProcessRequest model validation"""
        from models import BatchProcessRequest
        import uuid
        
        # Valid request
        valid_id = str(uuid.uuid4())
        valid_request = BatchProcessRequest(
            file_ids=[valid_id],
            voice="en-US-AndrewNeural"
        )
        assert len(valid_request.file_ids) == 1
        
        # Invalid UUID format
        with pytest.raises(ValueError):
            BatchProcessRequest(
                file_ids=["invalid-uuid"],
                voice="en-US-AndrewNeural"
            )

class TestUtilities:
    """Test utility functions"""
    
    @pytest.mark.asyncio
    async def test_safe_file_read(self):
        """Test safe file reading with size limits"""
        from main import safe_file_read
        
        # Create a test file
        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
            f.write("This is a test file.")
            temp_path = Path(f.name)
        
        try:
            # Test normal read
            content = await safe_file_read(temp_path)
            assert content == "This is a test file."
            
            # Test size limit
            with pytest.raises(Exception):  # Should raise HTTPException
                await safe_file_read(temp_path, max_size=5)
        finally:
            temp_path.unlink()

if __name__ == "__main__":
    pytest.main([__file__]) 