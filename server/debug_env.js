const path = require('path');
const dotenv = require('dotenv');

const envPath = path.resolve(__dirname, '../.env');
console.log('Attempting to load .env from:', envPath);

const result = dotenv.config({ path: envPath });

if (result.error) {
    console.error('Error loading .env:', result.error);
} else {
    console.log('Dotenv parsed:', result.parsed);
}

console.log('MONGO_URL from process.env:', process.env.MONGO_URL);
