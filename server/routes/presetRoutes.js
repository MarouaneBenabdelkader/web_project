const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { getAllPresets, getPresetById, createPreset, updatePreset, deletePreset } = require('../controllers/presetController');

// Multer Config
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/uploads/');
    },
    filename: (req, file, cb) => {
        // Unique filename: fieldname-timestamp-random.ext
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('audio/')) {
        cb(null, true);
    } else {
        cb(new Error('Not an audio file! Please upload only audio.'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit per file
});


// Routes
router.get('/', getAllPresets);
router.get('/:id', getPresetById);

// Expecting 'files' as the key for the file array
router.post('/', upload.array('files', 16), createPreset);

// Update/Rename
router.put('/:id', updatePreset);

// Delete
router.delete('/:id', deletePreset);

module.exports = router;
