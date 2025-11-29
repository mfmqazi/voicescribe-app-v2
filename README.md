# VoiceScribe - Speech to Text with Translation

Real-time speech-to-text transcription with automatic Bosnian to English translation.

## Features

- 🎤 **Live Recording** - Real-time transcription using Web Speech API
- 📁 **File Upload** - Professional transcription using AssemblyAI
- 🌐 **Translation** - Automatic Bosnian to English translation
- ✨ **Modern UI** - Beautiful glassmorphism design
- 📱 **Mobile Friendly** - Responsive design for all devices

## Setup

### 1. Get AssemblyAI API Key

1. Go to [AssemblyAI](https://www.assemblyai.com/)
2. Sign up for a free account
3. Copy your API key from the dashboard

### 2. Configure the App

Open `app.js` and replace the placeholder with your API key:

```javascript
const ASSEMBLYAI_API_KEY = 'YOUR_ASSEMBLYAI_API_KEY'; // Replace with your actual key
```

### 3. Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:5173/`

## Usage

### Live Recording
1. Click "Live Recording" tab
2. Select language (Bosnian or English)
3. Click the microphone button to start
4. Speak naturally
5. Translation appears in real-time (for Bosnian)

### File Upload
1. Click "Upload File" tab
2. Select language
3. Drag & drop or click to select an audio file
4. Click "Transcribe Audio"
5. Wait for processing (cloud-based, high quality)

## Supported Audio Formats

- MP3
- WAV
- M4A
- OGG

## Technology Stack

- **Frontend**: HTML, CSS, JavaScript (Vanilla)
- **Live Recording**: Web Speech API
- **File Transcription**: AssemblyAI API
- **Translation**: AssemblyAI Translation API
- **Build Tool**: Vite

## Free Tier Limits

AssemblyAI free tier includes:
- 5 hours of audio per month
- All features included
- No credit card required

## License

MIT
