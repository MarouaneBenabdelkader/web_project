const Preset = require('../models/Preset');
const path = require('path');

// @desc    Get all presets
// @route   GET /api/presets
// @access  Public
exports.getAllPresets = async (req, res) => {
    try {
        const presets = await Preset.find().sort({ createdAt: -1 });
        res.status(200).json(presets);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get single preset
// @route   GET /api/presets/:id
// @access  Public
exports.getPresetById = async (req, res) => {
    try {
        const preset = await Preset.findById(req.params.id);
        if (!preset) {
            return res.status(404).json({ message: 'Preset not found' });
        }
        res.status(200).json(preset);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create new preset
// @route   POST /api/presets
// @access  Public
// @note    Expects multipart/form-data with 'files' (audio) and 'data' (JSON string of preset metadata)
//          The 'data' JSON should have pads mapped by FILENAME, e.g. "pads": { "pad1": "kick.wav" }
//          The controller will map the actual stored filename to the pad.
exports.createPreset = async (req, res) => {
    try {
        // 1. Parse the preset data
        if (!req.body.data) {
            return res.status(400).json({ message: 'Missing preset data (JSON string field "data")' });
        }

        let presetData;
        try {
            presetData = JSON.parse(req.body.data);
        } catch (e) {
            return res.status(400).json({ message: 'Invalid JSON in "data" field' });
        }

        const uploadedFiles = req.files || [];

        // 2. Map uploaded files AND/OR existing URLs to pads
        const soundsArray = [];

        // Create a map of originalName -> fileObject for easy lookup
        const fileMap = {};
        uploadedFiles.forEach(file => {
            fileMap[file.originalname] = file;
        });

        if (presetData.sounds && Array.isArray(presetData.sounds)) {
            presetData.sounds.forEach(soundItem => {
                // soundItem: { padId: 'pad1', fileName: 'kick.wav', path: 'http://...' }

                // Case A: File was uploaded
                if (soundItem.fileName && fileMap[soundItem.fileName]) {
                    const matchingFile = fileMap[soundItem.fileName];
                    soundsArray.push({
                        padId: soundItem.padId,
                        name: soundItem.name || soundItem.fileName,
                        path: `/uploads/${matchingFile.filename}` // Local path
                    });
                }
                // Case B: Direct URL provided (no upload needed)
                else if (soundItem.path) {
                    soundsArray.push({
                        padId: soundItem.padId,
                        name: soundItem.name || 'External Sound',
                        path: soundItem.path
                    });
                }
            });
        }

        if (soundsArray.length === 0) {
            return res.status(400).json({ message: 'No valid sounds provided (files or URLs)' });
        }
        // Fallback: If no explicit mapping provided, just assign sequentially (less safe but works for simple tests)
        else {
            // Basic fallback not implemented to enforce structured data
        }

        // 3. Create the Preset document
        const newPreset = new Preset({
            name: presetData.name,
            category: presetData.category,
            description: presetData.description,
            sounds: soundsArray
        });

        const savedPreset = await newPreset.save();
        res.status(201).json(savedPreset);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error during preset creation' });
    }
};
// @desc    Update preset (Rename/Edit)
// @route   PUT /api/presets/:id
// @access  Public
exports.updatePreset = async (req, res) => {
    try {
        const { name, category, description } = req.body;
        const preset = await Preset.findById(req.params.id);

        if (!preset) {
            return res.status(404).json({ message: 'Preset not found' });
        }

        // Update fields if provided
        if (name) preset.name = name;
        if (category) preset.category = category;
        if (description) preset.description = description;

        const updatedPreset = await preset.save();
        res.status(200).json(updatedPreset);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete preset
// @route   DELETE /api/presets/:id
// @access  Public
exports.deletePreset = async (req, res) => {
    try {
        const preset = await Preset.findById(req.params.id);

        if (!preset) {
            return res.status(404).json({ message: 'Preset not found' });
        }

        // Use deleteOne() or findByIdAndDelete()
        await Preset.deleteOne({ _id: req.params.id });

        // TODO: Optionally delete associated audio files from disk to save space.
        // For now, keeping them is safer.

        res.status(200).json({ message: 'Preset deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
