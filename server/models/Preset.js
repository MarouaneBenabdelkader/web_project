const mongoose = require('mongoose');

const PresetSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please add a name'],
        trim: true
    },
    category: {
        type: String,
        required: [true, 'Please add a category'],
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    // Map padId (e.g., "pad1") to sound file info
    sounds: [
        {
            padId: {
                type: String,
                required: true
            },
            name: String,
            // We store the relative path to be served statically
            path: {
                type: String,
                required: true
            }
        }
    ],
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Preset', PresetSchema);
