# VoiceScribe - Speech to Text with Translation

Real-time speech-to-text transcription with automatic Bosnian to English translation.

**[🔴 Live Demo](https://mfmqazi.github.io/voicescribe-app-v2/)**

## Features

- 🎤 **Live Recording** - Real-time transcription using browser's Web Speech API
- 📁 **File Upload** - Transcribe audio files (requires Vosk server)
- 🌐 **Translation** - Automatic Bosnian to English translation via LibreTranslate
- ✨ **Modern UI** - Beautiful glassmorphism design
- 📱 **Mobile Friendly** - Responsive design for all devices
- 🔄 **Works Anywhere** - No server needed for live speech recognition!

## How It Works

### Live Recording (No Server Needed!)
The app uses the browser's built-in **Web Speech API** for live transcription:
- Works in **Chrome, Edge, and Safari**
- Supports **Bosnian (bs-BA)** and **English (en-US)**
- Requires internet connection (audio is processed by browser's cloud service)
- **Translation** uses LibreTranslate.com (public instance)

### File Upload (Optional Vosk Server)
For audio file transcription, you can optionally run a Vosk server:
```bash
docker run -d -p 2700:2700 alphacep/kaldi-bs
```

## Setup

### Quick Start (No Installation)
1. Open the [Live Demo](https://mfmqazi.github.io/voicescribe-app-v2/)
2. Select language (Bosnian or English)
3. Click the microphone button
4. Allow microphone access
5. Start speaking!

### Run Locally
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
5. Wait for processing

## Settings

Click the ⚙️ settings icon to configure:
- **Vosk WebSocket URL**: For file transcription (default: `ws://localhost:2700`)
- **LibreTranslate URL**: For translation (default: `https://libretranslate.com`)

## Supported Browsers

| Browser | Live Recording | File Upload |
|---------|---------------|-------------|
| Chrome  | ✅ Full Support | ✅ (with Vosk) |
| Edge    | ✅ Full Support | ✅ (with Vosk) |
| Safari  | ✅ Full Support | ✅ (with Vosk) |
| Firefox | ❌ Not Supported | ✅ (with Vosk) |

## Supported Audio Formats (File Upload)

- MP3
- WAV
- M4A
- OGG

## Technology Stack

- **Frontend**: HTML, CSS, JavaScript (Vanilla)
- **Live Recording**: Web Speech API (browser native)
- **File Transcription**: Vosk (optional, self-hosted)
- **Translation**: LibreTranslate (public or self-hosted)
- **Build Tool**: Vite

## Self-Hosting (Optional)

For complete offline capability, you can self-host:

### LibreTranslate
```bash
docker run -ti --rm -p 5000:5000 libretranslate/libretranslate
```

### Vosk Server (for Bosnian)
```bash
docker run -d -p 2700:2700 alphacep/kaldi-bs
```

Then update the settings to use your local servers.

## License

MIT
