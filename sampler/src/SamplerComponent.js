import { AudioEngine } from './AudioEngine.js';
import { api } from './api.js';

/**
 * Web Component: <sampler-pad>
 * A complete sampler with pads, effects, presets, and recording capabilities.
 */
export class SamplerComponent extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        
        this.engine = new AudioEngine();
        this.padOrder = ['pad7', 'pad8', 'pad9', 'pad4', 'pad5', 'pad6', 'pad1', 'pad2', 'pad3'];
        
        // State
        this.padParams = new Map(); // padId -> { start, end, volume, pan, pitch }
        this.selectedPadId = null;
        this.currentPresetId = null;
        this.allPresets = [];
        this.isRecording = false;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.isHeadless = false;
    }

    connectedCallback() {
        this.render();
        this.init();
    }

    getDefaultPadParams() {
        return { start: 0, end: 1, volume: 1, pan: 0, pitch: 1 };
    }

    render() {
        this.shadowRoot.innerHTML = `
            <style>${this.getStyles()}</style>
            <div class="sampler-container">
                <h1>JS Sampler</h1>
                
                <!-- Controls: Category Filter + Preset Select -->
                <div class="controls">
                    <select id="category-select">
                        <option value="">All Categories</option>
                    </select>
                    <select id="preset-select">
                        <option value="" disabled selected>Loading Presets...</option>
                    </select>
                    <button id="save-preset-btn" title="Save current preset">💾 Save</button>
                </div>

                <!-- Pads Grid -->
                <div id="pads-container"></div>

                <!-- Waveform Visualizer -->
                <div id="visualizer">
                    <canvas id="waveform"></canvas>
                </div>

                <!-- Parameters Panel -->
                <div id="params-container">
                    <button id="record-btn">🎙️ Record Mic</button>
                    
                    <div class="param-section">
                        <h3>Trim</h3>
                        <label>Start <input type="range" id="start-slider" min="0" max="1" step="0.01" value="0"></label>
                        <label>End <input type="range" id="end-slider" min="0" max="1" step="0.01" value="1"></label>
                    </div>

                    <div class="param-section">
                        <h3>Effects</h3>
                        <label>Volume <input type="range" id="volume-slider" min="0" max="1.5" step="0.01" value="1"><span id="volume-value">100%</span></label>
                        <label>Pan <input type="range" id="pan-slider" min="-1" max="1" step="0.01" value="0"><span id="pan-value">C</span></label>
                        <label>Pitch <input type="range" id="pitch-slider" min="0.5" max="2" step="0.01" value="1"><span id="pitch-value">1.0x</span></label>
                    </div>
                </div>

                <!-- Save Preset Modal -->
                <div id="save-modal" class="modal hidden">
                    <div class="modal-content">
                        <h2>Save Preset</h2>
                        <label>Name <input type="text" id="save-name" placeholder="My Preset"></label>
                        <label>Category 
                            <select id="save-category">
                                <option value="drums">Drums</option>
                                <option value="synth">Synth</option>
                                <option value="piano">Piano</option>
                                <option value="bass">Bass</option>
                                <option value="fx">FX</option>
                                <option value="other">Other</option>
                            </select>
                        </label>
                        <div class="modal-actions">
                            <button id="save-confirm-btn">Save</button>
                            <button id="save-cancel-btn">Cancel</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    getStyles() {
        return `
            :host {
                --bg-color: #121212;
                --surface-color: #1e1e1e;
                --primary-color: #00ffcc;
                --text-color: #ffffff;
                --pad-bg: #2a2a2a;
                display: block;
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            }

            .sampler-container {
                background-color: var(--bg-color);
                color: var(--text-color);
                display: flex;
                flex-direction: column;
                align-items: center;
                padding: 20px;
                min-height: 100vh;
                box-sizing: border-box;
            }

            h1 { margin-bottom: 20px; font-weight: 300; }

            .controls {
                display: flex;
                gap: 10px;
                margin-bottom: 20px;
                flex-wrap: wrap;
                justify-content: center;
            }

            select, button {
                padding: 10px 15px;
                background: var(--surface-color);
                border: 1px solid #333;
                color: white;
                border-radius: 5px;
                font-size: 1rem;
                cursor: pointer;
            }

            button:hover { background: #333; }

            #save-preset-btn {
                background: var(--primary-color);
                color: #000;
                font-weight: bold;
            }

            #pads-container {
                display: grid;
                grid-template-columns: repeat(3, 100px);
                grid-template-rows: repeat(3, 100px);
                gap: 10px;
                padding: 20px;
                background: var(--surface-color);
                border-radius: 10px;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
            }

            .pad {
                background-color: var(--pad-bg);
                border-radius: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                user-select: none;
                font-size: 1.2rem;
                font-weight: bold;
                transition: all 0.1s;
                border: 2px solid transparent;
                position: relative;
                overflow: hidden;
            }

            .pad .pad-label { position: relative; z-index: 2; }

            .pad .progress-container {
                position: absolute;
                bottom: 0; left: 0; right: 0;
                height: 4px;
                background: rgba(0,0,0,0.3);
                opacity: 0;
                transition: opacity 0.3s;
            }

            .pad.loading .progress-container { opacity: 1; }

            .pad .progress-bar {
                height: 100%;
                width: 0%;
                background: linear-gradient(90deg, var(--primary-color), #00ff88);
                transition: width 0.15s ease-out;
                box-shadow: 0 0 8px var(--primary-color);
            }

            .pad .progress-bar.completed {
                opacity: 0;
                transition: opacity 0.5s ease-out 0.3s;
            }

            .pad.loading {
                animation: padLoading 1.5s ease-in-out infinite;
            }

            @keyframes padLoading {
                0%, 100% { background-color: var(--pad-bg); }
                50% { background-color: #333; }
            }

            .pad:hover { filter: brightness(1.2); }
            .pad.loaded { border-color: #444; }
            .pad.active {
                background-color: var(--primary-color);
                color: #000;
                transform: scale(0.95);
                box-shadow: 0 0 15px var(--primary-color);
            }
            .pad.selected {
                border-color: var(--primary-color);
                box-shadow: inset 0 0 10px rgba(0, 255, 204, 0.3);
            }
            .pad.error {
                border-color: #ff4444;
                color: #ff4444;
                opacity: 0.5;
            }

            #visualizer {
                margin-top: 20px;
                width: 320px;
                height: 100px;
                background: #000;
                border-radius: 5px;
                overflow: hidden;
            }

            canvas { width: 100%; height: 100%; }

            #params-container {
                margin-top: 15px;
                width: 320px;
                background: var(--surface-color);
                padding: 15px;
                border-radius: 8px;
                opacity: 0;
                transition: opacity 0.3s;
            }

            #params-container.visible { opacity: 1; }

            #record-btn {
                width: 100%;
                margin-bottom: 15px;
                padding: 12px;
            }

            #record-btn.recording {
                background: #ff4444;
                animation: pulse 1s infinite;
            }

            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
            }

            .param-section {
                margin-bottom: 15px;
            }

            .param-section h3 {
                margin: 0 0 10px 0;
                font-size: 0.9rem;
                color: #888;
                text-transform: uppercase;
            }

            .param-section label {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 8px;
                font-size: 0.9rem;
            }

            .param-section input[type="range"] {
                flex: 1;
                margin: 0 10px;
                accent-color: var(--primary-color);
            }

            .param-section span {
                min-width: 40px;
                text-align: right;
                font-size: 0.8rem;
                color: var(--primary-color);
            }

            /* Modal */
            .modal {
                position: fixed;
                top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(0,0,0,0.8);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 1000;
            }

            .modal.hidden { display: none; }

            .modal-content {
                background: var(--surface-color);
                padding: 30px;
                border-radius: 10px;
                min-width: 300px;
            }

            .modal-content h2 {
                margin: 0 0 20px 0;
            }

            .modal-content label {
                display: block;
                margin-bottom: 15px;
            }

            .modal-content input[type="text"],
            .modal-content select {
                width: 100%;
                margin-top: 5px;
                padding: 10px;
                background: var(--pad-bg);
                border: 1px solid #444;
                color: white;
                border-radius: 4px;
                box-sizing: border-box;
            }

            .modal-actions {
                display: flex;
                gap: 10px;
                margin-top: 20px;
            }

            .modal-actions button {
                flex: 1;
            }

            #save-confirm-btn {
                background: var(--primary-color);
                color: #000;
            }
        `;
    }

    async init() {
        const urlParams = new URLSearchParams(window.location.search);
        this.isHeadless = urlParams.get('headless') === 'true';

        if (this.isHeadless) {
            console.log('Running in HEADLESS mode.');
            await this.loadPresets();
            return;
        }

        this.cacheElements();
        this.renderPads();
        await this.loadPresets();
        this.setupEventListeners();
        this.resizeCanvas();

        // Init audio context on first interaction
        this.shadowRoot.addEventListener('click', () => this.engine.init(), { once: true });

        // Keyboard & MIDI
        this.setupKeyboard();
        this.initMIDI();
    }

    cacheElements() {
        const $ = (sel) => this.shadowRoot.querySelector(sel);
        this.padsContainer = $('#pads-container');
        this.presetSelect = $('#preset-select');
        this.categorySelect = $('#category-select');
        this.waveformCanvas = $('#waveform');
        this.canvasCtx = this.waveformCanvas.getContext('2d');
        this.paramsContainer = $('#params-container');
        
        this.startSlider = $('#start-slider');
        this.endSlider = $('#end-slider');
        this.volumeSlider = $('#volume-slider');
        this.panSlider = $('#pan-slider');
        this.pitchSlider = $('#pitch-slider');
        
        this.volumeValue = $('#volume-value');
        this.panValue = $('#pan-value');
        this.pitchValue = $('#pitch-value');

        this.saveModal = $('#save-modal');
        this.saveNameInput = $('#save-name');
        this.saveCategorySelect = $('#save-category');
    }

    setupEventListeners() {
        // Trim sliders
        this.startSlider.addEventListener('input', (e) => this.handleParamChange('start', parseFloat(e.target.value)));
        this.endSlider.addEventListener('input', (e) => this.handleParamChange('end', parseFloat(e.target.value)));

        // Effect sliders
        this.volumeSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            this.handleParamChange('volume', val);
            this.volumeValue.textContent = `${Math.round(val * 100)}%`;
        });

        this.panSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            this.handleParamChange('pan', val);
            this.panValue.textContent = val === 0 ? 'C' : (val < 0 ? `L${Math.abs(Math.round(val * 100))}` : `R${Math.round(val * 100)}`);
        });

        this.pitchSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            this.handleParamChange('pitch', val);
            this.pitchValue.textContent = `${val.toFixed(2)}x`;
        });

        // Recording
        this.shadowRoot.querySelector('#record-btn').addEventListener('click', () => this.toggleRecording());

        // Preset selection
        this.presetSelect.addEventListener('change', (e) => this.loadPreset(e.target.value));

        // Category filter
        this.categorySelect.addEventListener('change', (e) => this.filterPresetsByCategory(e.target.value));

        // Save preset
        this.shadowRoot.querySelector('#save-preset-btn').addEventListener('click', () => this.openSaveModal());
        this.shadowRoot.querySelector('#save-confirm-btn').addEventListener('click', () => this.savePreset());
        this.shadowRoot.querySelector('#save-cancel-btn').addEventListener('click', () => this.closeSaveModal());
    }

    setupKeyboard() {
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
    }

    async initMIDI() {
        if (!navigator.requestMIDIAccess) return;
        try {
            const access = await navigator.requestMIDIAccess();
            for (const input of access.inputs.values()) {
                input.onmidimessage = (msg) => this.handleMIDIMessage(msg);
            }
            access.onstatechange = (e) => {
                if (e.port.type === 'input' && e.port.state === 'connected') {
                    e.port.onmidimessage = (msg) => this.handleMIDIMessage(msg);
                }
            };
        } catch (e) {
            console.error('MIDI Init Failed:', e);
        }
    }

    handleMIDIMessage(msg) {
        const [status, note, velocity] = msg.data;
        if ((status & 0xF0) === 144 && velocity > 0) {
            const offset = note - 36;
            if (offset >= 0 && offset < 9) {
                const padId = `pad${offset + 1}`;
                this.selectPad(padId);
                this.triggerPad(padId);
            }
        }
    }

    renderPads() {
        this.padsContainer.innerHTML = '';
        this.padOrder.forEach(padId => {
            const pad = document.createElement('div');
            pad.className = 'pad';
            pad.dataset.id = padId;

            const label = document.createElement('span');
            label.className = 'pad-label';
            label.innerText = padId.replace('pad', '');
            pad.appendChild(label);

            const progressContainer = document.createElement('div');
            progressContainer.className = 'progress-container';
            const progressBar = document.createElement('div');
            progressBar.className = 'progress-bar';
            progressContainer.appendChild(progressBar);
            pad.appendChild(progressContainer);

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

        this.shadowRoot.querySelectorAll('.pad').forEach(p => p.classList.remove('selected'));
        const pad = this.shadowRoot.querySelector(`.pad[data-id="${padId}"]`);
        if (pad) pad.classList.add('selected');

        const params = this.padParams.get(padId) || this.getDefaultPadParams();
        
        this.startSlider.value = params.start;
        this.endSlider.value = params.end;
        this.volumeSlider.value = params.volume;
        this.panSlider.value = params.pan;
        this.pitchSlider.value = params.pitch;

        this.volumeValue.textContent = `${Math.round(params.volume * 100)}%`;
        this.panValue.textContent = params.pan === 0 ? 'C' : (params.pan < 0 ? `L${Math.abs(Math.round(params.pan * 100))}` : `R${Math.round(params.pan * 100)}`);
        this.pitchValue.textContent = `${params.pitch.toFixed(2)}x`;

        this.paramsContainer.classList.add('visible');
    }

    handleParamChange(type, value) {
        if (!this.selectedPadId) return;

        let params = this.padParams.get(this.selectedPadId) || this.getDefaultPadParams();
        params[type] = value;

        // Trim constraints
        if (type === 'start' && params.start >= params.end) {
            params.end = Math.min(1, params.start + 0.01);
            this.endSlider.value = params.end;
        }
        if (type === 'end' && params.end <= params.start) {
            params.start = Math.max(0, params.end - 0.01);
            this.startSlider.value = params.start;
        }

        this.padParams.set(this.selectedPadId, params);
        this.drawWaveform(this.selectedPadId);
    }

    async loadPresets() {
        try {
            this.allPresets = await api.getPresets();
            this.populateCategories();
            this.populatePresets(this.allPresets);

            if (this.allPresets.length > 0) {
                this.loadPreset(this.allPresets[0]._id);
            }
        } catch (e) {
            console.error(e);
            alert('Failed to load presets.');
        }
    }

    populateCategories() {
        const categories = [...new Set(this.allPresets.map(p => p.category).filter(Boolean))];
        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat;
            option.textContent = cat.charAt(0).toUpperCase() + cat.slice(1);
            this.categorySelect.appendChild(option);
        });
    }

    populatePresets(presets) {
        // Clear existing options except the first placeholder
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
        this.resetPadsState();
        this.padParams.clear();
        this.currentPresetId = id;

        try {
            const preset = await api.getPreset(id);
            console.log('Loading preset:', preset.name);

            const promises = preset.sounds.map(sound => {
                const fullUrl = `https://web-sampler.onrender.com${sound.path}`;
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

    resetPadsState() {
        this.shadowRoot.querySelectorAll('.pad').forEach(pad => {
            pad.classList.remove('loaded', 'error', 'loading');
            pad.title = '';
            const progressBar = pad.querySelector('.progress-bar');
            if (progressBar) {
                progressBar.style.width = '0%';
                progressBar.classList.remove('completed');
            }
        });
    }

    setPadLoading(padId, isLoading) {
        const pad = this.shadowRoot.querySelector(`.pad[data-id="${padId}"]`);
        if (pad) pad.classList.toggle('loading', isLoading);
    }

    updatePadProgress(padId, progress) {
        const pad = this.shadowRoot.querySelector(`.pad[data-id="${padId}"]`);
        if (pad) {
            const bar = pad.querySelector('.progress-bar');
            if (bar) bar.style.width = `${Math.round(progress * 100)}%`;
        }
    }

    highlightPadLoaded(padId, soundName) {
        const pad = this.shadowRoot.querySelector(`.pad[data-id="${padId}"]`);
        if (pad) {
            pad.classList.remove('error', 'loading');
            pad.classList.add('loaded');
            pad.title = soundName;
            const bar = pad.querySelector('.progress-bar');
            if (bar) {
                bar.style.width = '100%';
                setTimeout(() => bar.classList.add('completed'), 200);
            }
        }
    }

    highlightPadError(padId) {
        const pad = this.shadowRoot.querySelector(`.pad[data-id="${padId}"]`);
        if (pad) {
            pad.classList.remove('loaded', 'loading');
            pad.classList.add('error');
            pad.title = 'Failed to load';
        }
    }

    triggerPad(padId) {
        const params = this.padParams.get(padId) || this.getDefaultPadParams();
        const buffer = this.engine.getBuffer(padId);

        if (!this.isHeadless) {
            const pad = this.shadowRoot.querySelector(`.pad[data-id="${padId}"]`);
            if (pad) {
                pad.classList.add('active');
                setTimeout(() => pad.classList.remove('active'), 100);
            }
        }

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

        if (!this.isHeadless) this.drawWaveform(padId);
    }

    resizeCanvas() {
        if (!this.waveformCanvas) return;
        const container = this.waveformCanvas.parentElement;
        this.waveformCanvas.width = container.clientWidth;
        this.waveformCanvas.height = container.clientHeight;
        window.addEventListener('resize', () => {
            this.waveformCanvas.width = container.clientWidth;
            this.waveformCanvas.height = container.clientHeight;
        });
    }

    drawWaveform(padId) {
        const buffer = this.engine.getBuffer(padId);
        if (!buffer) return;

        const params = this.padParams.get(padId) || this.getDefaultPadParams();
        const width = this.waveformCanvas.width;
        const height = this.waveformCanvas.height;
        const channelData = buffer.getChannelData(0);
        const step = Math.ceil(channelData.length / width);
        const amp = height / 2;

        this.canvasCtx.clearRect(0, 0, width, height);
        this.canvasCtx.fillStyle = '#00ffcc';

        for (let i = 0; i < width; i++) {
            let min = 1.0, max = -1.0;
            for (let j = 0; j < step; j++) {
                const datum = channelData[i * step + j];
                if (datum < min) min = datum;
                if (datum > max) max = datum;
            }
            this.canvasCtx.fillRect(i, (1 + min) * amp, 1, Math.max(1, (max - min) * amp));
        }

        // Trim regions
        this.canvasCtx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        const xStart = params.start * width;
        const xEnd = params.end * width;
        this.canvasCtx.fillRect(0, 0, xStart, height);
        this.canvasCtx.fillRect(xEnd, 0, width - xEnd, height);

        // Trim lines
        this.canvasCtx.strokeStyle = 'white';
        this.canvasCtx.beginPath();
        this.canvasCtx.moveTo(xStart, 0);
        this.canvasCtx.lineTo(xStart, height);
        this.canvasCtx.moveTo(xEnd, 0);
        this.canvasCtx.lineTo(xEnd, height);
        this.canvasCtx.stroke();
    }

    // === Recording ===
    async toggleRecording() {
        if (this.isRecording) {
            this.stopRecording();
        } else {
            await this.startRecording();
        }
    }

    async startRecording() {
        if (!navigator.mediaDevices?.getUserMedia) {
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

                const targetPad = this.selectedPadId || 'pad1';
                this.engine.buffers.set(targetPad, audioBuffer);
                this.highlightPadLoaded(targetPad, 'Recorded Sample');
                this.drawWaveform(targetPad);
                alert(`Recording saved to ${targetPad}`);
            };

            this.mediaRecorder.start();
            this.isRecording = true;
            const btn = this.shadowRoot.querySelector('#record-btn');
            btn.textContent = '⏹️ Stop Recording';
            btn.classList.add('recording');
        } catch (e) {
            console.error(e);
            alert('Could not start recording');
        }
    }

    stopRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.isRecording = false;
            const btn = this.shadowRoot.querySelector('#record-btn');
            btn.textContent = '🎙️ Record Mic';
            btn.classList.remove('recording');
        }
    }

    // === Save Preset ===
    openSaveModal() {
        this.saveModal.classList.remove('hidden');
        this.saveNameInput.value = '';
        this.saveNameInput.focus();
    }

    closeSaveModal() {
        this.saveModal.classList.add('hidden');
    }

    async savePreset() {
        const name = this.saveNameInput.value.trim();
        const category = this.saveCategorySelect.value;

        if (!name) {
            alert('Please enter a preset name');
            return;
        }

        // Collect current buffers and convert to blobs for upload
        const audioBlobs = new Map();
        
        for (const [padId, buffer] of this.engine.buffers.entries()) {
            if (buffer) {
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
            
            // Reload presets
            await this.loadPresets();
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

// Register the Web Component
customElements.define('sampler-pad', SamplerComponent);
