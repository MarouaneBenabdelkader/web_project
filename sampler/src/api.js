const API_URL = 'http://localhost:3000/api/presets';

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
    }
};
