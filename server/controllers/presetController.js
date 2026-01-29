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
// @note    Supports two formats:
//          1. Legacy: 'data' (JSON string) with preset info
//          2. New: 'name', 'category', 'soundsInfo' (JSON string) as separate fields
exports.createPreset = async (req, res) => {
    try {
        let presetData = {};
        let soundsInfo = [];

        // Format 1: Legacy - parse from 'data' field
        if (req.body.data) {
            try {
                presetData = JSON.parse(req.body.data);
                soundsInfo = presetData.sounds || [];
            } catch (e) {
                return res.status(400).json({ message: 'Invalid JSON in "data" field' });
            }
        }
        // Format 2: New - separate fields
        else if (req.body.name) {
            presetData = {
                name: req.body.name,
                category: req.body.category || 'other',
                description: req.body.description || ''
            };
            
            // Parse soundsInfo if provided
            if (req.body.soundsInfo) {
                try {
                    soundsInfo = JSON.parse(req.body.soundsInfo);
                } catch (e) {
                    return res.status(400).json({ message: 'Invalid JSON in "soundsInfo" field' });
                }
            }
        } else {
            return res.status(400).json({ message: 'Missing preset data. Provide "data" JSON or "name" field.' });
        }

        const uploadedFiles = req.files || [];

        // Create a map of originalName -> fileObject for easy lookup
        const fileMap = {};
        uploadedFiles.forEach(file => {
            fileMap[file.originalname] = file;
        });

        // Build sounds array
        const soundsArray = [];

        // If soundsInfo provided, map files to pads
        if (soundsInfo && Array.isArray(soundsInfo) && soundsInfo.length > 0) {
            soundsInfo.forEach(soundItem => {
                // Case A: File was uploaded - match by padId (e.g., "pad1.wav")
                const matchingFile = fileMap[`${soundItem.padId}.wav`] || 
                                    fileMap[soundItem.fileName] ||
                                    uploadedFiles.find(f => f.originalname.startsWith(soundItem.padId));
                
                if (matchingFile) {
                    soundsArray.push({
                        padId: soundItem.padId,
                        name: soundItem.name || soundItem.padId,
                        path: `/uploads/${matchingFile.filename}`
                    });
                }
                // Case B: Direct URL provided
                else if (soundItem.path) {
                    soundsArray.push({
                        padId: soundItem.padId,
                        name: soundItem.name || 'External Sound',
                        path: soundItem.path
                    });
                }
            });
        }
        // Fallback: If no soundsInfo but files uploaded, assign by order
        else if (uploadedFiles.length > 0) {
            uploadedFiles.forEach((file, index) => {
                soundsArray.push({
                    padId: `pad${index + 1}`,
                    name: file.originalname.replace(/\.[^/.]+$/, ''), // Remove extension
                    path: `/uploads/${file.filename}`
                });
            });
        }

        if (soundsArray.length === 0) {
            return res.status(400).json({ message: 'No valid sounds provided (files or URLs)' });
        }

        // Create the Preset document
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
