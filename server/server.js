const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');
// Load .env (looks for .env in current dir by default)
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to Database
connectDB();

// Middleware
app.use(cors());
app.use(express.json());

// Static Folder for serving uploaded audio files
// Access files at: http://localhost:3000/uploads/filename.wav
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// Routes
app.use('/api/presets', require('./routes/presetRoutes'));

// Root Endpoint
app.get('/', (req, res) => {
    res.json({
        message: 'Audio Presets API Server (MongoDB Enabled)',
        endpoints: {
            'GET /api/presets': 'List all presets',
            'POST /api/presets': 'Create a new preset (multipart/form-data: "files", "data")',
            'GET /api/presets/:id': 'Get a specific preset'
        }
    });
});

// Start Server
app.listen(PORT, () => {
    console.log(`🎵 Audio Presets Server is running on http://localhost:${PORT}`);
    console.log(`📂 Static files served at http://localhost:${PORT}/uploads`);
});

