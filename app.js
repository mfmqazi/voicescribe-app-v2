
// ========================================
// GOOGLE DRIVE CONFIGURATION
// ========================================
// ⚠️ IMPORTANT: You must replace these with your own keys from Google Cloud Console
const GOOGLE_API_KEY = 'YOUR_API_KEY';
const GOOGLE_CLIENT_ID = 'YOUR_CLIENT_ID';
const GOOGLE_APP_ID = 'YOUR_PROJECT_NUMBER';

// ========================================
// STATE MANAGEMENT
// ========================================
const state = {
    currentMode: 'record',
    isRecording: false,
    recognition: null,
    recordingTimer: null,
    recordingStartTime: 0,
    currentAudioFile: null,
    transcriptText: '',
    translationText: '',
    translationDebounce: null,
    worker: null, // Web Worker for Whisper
    isModelLoading: false,
    tokenClient: null,
    accessToken: null,
    pickerInited: false,
    gisInited: false
};

// ========================================
// DOM ELEMENTS
// ========================================
const elements = {
    // Mode switching
    recordModeBtn: document.getElementById('recordModeBtn'),
    uploadModeBtn: document.getElementById('uploadModeBtn'),
    recordMode: document.getElementById('recordMode'),
    uploadMode: document.getElementById('uploadMode'),

    // Recording
    recordBtn: document.getElementById('recordBtn'),
    recordStatus: document.getElementById('recordStatus'),
    recordingInfo: document.getElementById('recordingInfo'),
    recordTimer: document.getElementById('recordTimer'),

    // Upload
    uploadZone: document.getElementById('uploadZone'),
    fileInput: document.getElementById('fileInput'),
    uploadProgress: document.getElementById('uploadProgress'),
    fileName: document.getElementById('fileName'),
    fileSize: document.getElementById('fileSize'),
    progressFill: document.getElementById('progressFill'),
    transcribeBtn: document.getElementById('transcribeBtn'),
    googleDriveBtn: document.getElementById('googleDriveBtn'),

    // Language
    languageSelect: document.getElementById('language'),
    originalLanguageLabel: document.getElementById('originalLanguageLabel'),

    // Output
    outputSection: document.getElementById('outputSection'),
    transcriptText: document.getElementById('transcriptText'),
    translationText: document.getElementById('translationText'),
    translationStatus: document.getElementById('translationStatus'),
    wordCount: document.getElementById('wordCount'),
    charCount: document.getElementById('charCount'),

    // Actions
    copyBtn: document.getElementById('copyBtn'),
    downloadBtn: document.getElementById('downloadBtn'),
    clearBtn: document.getElementById('clearBtn'),

    // Toast
    toast: document.getElementById('toast'),
    toastMessage: document.getElementById('toastMessage')
};

// ========================================
// INITIALIZATION
// ========================================
function init() {
    checkSpeechRecognitionSupport();
    setupEventListeners();
    updateStats();
    updateLanguageLabels();

    // Initialize Web Worker
    state.worker = new Worker('worker.js', { type: 'module' });

    state.worker.addEventListener('message', (event) => {
        const { type, data, error } = event.data;

        if (type === 'ready') {
            console.log('Whisper model loaded in worker');
            state.isModelLoading = false;
        } else if (type === 'download') {
            // Model downloading progress
            if (data.status === 'progress') {
                showToast(`Downloading AI Model: ${Math.round(data.progress)}%`, 'info');
            }
        } else if (type === 'error') {
            showToast(`Error: ${error}`, 'error');
            resetTranscribeButton();
        }
    });

    // Pre-load the model
    state.worker.postMessage({ type: 'load' });

    // Load Google APIs
    if (typeof gapi !== 'undefined') gapi.load('picker', onPickerApiLoad);
    if (typeof google !== 'undefined') onGisLoaded();
}

function checkSpeechRecognitionSupport() {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        state.recognition = new SpeechRecognition();
        state.recognition.continuous = true;
        state.recognition.interimResults = true;

        state.recognition.onresult = handleSpeechResult;
        state.recognition.onerror = (event) => {
            console.error('Speech recognition error', event.error);
            stopRecording();
            showToast('Microphone error: ' + event.error, 'error');
        };
    } else {
        showToast('Speech Recognition not supported in this browser', 'error');
        elements.recordBtn.disabled = true;
    }
}

function setupEventListeners() {
    // Mode Switching
    elements.recordModeBtn.addEventListener('click', () => switchMode('record'));
    elements.uploadModeBtn.addEventListener('click', () => switchMode('upload'));

    // Recording
    elements.recordBtn.addEventListener('click', toggleRecording);

    // File Upload
    elements.uploadZone.addEventListener('click', (e) => {
        if (e.target !== elements.googleDriveBtn && !elements.googleDriveBtn.contains(e.target)) {
            elements.fileInput.click();
        }
    });
    elements.uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        elements.uploadZone.classList.add('drag-over');
    });
    elements.uploadZone.addEventListener('dragleave', () => {
        elements.uploadZone.classList.remove('drag-over');
    });
    elements.uploadZone.addEventListener('drop', handleDrop);
    elements.fileInput.addEventListener('change', handleFileSelect);
    elements.transcribeBtn.addEventListener('click', transcribeAudioFile);

    // Google Drive
    elements.googleDriveBtn.addEventListener('click', handleGoogleDriveAuth);

    // Actions
    elements.copyBtn.addEventListener('click', copyTranscript);
    elements.downloadBtn.addEventListener('click', downloadTranscript);
    elements.clearBtn.addEventListener('click', clearTranscript);
    elements.languageSelect.addEventListener('change', updateLanguageLabels);

    // Text Editing
    elements.transcriptText.addEventListener('input', updateStats);
}

// ========================================
// CORE LOGIC
// ========================================

function switchMode(mode) {
    state.currentMode = mode;

    // UI Updates
    elements.recordModeBtn.classList.toggle('active', mode === 'record');
    elements.uploadModeBtn.classList.toggle('active', mode === 'upload');

    if (mode === 'record') {
        elements.recordMode.classList.add('active');
        elements.uploadMode.classList.remove('active');
    } else {
        elements.recordMode.classList.remove('active');
        elements.uploadMode.classList.add('active');
        stopRecording();
    }
}

function updateLanguageLabels() {
    const isBosnian = elements.languageSelect.value === 'bs-BA';
    elements.originalLanguageLabel.textContent = isBosnian ? '🇧🇦 Bosnian (Original)' : '🇺🇸 English (Original)';
}

// --- Recording ---

function toggleRecording() {
    if (state.isRecording) {
        stopRecording();
    } else {
        startRecording();
    }
}

function startRecording() {
    state.isRecording = true;
    state.transcriptText = ''; // Clear previous
    state.translationText = '';
    updateTranscript('');
    elements.translationText.textContent = '';

    elements.recordBtn.classList.add('recording');
    elements.recordStatus.textContent = 'Listening...';
    elements.recordingInfo.classList.add('active');

    state.recognition.lang = elements.languageSelect.value;
    state.recognition.start();

    state.recordingStartTime = Date.now();
    state.recordingTimer = setInterval(updateTimer, 1000);
}

function stopRecording() {
    if (!state.isRecording) return;

    state.isRecording = false;
    elements.recordBtn.classList.remove('recording');
    elements.recordStatus.textContent = 'Tap to start recording';
    elements.recordingInfo.classList.remove('active');

    if (state.recognition) state.recognition.stop();
    clearInterval(state.recordingTimer);
    elements.recordTimer.textContent = '0:00';
}

function updateTimer() {
    const diff = Math.floor((Date.now() - state.recordingStartTime) / 1000);
    const mins = Math.floor(diff / 60);
    const secs = diff % 60;
    elements.recordTimer.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
}

function handleSpeechResult(event) {
    let interimTranscript = '';
    let finalTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
        } else {
            interimTranscript += event.results[i][0].transcript;
        }
    }

    if (finalTranscript) {
        state.transcriptText += finalTranscript + ' ';
        updateTranscript(state.transcriptText);

        // Translate final text
        if (elements.languageSelect.value === 'bs-BA') {
            translateText(finalTranscript);
        }
    }
}

// --- Translation (Live) ---

function translateText(text) {
    // Debounce translation requests
    clearTimeout(state.translationDebounce);
    state.translationDebounce = setTimeout(async () => {
        try {
            elements.translationStatus.classList.add('active');
            // Use MyMemory API for live recording (lightweight)
            const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=bs|en`;
            const response = await fetch(url);
            const data = await response.json();

            if (data.responseStatus === 200 && data.responseData) {
                const translation = data.responseData.translatedText;
                const currentTranslation = elements.translationText.textContent;
                const newTranslation = currentTranslation ? (currentTranslation + ' ' + translation) : translation;

                state.translationText = newTranslation;
                elements.translationText.textContent = newTranslation;
            }
        } catch (error) {
            console.error('Translation error:', error);
        } finally {
            elements.translationStatus.classList.remove('active');
        }
    }, 1000);
}

// --- File Upload ---

function handleDrop(e) {
    e.preventDefault();
    elements.uploadZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('audio/')) {
        handleFile(file);
    } else {
        showToast('Please upload an audio file', 'error');
    }
}

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) handleFile(file);
}

function handleFile(file) {
    state.currentAudioFile = file;
    elements.fileName.textContent = file.name;
    elements.fileSize.textContent = formatFileSize(file.size);
    elements.uploadProgress.classList.add('active');
    elements.uploadProgress.style.display = 'block'; // Ensure visibility
    elements.transcribeBtn.disabled = false;
    elements.progressFill.style.width = '0%';

    // Reset output
    state.transcriptText = '';
    state.translationText = '';
    updateTranscript('');
    elements.translationText.textContent = '';
}

async function transcribeAudioFile() {
    if (!state.currentAudioFile) return;

    // Check if API key is configured
    const ASSEMBLYAI_API_KEY = '1ffebe07721840f3a94fbafa56eb069f';

    if (ASSEMBLYAI_API_KEY === 'YOUR_ASSEMBLYAI_API_KEY') {
        showToast('⚠️ Please configure your AssemblyAI API key in app.js', 'error');
        resetTranscribeButton();
        return;
    }

    elements.transcribeBtn.disabled = true;
    elements.transcribeBtn.classList.add('processing');
    updateProgress(0, 'Uploading audio...');

    try {
        // 1. Upload the audio file to AssemblyAI
        const uploadResponse = await fetch('https://api.assemblyai.com/v2/upload', {
            method: 'POST',
            headers: {
                'authorization': ASSEMBLYAI_API_KEY,
            },
            body: state.currentAudioFile
        });

        if (!uploadResponse.ok) {
            throw new Error('Failed to upload audio file');
        }

        const { upload_url } = await uploadResponse.json();
        updateProgress(20, 'Starting transcription...');

        // 2. Request transcription
        // Note: AssemblyAI auto-detects language if not specified
        // For Bosnian, we'll let it auto-detect since 'bs' might not be supported
        const transcriptResponse = await fetch('https://api.assemblyai.com/v2/transcript', {
            method: 'POST',
            headers: {
                'authorization': ASSEMBLYAI_API_KEY,
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                audio_url: upload_url,
                language_detection: true // Auto-detect language
            })
        });

        if (!transcriptResponse.ok) {
            const errorData = await transcriptResponse.json();
            throw new Error(errorData.error || 'Failed to start transcription');
        }

        const { id } = await transcriptResponse.json();
        updateProgress(30, 'Processing...');

        // 3. Poll for completion
        let transcript = null;
        while (true) {
            const pollingResponse = await fetch(`https://api.assemblyai.com/v2/transcript/${id}`, {
                headers: {
                    'authorization': ASSEMBLYAI_API_KEY
                }
            });

            transcript = await pollingResponse.json();

            if (transcript.status === 'completed') {
                break;
            } else if (transcript.status === 'error') {
                throw new Error(transcript.error || 'Transcription failed');
            }

            // Update progress based on status
            if (transcript.status === 'processing') {
                updateProgress(50, 'Transcribing...');
            } else if (transcript.status === 'queued') {
                updateProgress(40, 'In queue...');
            }

            // Wait 2 seconds before polling again
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        updateProgress(90, 'Finalizing...');

        // 4. Display results
        state.transcriptText = transcript.text;
        updateTranscript(transcript.text);

        // Translate if Bosnian (using external API with chunking)
        if (elements.languageSelect.value === 'bs-BA') {
            updateProgress(95, 'Translating...');
            try {
                // Split text into chunks (MyMemory has URL length limits)
                const MAX_CHUNK_LENGTH = 500; // characters
                const words = transcript.text.split(' ');
                let chunks = [];
                let currentChunk = '';

                for (const word of words) {
                    if ((currentChunk + ' ' + word).length > MAX_CHUNK_LENGTH) {
                        chunks.push(currentChunk.trim());
                        currentChunk = word;
                    } else {
                        currentChunk += (currentChunk ? ' ' : '') + word;
                    }
                }
                if (currentChunk) chunks.push(currentChunk.trim());

                // Translate each chunk
                let fullTranslation = '';
                for (const chunk of chunks) {
                    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(chunk)}&langpair=bs|en`;
                    const response = await fetch(url);
                    const data = await response.json();

                    if (data.responseStatus === 200 && data.responseData) {
                        fullTranslation += data.responseData.translatedText + ' ';
                    }

                    // Small delay to avoid rate limiting
                    await new Promise(resolve => setTimeout(resolve, 200));
                }

                state.translationText = fullTranslation.trim();
                elements.translationText.textContent = fullTranslation.trim();
            } catch (error) {
                console.error('Translation error:', error);
                showToast('⚠️ Translation failed, but transcription is complete', 'warning');
            }
        }

        updateProgress(100, 'Complete!');
        showToast('✅ Transcription complete!', 'success');

    } catch (error) {
        console.error('AssemblyAI error:', error);
        showToast('❌ Failed: ' + error.message, 'error');
    } finally {
        setTimeout(resetTranscribeButton, 1000);
    }
}


// Helper to remove common Whisper hallucinations (repetitive loops)
function removeHallucinations(text) {
    if (!text) return '';

    // 1. Remove single character repetitions (e.g., "u u u u u u")
    text = text.replace(/\b(\w)\s+\1(\s+\1)+/gi, '');

    // 2. Remove word repetitions (e.g., "nekočas, nekočas, nekočas")
    text = text.replace(/\b(\w+)([,\s]+\1){2,}/gi, '$1');

    // 3. Remove phrase repetitions - MORE AGGRESSIVE
    // This catches "and we are going to talk about the reality of the world, and we are going to talk..."
    // Look for any sequence of 5+ words that repeats
    const words = text.split(/\s+/);
    for (let len = 5; len <= 15; len++) {
        for (let i = 0; i <= words.length - len * 2; i++) {
            const phrase = words.slice(i, i + len).join(' ').toLowerCase();
            const nextPhrase = words.slice(i + len, i + len * 2).join(' ').toLowerCase();
            if (phrase === nextPhrase) {
                // Found a repetition, remove everything from the second occurrence onward
                text = words.slice(0, i + len).join(' ');
                return text.trim();
            }
        }
    }

    // 4. Filter out common hallucinated phrases
    const hallucinations = [
        'Subtitles by', 'Amara.org', 'Audible', 'MOJE', 'uvolestnji',
        'Thank you for watching', 'Subscribe', 'Like and subscribe'
    ];

    for (const h of hallucinations) {
        if (text.toLowerCase().includes(h.toLowerCase())) return '';
    }

    // 5. If text is mostly repetitive characters, discard it
    const uniqueChars = new Set(text.replace(/\s/g, '')).size;
    if (text.length > 50 && uniqueChars < 5) return '';

    return text.trim();
}

async function translateChunk(text) {
    if (!text) return;

    try {
        elements.translationStatus.classList.add('active');
        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=bs|en`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.responseStatus === 200 && data.responseData) {
            const translation = data.responseData.translatedText;
            const currentTranslation = elements.translationText.textContent;
            const newTranslation = currentTranslation ? (currentTranslation + ' ' + translation) : translation;

            state.translationText = newTranslation;
            elements.translationText.textContent = newTranslation;
        }
    } catch (error) {
        console.error('Translation error:', error);
    } finally {
        elements.translationStatus.classList.remove('active');
    }
}

function updateProgress(percent, text) {
    elements.transcribeBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" style="animation: spin 1s linear infinite;">
            <path d="M10 3C10.5523 3 11 3.44772 11 4V6C11 6.55228 10.5523 7 10 7C9.44772 7 9 6.55228 9 6V4C9 3.44772 9.44772 3 10 3Z"/>
            <path opacity="0.3" d="M10 13C10.5523 13 11 13.4477 11 14V16C11 16.5523 10.5523 17 10 17C9.44772 17 9 16.5523 9 16V14C9 13.4477 9.44772 13 10 13Z"/>
        </svg>
        ${text}
    `;
    if (elements.uploadProgress.classList.contains('active')) {
        elements.progressFill.style.width = `${percent}%`;
    }
}

function resetTranscribeButton() {
    elements.transcribeBtn.disabled = false;
    elements.transcribeBtn.classList.remove('processing');
    elements.transcribeBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10 3C10.5523 3 11 3.44772 11 4V9.58579L13.2929 7.29289C13.6834 6.90237 14.3166 6.90237 14.7071 7.29289C15.0976 7.68342 15.0976 8.31658 14.7071 8.70711L10.7071 12.7071C10.3166 13.0976 9.68342 13.0976 9.29289 12.7071L5.29289 8.70711C4.90237 8.31658 4.90237 7.68342 5.29289 7.29289C5.68342 6.90237 6.31658 6.90237 6.70711 7.29289L9 9.58579V4C9 3.44772 9.44772 3 10 3Z"/>
            <path d="M4 13C4.55228 13 5 13.4477 5 14C5 14.5523 5.44772 15 6 15H14C14.5523 15 15 14.5523 15 15V14C15 13.4477 15.4477 13 16 13C16.5523 13 17 13.4477 17 14C17 15.6569 15.6569 17 14 17H6C4.34315 17 3 15.6569 3 15V14C3 13.4477 3.44772 13 4 13Z"/>
        </svg>
        Transcribe Audio
    `;
}

// ========================================
// UTILS
// ========================================

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function showToast(message, type = 'success') {
    elements.toastMessage.textContent = message;
    elements.toast.className = `toast show ${type}`;
    setTimeout(() => {
        elements.toast.classList.remove('show');
    }, 3000);
}

function updateTranscript(text) {
    elements.transcriptText.textContent = text;
    updateStats();
}

function updateStats() {
    const text = elements.transcriptText.textContent || '';
    elements.wordCount.textContent = text.trim() ? text.trim().split(/\s+/).length : 0;
    elements.charCount.textContent = text.length;
}

function copyTranscript() {
    const original = elements.transcriptText.textContent;
    const translated = elements.translationText.textContent;
    const text = (elements.languageSelect.value === 'bs-BA' && translated)
        ? `Original:\n${original}\n\nTranslation:\n${translated}`
        : original;

    navigator.clipboard.writeText(text)
        .then(() => showToast('✅ Copied!', 'success'))
        .catch(() => showToast('❌ Failed to copy', 'error'));
}

function downloadTranscript() {
    const original = elements.transcriptText.textContent;
    const translated = elements.translationText.textContent;
    const text = (elements.languageSelect.value === 'bs-BA' && translated)
        ? `Original:\n${original}\n\nTranslation:\n${translated}`
        : original;

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcript-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

function clearTranscript() {
    if (confirm('Clear all text?')) {
        elements.transcriptText.textContent = '';
        elements.translationText.textContent = '';
        state.transcriptText = '';
        state.translationText = '';
        updateStats();
    }
}

// ========================================
// GOOGLE DRIVE INTEGRATION
// ========================================

function onPickerApiLoad() {
    state.pickerInited = true;
}

function onGisLoaded() {
    state.tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: 'https://www.googleapis.com/auth/drive.readonly',
        callback: '', // defined later
    });
    state.gisInited = true;
}

function handleGoogleDriveAuth() {
    if (GOOGLE_API_KEY === 'YOUR_API_KEY') {
        alert('Please configure GOOGLE_API_KEY in app.js');
        return;
    }

    state.tokenClient.callback = async (response) => {
        if (response.error !== undefined) {
            throw (response);
        }
        state.accessToken = response.access_token;
        createPicker();
    };

    if (state.accessToken === null) {
        state.tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
        state.tokenClient.requestAccessToken({ prompt: '' });
    }
}

function createPicker() {
    const view = new google.picker.View(google.picker.ViewId.DOCS);
    view.setMimeTypes('audio/*');

    const picker = new google.picker.PickerBuilder()
        .enableFeature(google.picker.Feature.NAV_HIDDEN)
        .setDeveloperKey(GOOGLE_API_KEY)
        .setAppId(GOOGLE_APP_ID)
        .setOAuthToken(state.accessToken)
        .addView(view)
        .addView(new google.picker.DocsUploadView())
        .setCallback(pickerCallback)
        .build();
    picker.setVisible(true);
}

async function pickerCallback(data) {
    if (data.action === google.picker.Action.PICKED) {
        const fileId = data.docs[0].id;
        const fileName = data.docs[0].name;
        showToast('Downloading file from Drive...', 'info');
        await downloadDriveFile(fileId, fileName);
    }
}

async function downloadDriveFile(fileId, fileName) {
    try {
        const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
            headers: {
                'Authorization': `Bearer ${state.accessToken}`
            }
        });

        if (!response.ok) throw new Error('Download failed');

        const blob = await response.blob();
        const file = new File([blob], fileName, { type: blob.type });
        handleFile(file);

    } catch (error) {
        console.error('Drive download error:', error);
        showToast('Failed to download file', 'error');
    }
}

// Start App
init();
