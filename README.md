# SimpleTTS

A modern web interface for edge-tts (Microsoft Edge's Text-to-Speech engine), featuring both single text conversion and batch processing capabilities.

![SimpleTTS Screenshot](https://i.imgur.com/placeholder.png)

## Features

- 🔊 Convert text to speech using Microsoft Edge's high-quality TTS voices
- 🌐 Support for 400+ voices across multiple languages and locales
- 📊 Batch processing for multiple text files
- 📁 Automatic file encoding detection and UTF-8 conversion
- ⚙️ Customize speech parameters (rate, volume, pitch)
- 📥 Download individual MP3 files or create ZIP archives for batch outputs
- 🔄 Clean and responsive UI built with Next.js and shadcn/ui
- 🐳 Easy deployment with Docker

## Getting Started

### Prerequisites

- [Docker](https://www.docker.com/get-started) and Docker Compose

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/simpletts.git
   cd simpletts
   ```

2. Build and start the containers:
   ```bash
   docker compose up -d
   ```

   To rebuild the containers after making changes:
   ```bash
   docker compose up -d --build
   ```

3. Access the application:
   - Web interface: http://localhost:5002
   - API: http://localhost:5001

## Usage

### Single Text Conversion

1. Enter or paste text in the text area (or upload a text file)
2. Select a voice from the dropdown menu
3. Adjust speech parameters (rate, volume, pitch) if desired
4. Click "Generate Speech"
5. Play the audio directly in the browser or download the MP3 file

### Batch Processing

1. Go to the "Batch Processing" page
2. Upload one or more text files (they will be automatically converted to UTF-8)
3. Select a voice and adjust speech parameters
4. Click "Convert [X] Files to Speech"
5. Play or download individual files, or use "Download All as ZIP"

## API Endpoints

The backend exposes several RESTful API endpoints:

- `GET /voices` - List all available voices
- `POST /tts` - Convert text to speech
- `POST /upload` - Upload a text file
- `GET /file-content/{file_id}` - Get content of an uploaded file
- `POST /batch-process` - Process multiple files
- `GET /download/{output_id}` - Download a generated audio file
- `POST /create-zip` - Create a ZIP archive of multiple audio files

## Development

### Project Structure

```
simpletts/
├── backend/             # FastAPI backend service
│   ├── main.py          # API implementation
│   ├── requirements.txt # Python dependencies
│   └── Dockerfile       # Backend container configuration
├── frontend/            # Next.js frontend service
│   ├── src/             # React components and pages
│   ├── public/          # Static assets
│   └── Dockerfile       # Frontend container configuration
├── docker-compose.yml   # Container orchestration
├── README.md            # Project documentation
└── LICENSE              # MIT License
```

### Customization

- **File retention**: By default, uploaded and generated files are kept for 7 days before being automatically deleted. This can be adjusted in `backend/main.py`.
- **Ports**: The default ports are 5001 (backend) and 5002 (frontend). These can be changed in `docker-compose.yml`.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [edge-tts](https://github.com/rany2/edge-tts) for the core TTS functionality
- [FastAPI](https://fastapi.tiangolo.com/) for the backend framework
- [Next.js](https://nextjs.org/) for the frontend framework
- [shadcn/ui](https://ui.shadcn.com/) for the UI components 