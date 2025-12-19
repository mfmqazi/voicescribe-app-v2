// VoiceScribe Configuration
// This file allows users to override settings without modifying the main app

// Override default URLs by uncommenting and setting:
// window.VOICESCRIBE_CONFIG = {
//     voskUrl: 'ws://your-vosk-server:2700',
//     libreUrl: 'https://your-libretranslate-server'
// };

// Default configuration (used if localStorage is empty)
window.VOICESCRIBE_CONFIG = {
    voskUrl: 'ws://localhost:2700',
    libreUrl: 'https://libretranslate.com'
};
