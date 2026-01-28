import { AudioEngine } from './AudioEngine.js';
import { SamplerGUI } from './SamplerGUI.js';

document.addEventListener('DOMContentLoaded', async () => {
    const engine = new AudioEngine();
    const gui = new SamplerGUI(engine);

    await gui.init();
});
