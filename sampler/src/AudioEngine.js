export class AudioEngine {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.buffers = new Map(); // padId -> AudioBuffer
        this.sources = new Map(); // padId -> AudioBufferSourceNode (currently playing)
        this.gainNodes = new Map(); // padId -> GainNode
    }

    async init() {
        if (this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }
        console.log('Audio Engine initialized');
    }

    async loadSample(padId, url) {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP error ${response.status}`);

            const arrayBuffer = await response.arrayBuffer();

            // decodeAudioData can fail if format is invalid (like our dummy test files)
            try {
                const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
                this.buffers.set(padId, audioBuffer);
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
