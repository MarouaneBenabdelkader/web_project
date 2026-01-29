import { api } from './api.js';

export class SamplerGUI {
    constructor(audioEngine) {
        this.engine = audioEngine;
        this.padsContainer = document.getElementById('pads-container');
        this.presetSelect = document.getElementById('preset-select');
        this.categorySelect = document.getElementById('category-select');
        this.waveformCanvas = document.getElementById('waveform');
        this.canvasCtx = this.waveformCanvas?.getContext('2d');

        // Pad Map: we want Pad 1 (Kick) at bottom-left.
        // Visual Order (Top-Left to Bottom-Right) for 3x3:
        // 7, 8, 9
        // 4, 5, 6
        // 1, 2, 3
        this.padOrder = ['pad7', 'pad8', 'pad9', 'pad4', 'pad5', 'pad6', 'pad1', 'pad2', 'pad3'];

        // State for pad params (now includes effects)
        this.padParams = new Map(); // padId -> { start, end, volume, pan, pitch }
        this.allPresets = [];
        this.currentPresetId = null;

        this.startSlider = document.getElementById('start-slider');
        this.endSlider = document.getElementById('end-slider');
        this.volumeSlider = document.getElementById('volume-slider');
        this.panSlider = document.getElementById('pan-slider');
        this.pitchSlider = document.getElementById('pitch-slider');
        
        this.volumeValue = document.getElementById('volume-value');
        this.panValue = document.getElementById('pan-value');
        this.pitchValue = document.getElementById('pitch-value');
        
        this.selectedPadId = null;

        // Recording state
        this.isRecording = false;
        this.mediaRecorder = null;
        this.audioChunks = [];
    }

    getDefaultPadParams() {
        return { start: 0, end: 1, volume: 1, pan: 0, pitch: 1 };
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
            await this.loadPresets();
            return;
        }

        this.setupEventListeners();
        this.renderPads();
        await this.loadPresets();

        // Resize canvas
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());

        // Helper to init audio context on first interaction
        document.body.addEventListener('click', () => this.engine.init(), { once: true });

        // Keyboard Mapping
        window.addEventListener('keydown', (e) => {
            if (e.repeat) return;

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

        if (command === 144 && velocity > 0) {
            const baseNote = 36;
            const offset = note - baseNote;

            if (offset >= 0 && offset < this.padOrder.length) {
                const padId = `pad${offset + 1}`;
                this.triggerPad(padId);
                this.selectPad(padId);
            }
        }
    }

    setupEventListeners() {
        // Trim sliders
        this.startSlider?.addEventListener('input', (e) => this.handleParamChange('start', parseFloat(e.target.value)));
        this.endSlider?.addEventListener('input', (e) => this.handleParamChange('end', parseFloat(e.target.value)));

        // Effect sliders
        this.volumeSlider?.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            this.handleParamChange('volume', val);
            if (this.volumeValue) this.volumeValue.textContent = `${Math.round(val * 100)}%`;
        });

        this.panSlider?.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            this.handleParamChange('pan', val);
            if (this.panValue) this.panValue.textContent = val === 0 ? 'C' : (val < 0 ? `L${Math.abs(Math.round(val * 100))}` : `R${Math.round(val * 100)}`);
        });

        this.pitchSlider?.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            this.handleParamChange('pitch', val);
            if (this.pitchValue) this.pitchValue.textContent = `${val.toFixed(2)}x`;
        });

        // Recording
        document.getElementById('record-btn')?.addEventListener('click', () => this.toggleRecording());

        // Category filter
        this.categorySelect?.addEventListener('change', (e) => this.filterPresetsByCategory(e.target.value));

        // Save preset
        document.getElementById('save-preset-btn')?.addEventListener('click', () => this.openSaveModal());
        document.getElementById('save-confirm-btn')?.addEventListener('click', () => this.savePreset());
        document.getElementById('save-cancel-btn')?.addEventListener('click', () => this.closeSaveModal());
    }

    handleParamChange(type, value) {
        if (!this.selectedPadId) return;

        let params = this.padParams.get(this.selectedPadId) || this.getDefaultPadParams();
        params[type] = value;

        // Trim constraints
        if (type === 'start' && params.start >= params.end) {
            params.end = Math.min(1, params.start + 0.01);
            if (this.endSlider) this.endSlider.value = params.end;
        }
        if (type === 'end' && params.end <= params.start) {
            params.start = Math.max(0, params.end - 0.01);
            if (this.startSlider) this.startSlider.value = params.start;
        }

        this.padParams.set(this.selectedPadId, params);
        this.drawWaveform(this.selectedPadId);
    }

    handleTrimChange(type, value) {
        // Legacy method - redirect to handleParamChange
        this.handleParamChange(type, parseFloat(value));
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
            
            // Pad number label
            const label = document.createElement('span');
            label.className = 'pad-label';
            label.innerText = padId.replace('pad', '');
            pad.appendChild(label);

            // Progress bar container
            const progressContainer = document.createElement('div');
            progressContainer.className = 'progress-container';
            
            const progressBar = document.createElement('div');
            progressBar.className = 'progress-bar';
            progressContainer.appendChild(progressBar);
            
            pad.appendChild(progressContainer);

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

        // Sync sliders with all params
        const params = this.padParams.get(padId) || this.getDefaultPadParams();
        
        if (this.startSlider) this.startSlider.value = params.start;
        if (this.endSlider) this.endSlider.value = params.end;
        if (this.volumeSlider) this.volumeSlider.value = params.volume;
        if (this.panSlider) this.panSlider.value = params.pan;
        if (this.pitchSlider) this.pitchSlider.value = params.pitch;

        // Update value displays
        if (this.volumeValue) this.volumeValue.textContent = `${Math.round(params.volume * 100)}%`;
        if (this.panValue) this.panValue.textContent = params.pan === 0 ? 'C' : (params.pan < 0 ? `L${Math.abs(Math.round(params.pan * 100))}` : `R${Math.round(params.pan * 100)}`);
        if (this.pitchValue) this.pitchValue.textContent = `${params.pitch.toFixed(2)}x`;

        // Show params container
        const paramsContainer = document.getElementById('params-container');
        if (paramsContainer) paramsContainer.style.opacity = 1;
    }

    async loadPresets() {
        try {
            this.allPresets = await api.getPresets();
            
            // Populate categories
            this.populateCategories();
            
            // Populate presets
            this.populatePresets(this.allPresets);

            this.presetSelect.addEventListener('change', (e) => this.loadPreset(e.target.value));

            // Load first preset by default
            if (this.allPresets.length > 0) {
                this.loadPreset(this.allPresets[0]._id);
            }
        } catch (e) {
            console.error(e);
            alert('Failed to load presets.');
        }
    }

    populateCategories() {
        if (!this.categorySelect) return;
        const categories = [...new Set(this.allPresets.map(p => p.category).filter(Boolean))];
        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat;
            option.textContent = cat.charAt(0).toUpperCase() + cat.slice(1);
            this.categorySelect.appendChild(option);
        });
    }

    populatePresets(presets) {
        this.presetSelect.innerHTML = '<option value="" disabled selected>Select Preset...</option>';
        presets.forEach(preset => {
            const option = document.createElement('option');
            option.value = preset._id;
            option.textContent = preset.name;
            this.presetSelect.appendChild(option);
        });
    }

    filterPresetsByCategory(category) {
        const filtered = category 
            ? this.allPresets.filter(p => p.category === category)
            : this.allPresets;
        this.populatePresets(filtered);
    }

    async loadPreset(id) {
        // Reset all pads to initial state
        this.resetPadsState();
        this.padParams.clear();
        this.currentPresetId = id;

        try {
            const preset = await api.getPreset(id);
            console.log('Loading preset:', preset.name);

            // Load all samples with progress tracking
            const promises = preset.sounds.map(sound => {
                const fullUrl = `https://web-sampler.onrender.com${sound.path}`;
                
                // Show loading state for this pad
                this.setPadLoading(sound.padId, true);
                
                return this.engine.loadSample(
                    sound.padId, 
                    fullUrl,
                    (progress) => this.updatePadProgress(sound.padId, progress)
                ).then((buffer) => {
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
        }
    }

    /**
     * Reset all pads to their initial state (clear loaded/error states and progress)
     */
    resetPadsState() {
        document.querySelectorAll('.pad').forEach(pad => {
            pad.classList.remove('loaded', 'error', 'loading');
            pad.title = '';
            const progressBar = pad.querySelector('.progress-bar');
            if (progressBar) {
                progressBar.style.width = '0%';
                progressBar.classList.remove('completed');
            }
        });
    }

    /**
     * Set a pad's loading state
     * @param {string} padId 
     * @param {boolean} isLoading 
     */
    setPadLoading(padId, isLoading) {
        const pad = document.querySelector(`.pad[data-id="${padId}"]`);
        if (pad) {
            if (isLoading) {
                pad.classList.add('loading');
            } else {
                pad.classList.remove('loading');
            }
        }
    }

    /**
     * Update the progress bar for a specific pad
     * @param {string} padId 
     * @param {number} progress - Value between 0 and 1
     */
    updatePadProgress(padId, progress) {
        const pad = document.querySelector(`.pad[data-id="${padId}"]`);
        if (pad) {
            const progressBar = pad.querySelector('.progress-bar');
            if (progressBar) {
                progressBar.style.width = `${Math.round(progress * 100)}%`;
            }
        }
    }

    highlightPadLoaded(padId, soundName) {
        const pad = document.querySelector(`.pad[data-id="${padId}"]`);
        if (pad) {
            pad.classList.remove('error', 'loading');
            pad.classList.add('loaded');
            pad.title = soundName;
            // Ensure progress bar is full then fade out
            const progressBar = pad.querySelector('.progress-bar');
            if (progressBar) {
                progressBar.style.width = '100%';
                // Add completed class for fade-out animation
                setTimeout(() => {
                    progressBar.classList.add('completed');
                }, 200);
            }
        }
    }

    highlightPadError(padId) {
        const pad = document.querySelector(`.pad[data-id="${padId}"]`);
        if (pad) {
            pad.classList.remove('loaded', 'loading');
            pad.classList.add('error');
            pad.title = "Failed to load audio";
            const progressBar = pad.querySelector('.progress-bar');
            if (progressBar) {
                progressBar.style.width = '0%';
                progressBar.classList.remove('completed');
            }
        }
    }

    triggerPad(padId) {
        const params = this.padParams.get(padId) || this.getDefaultPadParams();
        const buffer = this.engine.getBuffer(padId);

        if (this.isHeadless) {
            console.log(`[Headless] Triggering ${padId}`);
            if (buffer) {
                const duration = buffer.duration;
                this.engine.playSoundWithEffects(
                    padId, 
                    params.start * duration, 
                    params.end * duration,
                    params.volume,
                    params.pan,
                    params.pitch
                );
            }
            return;
        }

        // Visual feedback
        const pad = document.querySelector(`.pad[data-id="${padId}"]`);
        if (pad) {
            pad.classList.add('active');
            setTimeout(() => pad.classList.remove('active'), 100);
        }

        if (buffer) {
            const duration = buffer.duration;
            const startTime = params.start * duration;
            const endTime = params.end * duration;

            // Audio trigger with effects
            this.engine.playSoundWithEffects(
                padId, 
                startTime, 
                endTime,
                params.volume,
                params.pan,
                params.pitch
            );
        }

        // Draw waveform
        this.drawWaveform(padId);
    }

    drawWaveform(padId) {
        const buffer = this.engine.getBuffer(padId);
        if (!buffer || !this.canvasCtx) return;

        const params = this.padParams.get(padId) || this.getDefaultPadParams();

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
        const xStart = params.start * width;
        this.canvasCtx.fillRect(0, 0, xStart, height);

        const xEnd = params.end * width;
        this.canvasCtx.fillRect(xEnd, 0, width - xEnd, height);

        // Trim Lines
        this.canvasCtx.strokeStyle = 'white';
        this.canvasCtx.beginPath();
        this.canvasCtx.moveTo(xStart, 0);
        this.canvasCtx.lineTo(xStart, height);
        this.canvasCtx.moveTo(xEnd, 0);
        this.canvasCtx.lineTo(xEnd, height);
        this.canvasCtx.stroke();
    }

    // === Save Preset Methods ===
    openSaveModal() {
        const modal = document.getElementById('save-modal');
        if (modal) {
            modal.classList.remove('hidden');
            const nameInput = document.getElementById('save-name');
            if (nameInput) {
                nameInput.value = '';
                nameInput.focus();
            }
        }
    }

    closeSaveModal() {
        const modal = document.getElementById('save-modal');
        if (modal) modal.classList.add('hidden');
    }

    async savePreset() {
        const nameInput = document.getElementById('save-name');
        const categorySelect = document.getElementById('save-category');
        
        const name = nameInput?.value.trim();
        const category = categorySelect?.value || 'other';

        if (!name) {
            alert('Please enter a preset name');
            return;
        }

        // Collect current buffers and convert to blobs for upload
        const audioBlobs = new Map();
        
        for (const [padId, buffer] of this.engine.buffers.entries()) {
            if (buffer) {
                // Convert AudioBuffer to WAV blob
                const blob = await this.audioBufferToWavBlob(buffer);
                audioBlobs.set(padId, blob);
            }
        }

        if (audioBlobs.size === 0) {
            alert('No sounds to save. Load or record some sounds first.');
            return;
        }

        try {
            await api.createPresetWithBlobs(name, category, audioBlobs);
            alert(`Preset "${name}" saved successfully!`);
            this.closeSaveModal();
            
            // Reload presets to show the new one
            this.allPresets = await api.getPresets();
            this.populatePresets(this.allPresets);
        } catch (e) {
            console.error(e);
            alert('Failed to save preset: ' + e.message);
        }
    }

    /**
     * Convert an AudioBuffer to a WAV Blob
     */
    audioBufferToWavBlob(buffer) {
        return new Promise((resolve) => {
            const numChannels = buffer.numberOfChannels;
            const sampleRate = buffer.sampleRate;
            const format = 1; // PCM
            const bitDepth = 16;
            
            const bytesPerSample = bitDepth / 8;
            const blockAlign = numChannels * bytesPerSample;
            
            const samples = buffer.length;
            const dataSize = samples * blockAlign;
            const bufferSize = 44 + dataSize;
            
            const arrayBuffer = new ArrayBuffer(bufferSize);
            const view = new DataView(arrayBuffer);
            
            // WAV header
            const writeString = (offset, str) => {
                for (let i = 0; i < str.length; i++) {
                    view.setUint8(offset + i, str.charCodeAt(i));
                }
            };
            
            writeString(0, 'RIFF');
            view.setUint32(4, 36 + dataSize, true);
            writeString(8, 'WAVE');
            writeString(12, 'fmt ');
            view.setUint32(16, 16, true);
            view.setUint16(20, format, true);
            view.setUint16(22, numChannels, true);
            view.setUint32(24, sampleRate, true);
            view.setUint32(28, sampleRate * blockAlign, true);
            view.setUint16(32, blockAlign, true);
            view.setUint16(34, bitDepth, true);
            writeString(36, 'data');
            view.setUint32(40, dataSize, true);
            
            // Interleave channels and write samples
            const channels = [];
            for (let c = 0; c < numChannels; c++) {
                channels.push(buffer.getChannelData(c));
            }
            
            let offset = 44;
            for (let i = 0; i < samples; i++) {
                for (let c = 0; c < numChannels; c++) {
                    const sample = Math.max(-1, Math.min(1, channels[c][i]));
                    const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
                    view.setInt16(offset, intSample, true);
                    offset += 2;
                }
            }
            
            resolve(new Blob([arrayBuffer], { type: 'audio/wav' }));
        });
    }
}
