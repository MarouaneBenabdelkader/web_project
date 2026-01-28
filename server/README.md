# Audio Presets Backend API

A Node.js/Express API that serves audio presets using MongoDB and local file storage.

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js**: Installed on your machine.
- **MongoDB Cluster**: You need a connection string (URI) for your MongoDB database.

### 2. Setup (First Time Only)
1.  **Install Dependencies**:
    ```bash
    npm install
    ```
2.  **Environment Variables**:
    Create a `.env` file in this directory (`server/.env`) with your MongoDB URI:
    ```env
    MONGO_URL=mongodb+srv://...your_connection_string...
    ```

### 4. Run the Server
Start the API server:
```bash
npm start
```
The server will run on: `http://localhost:3000`

---

## 📡 API Endpoints

- **GET /api/presets**
  - Returns a list of all available presets.
  
- **GET /api/presets/:id**
  - Returns details for a specific preset.

- **POST /api/presets**
  - Create a new preset.
  - **Body**: `multipart/form-data`
    - `files`: Array of audio files (`.wav`, `.mp3`).
    - `data`: JSON string containing preset metadata (`name`, `category`, `sounds` mapping).
