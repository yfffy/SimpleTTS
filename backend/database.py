from sqlalchemy import create_engine, Column, String, DateTime, Integer, Float, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
import uuid

# Create the database engine (SQLite for simplicity)
DATABASE_URL = "sqlite:///./tts_database.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

# Create a SessionLocal class
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create a Base class
Base = declarative_base()

class FileUpload(Base):
    __tablename__ = "file_uploads"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    filename = Column(String, nullable=False)
    original_filename = Column(String, nullable=False)
    upload_time = Column(DateTime, default=datetime.utcnow)
    file_size = Column(Integer, nullable=False)
    encoding = Column(String)
    encoding_confidence = Column(Float)
    is_deleted = Column(Boolean, default=False)

class TTSGeneration(Base):
    __tablename__ = "tts_generations"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    output_id = Column(String, unique=True, nullable=False)
    file_id = Column(String)  # Can be null for direct text input
    voice = Column(String, nullable=False)
    generation_time = Column(DateTime, default=datetime.utcnow)
    text_length = Column(Integer)
    rate = Column(String)
    volume = Column(String)
    pitch = Column(String)
    original_name = Column(String)
    is_batch = Column(Boolean, default=False)
    batch_id = Column(String)
    is_deleted = Column(Boolean, default=False)

class BatchProcess(Base):
    __tablename__ = "batch_processes"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    batch_id = Column(String, unique=True, nullable=False)
    created_time = Column(DateTime, default=datetime.utcnow)
    file_count = Column(Integer, nullable=False)
    voice = Column(String, nullable=False)
    rate = Column(String)
    volume = Column(String)
    pitch = Column(String)
    is_completed = Column(Boolean, default=False)

# Dependency to get database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Create all tables
def create_tables():
    Base.metadata.create_all(bind=engine) 