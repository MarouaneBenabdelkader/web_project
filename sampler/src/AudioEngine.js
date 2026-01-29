export class AudioEngine {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.buffers = new Map(); // padId -> AudioBuffer
        this.sources = new Map(); // padId -> AudioBufferSourceNode (currently playing)
        this.gainNodes = new Map(); // padId -> GainNode
        this.panNodes = new Map(); // padId -> StereoPannerNode
    }

    async init() {
        if (this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }
        console.log('Audio Engine initialized');
    }

    /**
     * Load a sample with progress callback support
     * @param {string} padId - The pad identifier
     * @param {string} url - URL of the audio file
     * @param {function} onProgress - Callback with progress value (0-1)
     * @returns {Promise<AudioBuffer|null>}
     */
    async loadSample(padId, url, onProgress = null) {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP error ${response.status}`);

            // Get content length for progress calculation
            const contentLength = response.headers.get('Content-Length');
            const total = contentLength ? parseInt(contentLength, 10) : 0;

            let loaded = 0;
            const reader = response.body.getReader();
            const chunks = [];

            // Read the stream with progress tracking
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                chunks.push(value);
                loaded += value.length;

                // Report progress
                if (onProgress && total > 0) {
                    onProgress(loaded / total);
                } else if (onProgress) {
                    // Indeterminate progress - pulse between 0.3 and 0.7
                    onProgress(0.5);
                }
            }

            // Combine chunks into ArrayBuffer
            const arrayBuffer = new Uint8Array(loaded);
            let position = 0;
            for (const chunk of chunks) {
                arrayBuffer.set(chunk, position);
                position += chunk.length;
            }

            // Signal decoding phase
            if (onProgress) onProgress(0.95);

            // decodeAudioData can fail if format is invalid
            try {
                const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer.buffer);
                this.buffers.set(padId, audioBuffer);
                if (onProgress) onProgress(1);
                return audioBuffer;
            } catch (decodeError) {
                console.warn(`Failed to decode audio for ${padId} (${url}):`, decodeError);
                return null;
            }
        } catch (error) {
            console.error(`Error loading sample for pad ${padId}:`, error);
            // Don't throw, just return null so Promise.all doesn't fail entirely
            return null;
        }
    }

    playSound(padId, startTime = 0, endTime = null) {
        const buffer = this.buffers.get(padId);
        if (!buffer) return;

        // Stop existing sound on this pad if any
        this.stopSound(padId);

        const source = this.ctx.createBufferSource();
        source.buffer = buffer;

        const gainNode = this.ctx.createGain();
        source.connect(gainNode);
        gainNode.connect(this.ctx.destination);

        this.sources.set(padId, source);
        this.gainNodes.set(padId, gainNode);

        // Handle trimming
        const duration = buffer.duration;
        const start = Math.max(0, Math.min(startTime, duration));
        let end = duration;

        if (endTime !== null) {
            end = Math.max(start, Math.min(endTime, duration));
        }

        const playDuration = end - start;

        source.start(0, start, playDuration);

        source.onended = () => {
            this.sources.delete(padId);
            this.gainNodes.delete(padId);
        };
    }

    /**
     * Play sound with effects: volume, pan, and pitch
     * @param {string} padId - Pad identifier
     * @param {number} startTime - Start time in seconds
     * @param {number} endTime - End time in seconds
     * @param {number} volume - Volume (0-1.5)
     * @param {number} pan - Pan position (-1 left to 1 right)
     * @param {number} pitch - Playback rate (0.5 to 2)
     */
    playSoundWithEffects(padId, startTime = 0, endTime = null, volume = 1, pan = 0, pitch = 1) {
        const buffer = this.buffers.get(padId);
        if (!buffer) return;

        this.stopSound(padId);

        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        source.playbackRate.value = pitch; // Pitch = playback rate

        // Create gain node for volume
        const gainNode = this.ctx.createGain();
        gainNode.gain.value = volume;

        // Create stereo panner for pan
        const panNode = this.ctx.createStereoPanner();
        panNode.pan.value = pan;

        // Connect: source -> gain -> pan -> destination
        source.connect(gainNode);
        gainNode.connect(panNode);
        panNode.connect(this.ctx.destination);

        this.sources.set(padId, source);
        this.gainNodes.set(padId, gainNode);
        this.panNodes.set(padId, panNode);

        // Handle trimming
        const duration = buffer.duration;
        const start = Math.max(0, Math.min(startTime, duration));
        let end = duration;

        if (endTime !== null) {
            end = Math.max(start, Math.min(endTime, duration));
        }

        const playDuration = end - start;
        source.start(0, start, playDuration);

        source.onended = () => {
            this.sources.delete(padId);
            this.gainNodes.delete(padId);
            this.panNodes.delete(padId);
        };
    }

    stopSound(padId) {
        const source = this.sources.get(padId);
        if (source) {
            try {
                source.stop();
            } catch (e) { /* ignore if already stopped */ }
            this.sources.delete(padId);
        }
    }

    getBuffer(padId) {
        return this.buffers.get(padId);
    }
}
