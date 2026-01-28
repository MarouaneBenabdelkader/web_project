const mongoose = require('mongoose');
const path = require('path');
// Load .env if not already loaded
if (!process.env.MONGO_URL) {
    require('dotenv').config();
}

const connectDB = async () => {
    try {
        console.log('DEBUG: Attempting to connect to MongoDB...');
        console.log('DEBUG: MONGO_URL type:', typeof process.env.MONGO_URL);
        console.log('DEBUG: MONGO_URL value:', process.env.MONGO_URL ? process.env.MONGO_URL.substring(0, 20) + '...' : 'UNDEFINED');

        const conn = await mongoose.connect(process.env.MONGO_URL);
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
};

module.exports = connectDB;
