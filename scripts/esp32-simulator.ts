/**
 * MoonPlants ESP32 Simulator (Node.js)
 * 
 * Usage:
 * npx tsx scripts/esp32-simulator.ts <DEVICE_ID> <HMAC_SECRET> [BASE_URL]
 * 
 * Example:
 * npx tsx scripts/esp32-simulator.ts "550e8400-e29b-41d4-a716-446655440000" "my_super_secret_key" "http://localhost:3000"
 */

import crypto from 'crypto';

const args = process.argv.slice(2);
if (args.length < 2) {
    console.error("Usage: npx tsx scripts/esp32-simulator.ts <DEVICE_ID> <HMAC_SECRET> [BASE_URL]");
    process.exit(1);
}

const DEVICE_ID = args[0];
const HMAC_SECRET = args[1]; // Should be hex string or plain text? auth.ts expects hex
const BASE_URL = args[2] || "http://localhost:3000";

let seq = Math.floor(Date.now() / 1000); // Start seq with something high

// Simulator state for realistic data trends
let currentSoilMoisture = [
    350 + Math.random() * 100, // Plant 1 starts wet-ish
    400 + Math.random() * 100  // Plant 2 starts medium
];

async function signRequest(method: string, path: string, body: string) {
    const timestamp = Math.floor(Date.now() / 1000);
    const contentHash = crypto.createHash('sha256').update(body).digest('hex');
    const currentSeq = seq++;

    const canonical = [
        method.toUpperCase(),
        path,
        DEVICE_ID,
        currentSeq.toString(),
        timestamp.toString(),
        contentHash,
    ].join('\n');

    // If HMAC_SECRET is hex, convert to buffer. If not, treat as UTF8.
    // Real ESP32 stores it as bytes.
    let secretBuffer;
    try {
        if (/^[0-9a-fA-F]+$/.test(HMAC_SECRET) && HMAC_SECRET.length % 2 === 0) {
            secretBuffer = Buffer.from(HMAC_SECRET, 'hex');
        } else {
            secretBuffer = Buffer.from(HMAC_SECRET, 'utf8');
        }
    } catch (e) {
        secretBuffer = Buffer.from(HMAC_SECRET, 'utf8');
    }

    const signature = crypto.createHmac('sha256', secretBuffer)
        .update(canonical)
        .digest('base64url');

    return {
        'X-Device-Id': DEVICE_ID,
        'X-Device-Seq': currentSeq.toString(),
        'X-Device-Timestamp': timestamp.toString(),
        'X-Content-SHA256': contentHash,
        'X-Device-Signature': signature,
        'Content-Type': 'application/json'
    };
}

async function sendMeasurements() {
    const path = '/api/iot/v1/measurements';
    
    // Simulate gradual drying (higher raw = drier)
    currentSoilMoisture[0] += 5 + Math.random() * 5;
    currentSoilMoisture[1] += 3 + Math.random() * 5;
    
    // Clamp at dryValue
    if (currentSoilMoisture[0] > 800) currentSoilMoisture[0] = 800;
    if (currentSoilMoisture[1] > 800) currentSoilMoisture[1] = 800;

    const body = JSON.stringify({
        measuredAt: Math.floor(Date.now() / 1000),
        air: {
            tempC: 22 + Math.random() * 2,
            humidityPct: 45 + Math.random() * 5
        },
        lightLux: 300 + Math.random() * 200,
        soil: [
            { channel: 1, moistureRaw: Math.round(currentSoilMoisture[0]) },
            { channel: 2, moistureRaw: Math.round(currentSoilMoisture[1]) }
        ],
        batteryV: 3.8,
        rssiDbm: -60
    });

    const headers = await signRequest('POST', path, body);

    console.log(`[SIM] Sending measurements... (seq: ${headers['X-Device-Seq']})`);
    const res = await fetch(`${BASE_URL}${path}`, {
        method: 'POST',
        headers,
        body
    });

    const data = await res.json();
    console.log('[SIM] Measurements response:', JSON.stringify(data));
}

async function pollCommands() {
    const path = '/api/iot/v1/commands';
    const headers = await signRequest('GET', path, "");

    console.log(`[SIM] Polling commands... (seq: ${headers['X-Device-Seq']})`);
    const res = await fetch(`${BASE_URL}${path}?limit=5`, {
        method: 'GET',
        headers
    });

    const data = await res.json();
    const commands = data.commands || [];
    console.log(`[SIM] Found ${commands.length} commands.`);

    for (const cmd of commands) {
        console.log(`[SIM] Executing command: ${cmd.type} (ID: ${cmd.id})`);

        // Simulate execution
        await new Promise(r => setTimeout(r, 1000));

        // Send ACK
        await sendAck(cmd.id, "ok", { simulated: true });
    }
}

async function sendAck(commandId: string, status: "ok" | "failed", result: any) {
    const path = `/api/iot/v1/commands/${commandId}/ack`;
    const body = JSON.stringify({
        status,
        executedAt: Math.floor(Date.now() / 1000),
        result
    });

    const headers = await signRequest('POST', path, body);
    console.log(`[SIM] Sending ACK for ${commandId}...`);

    const res = await fetch(`${BASE_URL}${path}`, {
        method: 'POST',
        headers,
        body
    });

    const data = await res.json();
    console.log('[SIM] ACK response:', JSON.stringify(data));
}

async function run() {
    console.log(`[SIM] Starting ESP32 Simulator for ${DEVICE_ID}`);
    console.log(`[SIM] Target: ${BASE_URL}`);

    // Run cycle
    try {
        await sendMeasurements();
        await pollCommands();
    } catch (err: any) {
        console.error('[SIM ERROR]', err.message);
    }

    console.log('[SIM] Cycle finished.');
}

run();
