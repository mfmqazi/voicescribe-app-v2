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
    voskSocket: null,
    audioContext: null,
    mediaStream: null,
    processor: null,
    recordingStartTime: 0,
    recordingTimer: null,
    currentAudioFile: null,
    transcriptText: '',
    translationText: '',
    translationDebounce: null,

    // Settings
    voskUrl: localStorage.getItem('voskUrl') || 'ws://localhost:2700',
    libreUrl: localStorage.getItem('libreUrl') || 'http://localhost:5000',

    // Google Drive (kept for file picker)
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

    // Language & Settings
    languageSelect: document.getElementById('language'),
    originalLanguageLabel: document.getElementById('originalLanguageLabel'),
    settingsBtn: document.getElementById('settingsBtn'),
    settingsModal: document.getElementById('settingsModal'),
    closeSettingsBtn: document.getElementById('closeSettingsBtn'),
    saveSettingsBtn: document.getElementById('saveSettingsBtn'),
    voskUrlInput: document.getElementById('voskUrl'),
    libreUrlInput: document.getElementById('libreUrl'),

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
    setupEventListeners();
    updateStats();
    updateLanguageLabels();
    loadSettings();

    // Load Google APIs
    if (typeof gapi !== 'undefined') gapi.load('picker', onPickerApiLoad);
    if (typeof google !== 'undefined') onGisLoaded();
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

    // Settings
    elements.settingsBtn.addEventListener('click', openSettings);
    elements.closeSettingsBtn.addEventListener('click', closeSettings);
    elements.saveSettingsBtn.addEventListener('click', saveSettings);
    elements.settingsModal.addEventListener('click', (e) => {
        if (e.target === elements.settingsModal) closeSettings();
    });

    // Actions
    elements.copyBtn.addEventListener('click', copyTranscript);
    elements.downloadBtn.addEventListener('click', downloadTranscript);
    elements.clearBtn.addEventListener('click', clearTranscript);
    elements.languageSelect.addEventListener('change', updateLanguageLabels);

    // Text Editing
    elements.transcriptText.addEventListener('input', updateStats);
}

function loadSettings() {
    elements.voskUrlInput.value = state.voskUrl;
    elements.libreUrlInput.value = state.libreUrl;
}

function openSettings() {
    elements.settingsModal.classList.add('active');
}

function closeSettings() {
    elements.settingsModal.classList.remove('active');
}

function saveSettings() {
    state.voskUrl = elements.voskUrlInput.value.trim();
    state.libreUrl = elements.libreUrlInput.value.trim();

    // Remove trailing slash from LibreTranslate URL if present
    if (state.libreUrl.endsWith('/')) {
        state.libreUrl = state.libreUrl.slice(0, -1);
    }

    localStorage.setItem('voskUrl', state.voskUrl);
    localStorage.setItem('libreUrl', state.libreUrl);

    closeSettings();
    showToast('Settings saved!', 'success');
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

// --- Vosk Recording Logic ---

async function startRecording() {
    try {
        state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        state.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });

        // Connect to Vosk Server
        state.voskSocket = new WebSocket(state.voskUrl);

        state.voskSocket.onopen = () => {
            console.log('Connected to Vosk Server');
            setupAudioProcessing();

            // UI Updates
            state.isRecording = true;
            state.transcriptText = '';
            state.translationText = '';
            updateTranscript('');
            elements.translationText.textContent = '';

            elements.recordBtn.classList.add('recording');
            elements.recordStatus.textContent = 'Listening...';
            elements.recordingInfo.classList.add('active');

            state.recordingStartTime = Date.now();
            state.recordingTimer = setInterval(updateTimer, 1000);
        };

        state.voskSocket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.partial) {
                // Handle partial results if needed (optional)
            }
            if (data.text) {
                const newText = data.text;
                if (newText && newText.length > 0) {
                    state.transcriptText += newText + ' ';
                    updateTranscript(state.transcriptText);

                    // Translate
                    if (elements.languageSelect.value === 'bs-BA') {
                        translateText(newText);
                    }
                }
            }
        };

        state.voskSocket.onerror = (error) => {
            console.error('Vosk WebSocket Error:', error);
            showToast('Connection to Vosk server failed. Check settings.', 'error');
            stopRecording();
        };

        state.voskSocket.onclose = () => {
            console.log('Vosk WebSocket Closed');
            if (state.isRecording) stopRecording();
        };

    } catch (error) {
        console.error('Microphone Error:', error);
        showToast('Microphone access denied or error.', 'error');
    }
}

function setupAudioProcessing() {
    const source = state.audioContext.createMediaStreamSource(state.mediaStream);
    // Vosk usually expects 16kHz mono, but server might resample. 
    // Ideally we should resample here, but for simplicity we send raw float32 or downsampled.
    // Standard Vosk server often expects raw PCM 16-bit mono at sample rate.

    // We'll use a ScriptProcessor (deprecated but simple) or AudioWorklet.
    // For simplicity in this v2 demo, let's use ScriptProcessor to downsample to 16kHz.

    const bufferSize = 4096;
    state.processor = state.audioContext.createScriptProcessor(bufferSize, 1, 1);

    source.connect(state.processor);
    state.processor.connect(state.audioContext.destination);

    state.processor.onaudioprocess = (e) => {
        if (!state.voskSocket || state.voskSocket.readyState !== WebSocket.OPEN) return;

        const inputData = e.inputBuffer.getChannelData(0);
        // Downsample to 16kHz if needed, or just send if server handles it.
        // Most Vosk docker images expect 16000Hz.
        // We'll do a simple downsampling.

        const targetSampleRate = 16000; // Vosk default
        const downsampledBuffer = downsampleBuffer(inputData, state.audioContext.sampleRate, targetSampleRate);

        // Convert to 16-bit PCM
        const pcmData = floatTo16BitPCM(downsampledBuffer);
        state.voskSocket.send(pcmData);
    };
}

function stopRecording() {
    if (!state.isRecording) return;

    state.isRecording = false;
    elements.recordBtn.classList.remove('recording');
    elements.recordStatus.textContent = 'Tap to start recording';
    elements.recordingInfo.classList.remove('active');

    if (state.voskSocket) {
        state.voskSocket.close();
        state.voskSocket = null;
    }

    if (state.mediaStream) {
        state.mediaStream.getTracks().forEach(track => track.stop());
        state.mediaStream = null;
    }

    if (state.processor) {
        state.processor.disconnect();
        state.processor = null;
    }

    if (state.audioContext) {
        state.audioContext.close();
        state.audioContext = null;
    }

    clearInterval(state.recordingTimer);
    elements.recordTimer.textContent = '0:00';
}

function toggleRecording() {
    if (state.isRecording) {
        stopRecording();
    } else {
        startRecording();
    }
}

function updateTimer() {
    const diff = Math.floor((Date.now() - state.recordingStartTime) / 1000);
    const mins = Math.floor(diff / 60);
    const secs = diff % 60;
    elements.recordTimer.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
}

// --- Audio Utils ---

function downsampleBuffer(buffer, sampleRate, outSampleRate) {
    if (outSampleRate == sampleRate) {
        return buffer;
    }
    if (outSampleRate > sampleRate) {
        throw "downsampling rate show be smaller than original sample rate";
    }
    var sampleRateRatio = sampleRate / outSampleRate;
    var newLength = Math.round(buffer.length / sampleRateRatio);
    var result = new Float32Array(newLength);
    var offsetResult = 0;
    var offsetBuffer = 0;
    while (offsetResult < result.length) {
        var nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
        var accum = 0, count = 0;
        for (var i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
            accum += buffer[i];
            count++;
        }
        result[offsetResult] = accum / count;
        offsetResult++;
        offsetBuffer = nextOffsetBuffer;
    }
    return result;
}

function floatTo16BitPCM(output) {
    var buffer = new ArrayBuffer(output.length * 2);
    var view = new DataView(buffer);
    for (var i = 0; i < output.length; i++) {
        var s = Math.max(-1, Math.min(1, output[i]));
        view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
    return buffer;
}

// --- LibreTranslate Logic ---

async function translateText(text, immediate = false) {
    if (!text) return;

    const doTranslate = async () => {
        try {
            elements.translationStatus.classList.add('active');

            const response = await fetch(`${state.libreUrl}/translate`, {
                method: "POST",
                body: JSON.stringify({
                    q: text,
                    source: "bs", // Bosnian
                    target: "en", // English
                    format: "text"
                }),
                headers: { "Content-Type": "application/json" }
            });

            if (!response.ok) throw new Error(`Translation failed: ${response.statusText}`);

            const data = await response.json();

            if (data.translatedText) {
                // For file upload (immediate), we replace. For live, we might want to append or replace.
                // Since we pass the FULL text for file upload, replacing is correct.
                // For live, we usually append to state.transcriptText and call this with the NEW chunk.
                // Wait, for live recording, we are appending newText to state.transcriptText, 
                // but passing ONLY newText to translateText.
                // So for live, we should APPEND.
                // For file upload, we pass the WHOLE text.

                // Let's handle this by checking if we are in 'immediate' mode (file upload) or not.

                if (immediate) {
                    state.translationText = data.translatedText;
                    elements.translationText.textContent = data.translatedText;
                } else {
                    // Live mode: append
                    const currentTranslation = elements.translationText.textContent;
                    const newTranslation = currentTranslation ? (currentTranslation + ' ' + data.translatedText) : data.translatedText;
                    state.translationText = newTranslation;
                    elements.translationText.textContent = newTranslation;
                }
            }

        } catch (error) {
            console.error('LibreTranslate Error:', error);
            showToast('Translation failed. Check settings.', 'warning');
        } finally {
            elements.translationStatus.classList.remove('active');
        }
    };

    if (immediate) {
        await doTranslate();
    } else {
        // Debounce for live recording
        clearTimeout(state.translationDebounce);
        state.translationDebounce = setTimeout(doTranslate, 1000);
    }
}

// --- File Upload (Vosk via WebSocket for files is tricky, simulating or using same socket) ---
// For v2, we'll use the same WebSocket approach but feed the file data.

async function transcribeAudioFile() {
    if (!state.currentAudioFile) return;

    if (!state.voskUrl) {
        showToast('Please configure Vosk URL in settings', 'error');
        return;
    }

    elements.transcribeBtn.disabled = true;
    elements.transcribeBtn.classList.add('processing');
    updateProgress(0, 'Preparing...');

    try {
        // Decode audio
        const arrayBuffer = await state.currentAudioFile.arrayBuffer();
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const decodedData = await audioCtx.decodeAudioData(arrayBuffer);

        // Resample to 16kHz
        const offlineCtx = new OfflineAudioContext(1, decodedData.duration * 16000, 16000);
        const source = offlineCtx.createBufferSource();
        source.buffer = decodedData;
        source.connect(offlineCtx.destination);
        source.start();
        const resampledBuffer = await offlineCtx.startRendering();
        const audioData = resampledBuffer.getChannelData(0); // Float32Array

        // Connect to Vosk
        const socket = new WebSocket(state.voskUrl);

        updateProgress(10, 'Connecting to server...');

        await new Promise((resolve, reject) => {
            socket.onopen = resolve;
            socket.onerror = reject;
        });

        updateProgress(20, 'Transcribing...');

        // Send data in chunks
        const chunkSize = 4096;
        let offset = 0;

        // Listen for results
        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.text) {
                state.transcriptText += data.text + ' ';
                updateTranscript(state.transcriptText);
            }
        };

        // Send loop
        while (offset < audioData.length) {
            const end = Math.min(offset + chunkSize, audioData.length);
            const chunk = audioData.slice(offset, end);
            const pcmChunk = floatTo16BitPCM(chunk);
            socket.send(pcmChunk);
            offset += chunkSize;

            // Update UI occasionally
            if (offset % (chunkSize * 10) === 0) {
                const progress = Math.round((offset / audioData.length) * 100);
                updateProgress(progress, `Transcribing ${progress}%...`);
                await new Promise(r => setTimeout(r, 10)); // Yield to UI
            }
        }

        // Send EOF
        socket.send('{"eof" : 1}');

        // Wait a bit for final results then close
        await new Promise(r => setTimeout(r, 2000));
        socket.close();

        updateProgress(100, 'Complete!');
        showToast('✅ Transcription complete!', 'success');

        // Translate full text
        if (elements.languageSelect.value === 'bs-BA') {
            updateProgress(100, 'Translating...');
            // Use the LibreTranslate function
            // Note: LibreTranslate might also need chunking if text is huge, 
            // but for now we'll try sending it all or rely on translateText's logic if we improve it.
            // Since translateText is currently simple, let's just call it.
            // If the text is very long, we might want to split it by sentences, but let's start with this.
            await translateText(state.transcriptText, true);
        }

    } catch (error) {
        console.error('Transcription error:', error);
        showToast('❌ Failed: ' + error.message, 'error');
    } finally {
        setTimeout(resetTranscribeButton, 1000);
    }
}

// --- UI Helpers ---

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
    elements.uploadProgress.style.display = 'block';
    elements.transcribeBtn.disabled = false;
    elements.progressFill.style.width = '0%';

    // Reset output
    state.transcriptText = '';
    state.translationText = '';
    updateTranscript('');
    elements.translationText.textContent = '';
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
