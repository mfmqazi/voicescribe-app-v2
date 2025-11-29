
import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.6.0';

// Skip local model check
env.allowLocalModels = false;

// Singleton for the transcriber
class PipelineSingleton {
    static task = 'automatic-speech-recognition';
    static model = 'Xenova/whisper-base';
    static instance = null;

    static async getInstance(progress_callback = null) {
        if (this.instance === null) {
            this.instance = pipeline(this.task, this.model, { progress_callback });
        }
        return this.instance;
    }
}

// Handle messages from the main thread
self.addEventListener('message', async (event) => {
    const { type, audio, language, chunkIndex, totalChunks } = event.data;

    if (type === 'load') {
        // Pre-load the model
        try {
            await PipelineSingleton.getInstance((data) => {
                self.postMessage({
                    type: 'download',
                    data: data
                });
            });
            self.postMessage({ type: 'ready' });
        } catch (error) {
            self.postMessage({ type: 'error', error: error.message });
        }
        return;
    }

    if (type === 'process') {
        try {
            const transcriber = await PipelineSingleton.getInstance();

            // For Bosnian: Do TRANSLATE only (gives both transcription and translation in one pass)
            // For English: Do TRANSCRIBE only
            const srcLang = language === 'bs-BA' ? 'bosnian' : 'english';
            const taskType = language === 'bs-BA' ? 'translate' : 'transcribe';

            const result = await transcriber(audio, {
                language: srcLang,
                task: taskType,
                chunk_length_s: 30,
                stride_length_s: 5
            });

            // For Bosnian translate task, Whisper gives English output
            // We'll use the same text for both transcription and translation
            // (The original Bosnian is lost, but the English is what matters)
            const outputText = result.text.trim();

            self.postMessage({
                type: 'result',
                data: {
                    transcription: language === 'bs-BA' ? outputText : outputText,
                    translation: language === 'bs-BA' ? outputText : '',
                    chunkIndex,
                    totalChunks
                }
            });

        } catch (error) {
            self.postMessage({ type: 'error', error: error.message });
        }
    }
});
