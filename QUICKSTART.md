# SimpleTTS - Quick Start Guide

Get the improved SimpleTTS application running in minutes!

## 🚀 Quick Start (Docker - Recommended)

### Prerequisites
- Docker and Docker Compose installed
- 2GB free disk space
- Internet connection for downloading models

### 1. Clone and Start
```bash
# Clone the repository (if you haven't already)
git clone <your-repo-url>
cd simpletts

# Start all services
docker-compose up -d --build

# View logs (optional)
docker-compose logs -f
```

### 2. Access the Application
- **Web Interface**: http://localhost:5002
- **API Documentation**: http://localhost:5001/docs
- **Default Credentials**: 
  - Username: `admin`
  - Password: `admin123`

### 3. Test the Application
1. Open http://localhost:5002 in your browser
2. Sign in with the default credentials
3. Upload a text file or type some text
4. Select a voice and click "Generate Speech"
5. Download and play your audio file!

---

## 🛠️ Manual Installation

### Backend Setup
```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set up configuration
cp env.example .env

# Start the backend
python main.py
```

### Frontend Setup
```bash
cd frontend

# Install dependencies
npm install

# Set API URL
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local

# Start the frontend
npm run dev
```

---

## 🔐 Security Configuration

### Change Default Credentials (IMPORTANT!)
```bash
# Edit backend/.env
AUTH_USERNAME=your_username
AUTH_PASSWORD=your_secure_password

# Restart the backend
docker-compose restart backend
# OR if running manually:
python backend/main.py
```

### Production Settings
```bash
# In backend/.env
AUTH_USERNAME=your_production_username
AUTH_PASSWORD=very_secure_password_here
MAX_FILE_SIZE_MB=5
UPLOAD_RATE_LIMIT=5/minute
MAX_FILE_AGE_DAYS=3
LOG_LEVEL=WARNING
```

---

## 📝 Basic Usage

### Upload and Convert Files
1. **Upload**: Drag & drop text files (.txt, .md, .csv, etc.)
2. **Select Voice**: Choose from 400+ available voices
3. **Adjust Settings**: Rate, volume, pitch (optional)
4. **Convert**: Click "Process All Files" for batch conversion
5. **Download**: Individual files or ZIP archive

### Supported File Types
- `.txt` - Plain text files
- `.md` - Markdown files
- `.csv` - Comma-separated values
- `.srt` - Subtitle files
- `.html` - HTML files
- `.json` - JSON files
- And more text-based formats

### Voice Selection
- **English**: en-US-AndrewNeural, en-US-JennyNeural, etc.
- **Spanish**: es-ES-AlvaroNeural, es-MX-DaliaNeural, etc.
- **French**: fr-FR-DeniseNeural, fr-CA-AntoineNeural, etc.
- **German**: de-DE-KatjaNeural, de-AT-IngridNeural, etc.
- **And 40+ other languages**

---

## 🔧 Configuration Options

### File Limits
```bash
MAX_FILE_SIZE_MB=10        # Maximum file size for uploads
MAX_TEXT_LENGTH=10000      # Maximum characters for TTS
MAX_FILE_AGE_DAYS=7        # Days before automatic cleanup
```

### Rate Limiting
```bash
UPLOAD_RATE_LIMIT=10/minute    # File uploads per minute
TTS_RATE_LIMIT=30/minute       # TTS requests per minute
BATCH_RATE_LIMIT=5/minute      # Batch operations per minute
```

### Performance
```bash
CLEANUP_INTERVAL_HOURS=24      # How often to clean old files
VOICES_CACHE_TTL=3600          # Voice list cache duration
```

---

## 🚨 Troubleshooting

### Common Issues

#### "Connection refused" error
- Check if backend is running: `curl http://localhost:8000/`
- Verify Docker containers: `docker-compose ps`
- Check logs: `docker-compose logs backend`

#### "Authentication failed"
- Verify credentials in backend/.env
- Try default: admin/admin123
- Restart backend after changing credentials

#### "File upload failed"
- Check file size (default limit: 10MB)
- Verify file type (must be text-based)
- Check available disk space

#### "Voice loading takes too long"
- First load downloads voice list from Microsoft
- Subsequent loads use cache (much faster)
- Check internet connection

### Health Check
```bash
# Check backend health
curl http://localhost:8000/

# Check with authentication
curl -u admin:admin123 http://localhost:8000/

# View API documentation
open http://localhost:8000/docs
```

### Log Files
```bash
# Docker logs
docker-compose logs backend
docker-compose logs frontend

# Manual installation logs
# Backend logs appear in terminal
# Frontend logs in browser console
```

---

## 🎯 Next Steps

### Production Deployment
1. **Change default credentials**
2. **Set up HTTPS/SSL**
3. **Configure firewall rules**
4. **Set up monitoring**
5. **Regular backups**

### Advanced Features
- **API Integration**: Use the REST API for automation
- **Bulk Processing**: Upload multiple files at once
- **Custom Voices**: Explore different voice options
- **Audio Settings**: Fine-tune speech parameters

### Monitoring
- Monitor the `/` endpoint for health checks
- Check disk space regularly
- Set up log rotation
- Monitor API response times

---

## 📞 Getting Help

### Resources
- **API Documentation**: http://localhost:8000/docs
- **Improvement Guide**: See IMPROVEMENTS.md
- **Source Code**: Browse the codebase for details

### Support
- Check logs for error messages
- Verify configuration settings
- Test with default credentials
- Ensure all dependencies are installed

---

**🎉 You're Ready!** Your SimpleTTS application is now running with enterprise-grade security, reliability, and performance features. Enjoy converting text to speech with 400+ voices! 