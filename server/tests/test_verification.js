const fs = require('fs');
const path = require('path');

// Ensure Node 18+ for fetch/FormData or require them (omitted for simplicity, assuming environment is modern)
// If this fails due to missing fetch/FormData, we will know.

const API_URL = 'http://localhost:3000/api/presets';

async function runTest() {
    console.log('🧪 Starting API Verification...');

    // 1. Test GET /api/presets
    console.log('\nPlease wait, server startup...');
    await new Promise(r => setTimeout(r, 2000)); // Wait a bit more for server

    try {
        console.log(`\n🔹 GET ${API_URL}`);
        const res = await fetch(API_URL);
        const data = await res.json();
        console.log('✅ GET Response:', Promise.resolve(data).then(d => Array.isArray(d) ? `Success, got ${d.length} presets` : d));
    } catch (e) {
        console.error('❌ GET Failed:', e.message);
    }

    // 2. Test POST /api/presets
    console.log(`\n🔹 POST ${API_URL}`);

    // Create dummy audio file
    const dummyFilePath = path.join(__dirname, 'test_audio.wav');
    fs.writeFileSync(dummyFilePath, 'RIFF....WAVEfmt ... data.... (dummy content)');

    try {
        const formData = new FormData();
        // Native FormData in Node 18+ expects Blob or File. 
        // We can use the 'blob-from' logic or just read buffer.
        // Actually, Node's fetch implementation of FormData might be tricky with fs streams.
        // Let's try reading the file as a Blob.

        const fileBuffer = fs.readFileSync(dummyFilePath);
        const fileBlob = new Blob([fileBuffer], { type: 'audio/wav' });

        formData.append('files', fileBlob, 'test_audio.wav');

        const presetData = {
            name: "Test Preset " + Date.now(),
            category: "Test",
            description: "Automated test preset",
            sounds: [
                { padId: "pad1", fileName: "test_audio.wav" }
            ]
        };
        formData.append('data', JSON.stringify(presetData));

        const res = await fetch(API_URL, {
            method: 'POST',
            body: formData
        });

        if (res.ok) {
            const json = await res.json();
            console.log('✅ POST Success:', json.name, 'ID:', json._id);

            // 3. Test PUT /api/presets/:id
            const newId = json._id;
            console.log(`\n🔹 PUT ${API_URL}/${newId}`);
            const updateRes = await fetch(`${API_URL}/${newId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: "Renamed Preset" })
            });

            if (updateRes.ok) {
                const updated = await updateRes.json();
                console.log('✅ PUT Success:', updated.name === "Renamed Preset" ? "Name updated" : "Update failed");
            } else {
                console.error('❌ PUT Failed:', updateRes.status);
            }

            // 4. Test DELETE /api/presets/:id
            console.log(`\n🔹 DELETE ${API_URL}/${newId}`);
            const deleteRes = await fetch(`${API_URL}/${newId}`, { method: 'DELETE' });

            if (deleteRes.ok) {
                console.log('✅ DELETE Success');

                // Verify it's gone
                const checkRes = await fetch(`${API_URL}/${newId}`);
                console.log('✅ Verify Delete:', checkRes.status === 404 ? "Confirmed 404" : "Still exists?");
            } else {
                console.error('❌ DELETE Failed:', deleteRes.status);
            }

        } else {
            console.error('❌ POST Failed:', res.status, await res.text());
        }

    } catch (e) {
        console.error('❌ POST Error:', e);
    } finally {
        // Cleanup
        if (fs.existsSync(dummyFilePath)) fs.unlinkSync(dummyFilePath);
    }
}


runTest();
