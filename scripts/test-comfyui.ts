import * as dotenv from 'dotenv';
dotenv.config();

const COMFYUI_API_URL = process.env.COMFYUI_API_URL || "";

async function testConnection() {
    console.log(`Pinging ComfyUI at: ${COMFYUI_API_URL}`);
    try {
        const response = await fetch(`${COMFYUI_API_URL}/system_stats`);
        if (!response.ok) {
            console.error(`HTTP Error: ${response.status}`);
            return;
        }
        const data = await response.json();
        console.log("Connection successful! System stats:");
        console.log(`OS: ${data.system.os}`);
        console.log(`Python: ${data.system.python_version}`);
        console.log(`Max VRAM: ${Math.round(data.devices[0].vram_total / 1024 / 1024)} MB`);
    } catch (e) {
        console.error("Failed to connect. Is it running?", e);
    }
}

testConnection();
