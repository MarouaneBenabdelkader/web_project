import { api } from './api.js';

export class SamplerGUI {
    constructor(audioEngine) {
        this.engine = audioEngine;
        this.padsContainer = document.getElementById('pads-container');
        this.presetSelect = document.getElementById('preset-select');
        this.waveformCanvas = document.getElementById('waveform');
        this.canvasCtx = this.waveformCanvas.getContext('2d');

        // Pad Map: we want Pad 1 (Kick) at bottom-left.
        // Let's assume a 3x3 grid for the typical preset size (9 sounds).
        // HTML order is usually top-left to bottom-right.
        // We can use CSS Grid to re-order, or just render them in visual order.
        // Visual Order (Top-Left to Bottom-Right) for 3x3:
        // 7, 8, 9
        // 4, 5, 6
        // 1, 2, 3
        this.padOrder = ['pad7', 'pad8', 'pad9', 'pad4', 'pad5', 'pad6', 'pad1', 'pad2', 'pad3'];

        // State for pad params
        this.padParams = new Map(); // padId -> { start: 0, end: 1 } (normalized 0-1)

        this.startSlider = document.getElementById('start-slider');
        this.endSlider = document.getElementById('end-slider');
        this.selectedPadId = null;

        this.startSlider.addEventListener('input', (e) => this.handleTrimChange('start', e.target.value));
        this.endSlider.addEventListener('input', (e) => this.handleTrimChange('end', e.target.value));

        // Recording state
        this.isRecording = false;
        this.mediaRecorder = null;
        this.audioChunks = [];

        // Setup Recording UI
        document.getElementById('record-btn').addEventListener('click', () => this.toggleRecording());
    }

    async toggleRecording() {
        if (this.isRecording) {
            this.stopRecording();
        } else {
            await this.startRecording();
        }
    }

    async startRecording() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            alert('Microphone not supported');
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaRecorder = new MediaRecorder(stream);
            this.audioChunks = [];

            this.mediaRecorder.ondataavailable = (e) => this.audioChunks.push(e.data);

            this.mediaRecorder.onstop = async () => {
                const blob = new Blob(this.audioChunks, { type: 'audio/webm' });
                const arrayBuffer = await blob.arrayBuffer();
                const audioBuffer = await this.engine.ctx.decodeAudioData(arrayBuffer);

                // Assign to selected pad or Pad 1 if none
                const targetPad = this.selectedPadId || 'pad1';
                this.engine.buffers.set(targetPad, audioBuffer);
                this.highlightPadLoaded(targetPad, 'Recorded Sample');
                this.drawWaveform(targetPad);
                alert(`Recording saved to ${targetPad}`);
            };

            this.mediaRecorder.start();
            this.isRecording = true;
            document.getElementById('record-btn').innerText = 'Stop Recording';
            document.getElementById('record-btn').classList.add('recording');
        } catch (e) {
            console.error(e);
            alert('Could not start recording');
        }
    }

    stopRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.isRecording = false;
            document.getElementById('record-btn').innerText = 'Record Mic';
            document.getElementById('record-btn').classList.remove('recording');
        }
    }

    async init() {
        const urlParams = new URLSearchParams(window.location.search);
        this.isHeadless = urlParams.get('headless') === 'true';

        if (this.isHeadless) {
            console.log('Running in HEADLESS mode. GUI disabled.');
            // Still load presets to test engine
            await this.loadPresets();
            return;
        }

        this.renderPads();
        await this.loadPresets();

        // Resize canvas
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());

        // Helper to init audio context on first interaction
        document.body.addEventListener('click', () => this.engine.init(), { once: true });

        // Keyboard Mapping
        window.addEventListener('keydown', (e) => {
            if (e.repeat) return; // Prevent machine-gun triggers

            const keyMap = {
                'z': 'pad1', 'x': 'pad2', 'c': 'pad3',
                'a': 'pad4', 's': 'pad5', 'd': 'pad6',
                'q': 'pad7', 'w': 'pad8', 'e': 'pad9'
            };

            const padId = keyMap[e.key.toLowerCase()];
            if (padId) {
                this.selectPad(padId);
                this.triggerPad(padId);
            }
        });

        // MIDI Support
        this.initMIDI();
    }

    async initMIDI() {
        if (!navigator.requestMIDIAccess) {
            console.warn('WebMIDI not supported');
            return;
        }

        try {
            const access = await navigator.requestMIDIAccess();
            const inputs = access.inputs.values();

            for (const input of inputs) {
                input.onmidimessage = (msg) => this.handleMIDIMessage(msg);
            }

            access.onstatechange = (e) => {
                console.log('MIDI State Change:', e.port.name, e.port.state);
                if (e.port.type === 'input' && e.port.state === 'connected') {
                    e.port.onmidimessage = (msg) => this.handleMIDIMessage(msg);
                }
            };
        } catch (e) {
            console.error('MIDI Init Failed:', e);
        }
    }

    handleMIDIMessage(msg) {
        const [status, data1, data2] = msg.data;
        const command = status & 0xF0;
        const note = data1;
        const velocity = data2;

        // Note On (144) with velocity > 0
        if (command === 144 && velocity > 0) {
            // Map C1 (36) to Pad 1, C#1 (37) to Pad 2, etc.
            const baseNote = 36;
            const offset = note - baseNote;

            if (offset >= 0 && offset < this.padOrder.length) {
                // pads are: 7,8,9, 4,5,6, 1,2,3
                // Map linear 0-8 to pad 1-9? 
                // Requirement: Pad 1 is bottom left.
                // My padOrder array is designed for rendering grid: 7,8,9...
                // But MIDI should probably map C1->Pad1 (Kick), D1->Pad2 (Snare)

                const padId = `pad${offset + 1}`; // 36->pad1, 37->pad2
                this.triggerPad(padId);
                this.selectPad(padId);
            }
        }
    }

    handleTrimChange(type, value) {
        if (!this.selectedPadId) return;

        let params = this.padParams.get(this.selectedPadId) || { start: 0, end: 1 };
        params[type] = parseFloat(value);

        // Constraints
        if (params.start >= params.end) {
            if (type === 'start') params.end = params.start + 0.01;
            else params.start = params.end - 0.01;
        }

        this.padParams.set(this.selectedPadId, params);

        // Update UI
        this.startSlider.value = params.start;
        this.endSlider.value = params.end;

        // Re-draw waveform with markers?
        this.drawWaveform(this.selectedPadId);
    }

    resizeCanvas() {
        const container = this.waveformCanvas.parentElement;
        this.waveformCanvas.width = container.clientWidth;
        this.waveformCanvas.height = container.clientHeight;
    }

    renderPads() {
        this.padsContainer.innerHTML = '';
        this.padOrder.forEach(padId => {
            const pad = document.createElement('div');
            pad.className = 'pad';
            pad.dataset.id = padId;
            pad.innerText = padId.replace('pad', '');

            // Mouse/Touch events
            const trigger = (e) => {
                e.preventDefault();
                this.selectPad(padId);
                this.triggerPad(padId);
            };

            pad.addEventListener('mousedown', trigger);
            pad.addEventListener('touchstart', trigger);

            this.padsContainer.appendChild(pad);
        });
    }

    selectPad(padId) {
        this.selectedPadId = padId;

        // Visual selection
        document.querySelectorAll('.pad').forEach(p => p.classList.remove('selected'));
        const pad = document.querySelector(`.pad[data-id="${padId}"]`);
        if (pad) pad.classList.add('selected');

        // Sync sliders
        const params = this.padParams.get(padId) || { start: 0, end: 1 };
        this.startSlider.value = params.start;
        this.endSlider.value = params.end;

        // Show params container maybe?
        document.getElementById('params-container').style.opacity = 1;
    }

    async loadPresets() {
        try {
            const presets = await api.getPresets();
            presets.forEach(preset => {
                const option = document.createElement('option');
                option.value = preset._id;
                option.innerText = preset.name;
                this.presetSelect.appendChild(option);
            });

            this.presetSelect.addEventListener('change', (e) => this.loadPreset(e.target.value));

            // Load first preset by default
            if (presets.length > 0) {
                this.loadPreset(presets[0]._id);
            }
        } catch (e) {
            console.error(e);
            alert('Failed to load presets.');
        }
    }

    async loadPreset(id) {
        // Show loading state
        this.padsContainer.classList.add('loading');
        this.padParams.clear(); // Reset trims

        try {
            const preset = await api.getPreset(id);
            console.log('Loading preset:', preset.name);

            // Load all samples
            const promises = preset.sounds.map(sound => {
                // Construct full URL. API returns relative path like /uploads/file.wav
                const fullUrl = `http://localhost:3000${sound.path}`;
                return this.engine.loadSample(sound.padId, fullUrl)
                    .then((buffer) => {
                        if (buffer) {
                            this.highlightPadLoaded(sound.padId, sound.name);
                        } else {
                            this.highlightPadError(sound.padId);
                        }
                    });
            });

            await Promise.all(promises);
            console.log('All samples loaded');
        } catch (e) {
            console.error(e);
        } finally {
            this.padsContainer.classList.remove('loading');
        }
    }

    highlightPadLoaded(padId, soundName) {
        const pad = document.querySelector(`.pad[data-id="${padId}"]`);
        if (pad) {
            pad.classList.remove('error'); // Clear potential error
            pad.classList.add('loaded');
            pad.title = soundName;
        }
    }

    highlightPadError(padId) {
        const pad = document.querySelector(`.pad[data-id="${padId}"]`);
        if (pad) {
            pad.classList.remove('loaded');
            pad.classList.add('error');
            pad.title = "Failed to load audio";
        }
    }

    triggerPad(padId) {
        if (this.isHeadless) {
            console.log(`[Headless] Triggering ${padId}`);
            // Audio trigger only
            const params = this.padParams.get(padId) || { start: 0, end: 1 };
            const buffer = this.engine.getBuffer(padId);
            if (buffer) {
                const duration = buffer.duration;
                this.engine.playSound(padId, params.start * duration, params.end * duration);
            }
            return;
        }

        // Visual feedback
        const pad = document.querySelector(`.pad[data-id="${padId}"]`);
        if (pad) {
            pad.classList.add('active');
            setTimeout(() => pad.classList.remove('active'), 100);
        }

        // Get trim params
        const params = this.padParams.get(padId) || { start: 0, end: 1 };
        const buffer = this.engine.getBuffer(padId);

        if (buffer) {
            const duration = buffer.duration;
            const startTime = params.start * duration;
            const endTime = params.end * duration;

            // Audio trigger
            this.engine.playSound(padId, startTime, endTime);
        }

        // Draw waveform
        this.drawWaveform(padId);
    }

    drawWaveform(padId) {
        const buffer = this.engine.getBuffer(padId);
        if (!buffer) return;

        const params = this.padParams.get(padId) || { start: 0, end: 1 };

        const width = this.waveformCanvas.width;
        const height = this.waveformCanvas.height;
        const channelData = buffer.getChannelData(0);
        const step = Math.ceil(channelData.length / width);
        const amp = height / 2;

        this.canvasCtx.clearRect(0, 0, width, height);
        this.canvasCtx.fillStyle = '#00ffcc';
        this.canvasCtx.beginPath();

        for (let i = 0; i < width; i++) {
            let min = 1.0;
            let max = -1.0;
            for (let j = 0; j < step; j++) {
                const datum = channelData[i * step + j];
                if (datum < min) min = datum;
                if (datum > max) max = datum;
            }
            this.canvasCtx.fillRect(i, (1 + min) * amp, 1, Math.max(1, (max - min) * amp));
        }

        // Draw Trim Regions
        this.canvasCtx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        // Left shade
        const xStart = params.start * width;
        this.canvasCtx.fillRect(0, 0, xStart, height);

        // Right shade
        const xEnd = params.end * width;
        this.canvasCtx.fillRect(xEnd, 0, width - xEnd, height);

        // Lines
        this.canvasCtx.strokeStyle = 'white';
        this.canvasCtx.beginPath();
        this.canvasCtx.moveTo(xStart, 0);
        this.canvasCtx.lineTo(xStart, height);
        this.canvasCtx.moveTo(xEnd, 0);
        this.canvasCtx.lineTo(xEnd, height);
        this.canvasCtx.stroke();
    }
}
