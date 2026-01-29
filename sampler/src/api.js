// Production API URL (Render)
const API_URL = 'https://web-sampler.onrender.com/api/presets';

export const api = {
    async getPresets() {
        const res = await fetch(API_URL);
        if (!res.ok) throw new Error('Failed to fetch presets');
        return res.json();
    },

    async getPreset(id) {
        const res = await fetch(`${API_URL}/${id}`);
        if (!res.ok) throw new Error('Failed to fetch preset');
        return res.json();
    },

    /**
     * Create a new preset with audio files
     * @param {Object} presetData - { name, category, sounds: [{padId, file}] }
     * @returns {Promise<Object>} Created preset
     */
    async createPreset(presetData) {
        const formData = new FormData();
        formData.append('name', presetData.name);
        formData.append('category', presetData.category || 'other');

        // If sounds have files, append them
        if (presetData.sounds && presetData.sounds.length > 0) {
            presetData.sounds.forEach((sound, index) => {
                if (sound.file) {
                    formData.append('files', sound.file, `${sound.padId}.wav`);
                }
            });
            formData.append('soundsInfo', JSON.stringify(presetData.sounds.map(s => ({
                padId: s.padId,
                name: s.name || s.padId
            }))));
        }

        const res = await fetch(API_URL, {
            method: 'POST',
            body: formData
        });

        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.message || 'Failed to create preset');
        }
        return res.json();
    },

    /**
     * Create a preset from existing audio buffers (as blobs)
     * @param {string} name - Preset name
     * @param {string} category - Preset category
     * @param {Map<string, Blob>} audioBlobs - Map of padId to audio Blob
     * @returns {Promise<Object>}
     */
    async createPresetWithBlobs(name, category, audioBlobs) {
        const formData = new FormData();
        formData.append('name', name);
        formData.append('category', category);

        const soundsInfo = [];
        for (const [padId, blob] of audioBlobs.entries()) {
            formData.append('files', blob, `${padId}.wav`);
            soundsInfo.push({ padId, name: padId });
        }
        formData.append('soundsInfo', JSON.stringify(soundsInfo));

        const res = await fetch(API_URL, {
            method: 'POST',
            body: formData
        });

        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.message || 'Failed to create preset');
        }
        return res.json();
    },

    /**
     * Delete a preset
     * @param {string} id - Preset ID
     */
    async deletePreset(id) {
        const res = await fetch(`${API_URL}/${id}`, {
            method: 'DELETE'
        });
        if (!res.ok) throw new Error('Failed to delete preset');
        return res.json();
    },

    /**
     * Update a preset
     * @param {string} id - Preset ID
     * @param {Object} data - Updated data
     */
    async updatePreset(id, data) {
        const res = await fetch(`${API_URL}/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error('Failed to update preset');
        return res.json();
    }
};
