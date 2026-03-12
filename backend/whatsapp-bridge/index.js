const express = require('express');
const cors = require('cors');
const http = require('http');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');

// ─── CRASH PROTECTION: Prevent Baileys from killing the process ──────────────
process.on('uncaughtException', (err) => {
    console.error('⚠️  Uncaught Exception (kept alive):', err.message);
});
process.on('unhandledRejection', (reason) => {
    console.error('⚠️  Unhandled Rejection (kept alive):', reason?.message || reason);
});

const app = express();
const PORT = 3001;
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';

app.use(cors({ origin: '*' }));
app.use(express.json());

// Track active connections per agent
const activeSessions = new Map();

// ─── Shared logger (silent) ──────────────────────────────────────────────────
const silentLogger = {
    level: 'silent',
    trace: () => { }, debug: () => { }, info: () => { },
    warn: () => { }, error: () => { }, fatal: () => { },
    child: () => ({
        trace: () => { }, debug: () => { }, info: () => { },
        warn: () => { }, error: () => { }, fatal: () => { },
    }),
};

// ─── Forward message to backend webhook & send reply back ────────────────────
async function handleIncomingMessage(sock, agentId, message) {
    // Skip status broadcasts, reactions, protocol messages, etc.
    if (!message.message) return;
    if (message.key.fromMe) return;
    if (message.key.remoteJid === 'status@broadcast') return;

    // Extract message text from various WhatsApp message types
    const msgContent = message.message;
    let body = '';

    if (msgContent.conversation) {
        body = msgContent.conversation;
    } else if (msgContent.extendedTextMessage?.text) {
        body = msgContent.extendedTextMessage.text;
    } else if (msgContent.imageMessage?.caption) {
        body = msgContent.imageMessage.caption;
    } else if (msgContent.videoMessage?.caption) {
        body = msgContent.videoMessage.caption;
    } else if (msgContent.documentMessage?.caption) {
        body = msgContent.documentMessage.caption;
    }

    if (!body.trim()) return;

    const sender = message.key.remoteJid;
    console.log(`[${agentId}] 📩 Message from ${sender}: "${body.substring(0, 80)}"`);

    try {
        // Forward to the backend webhook
        const webhookPayload = {
            channel: 'whatsapp',
            account: agentId,
            message: {
                id: message.key.id,
                body: body,
                sender: sender,
            },
        };

        const response = await fetch(`${BACKEND_URL}/api/webhooks/whatsapp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(webhookPayload),
        });

        const data = await response.json();

        if (data.reply) {
            // Send the AI agent's reply back through WhatsApp
            await sock.sendMessage(sender, { text: data.reply });
            console.log(`[${agentId}] ✅ Replied to ${sender}: "${data.reply.substring(0, 80)}..."`);
        }
    } catch (err) {
        console.error(`[${agentId}] ❌ Error processing message:`, err.message);
    }
}

// ─── Attach message listener to a Baileys socket ────────────────────────────
function attachMessageHandler(sock, agentId) {
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        // Only process new messages, not history sync
        if (type !== 'notify') return;

        for (const msg of messages) {
            await handleIncomingMessage(sock, agentId, msg);
        }
    });

    console.log(`[${agentId}] 🎧 Message handler attached — listening for incoming WhatsApp messages`);
}

// ─── Create a persistent Baileys connection (used for both QR pairing and auto-reconnect) ─
async function createBaileysConnection(agentId, sendEvent = null, onSSEClose = null) {
    const authDir = path.join(__dirname, 'auth', agentId);
    if (!fs.existsSync(authDir)) {
        fs.mkdirSync(authDir, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        auth: state,
        version,
        printQRInTerminal: false,
        browser: ['AI Wrapper', 'Chrome', '22.0'],
        syncFullHistory: false,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 0,
        logger: silentLogger,
    });

    activeSessions.set(agentId, sock);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr && sendEvent) {
            try {
                const qrBase64 = await QRCode.toDataURL(qr, {
                    width: 300, margin: 2,
                    color: { dark: '#000000', light: '#FFFFFF' },
                });
                sendEvent('qr', { data: qrBase64 });
                console.log(`[${agentId}] QR code generated and sent`);
            } catch (qrErr) {
                console.error('QR generation error:', qrErr);
                if (sendEvent) sendEvent('error', { message: 'Failed to generate QR code image' });
            }
        }

        if (connection === 'open') {
            console.log(`[${agentId}] ✅ WhatsApp connected!`);

            // Attach message handler so the bot can respond
            attachMessageHandler(sock, agentId);

            if (sendEvent) {
                sendEvent('connected', { message: 'WhatsApp device linked successfully!' });
                // Close the SSE stream after a short delay (QR flow is done)
                if (onSSEClose) setTimeout(() => onSSEClose(), 2000);
            }
        }

        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

            console.log(`[${agentId}] Connection closed. Status: ${statusCode}, Reconnect: ${shouldReconnect}`);

            if (shouldReconnect) {
                if (sendEvent) sendEvent('status', { message: 'Reconnecting to WhatsApp...' });
                setTimeout(() => {
                    createBaileysConnection(agentId, sendEvent, onSSEClose).catch(err => {
                        console.error(`[${agentId}] Reconnect failed:`, err);
                        if (sendEvent) sendEvent('error', { message: 'Reconnection failed. Please try again.' });
                        if (onSSEClose) onSSEClose();
                    });
                }, 3000);
            } else {
                if (sendEvent) sendEvent('error', { message: 'Session logged out. Please try again.' });
                activeSessions.delete(agentId);
                if (fs.existsSync(authDir)) {
                    fs.rmSync(authDir, { recursive: true, force: true });
                }
                if (onSSEClose) onSSEClose();
            }
        }
    });

    sock.ev.on('creds.update', saveCreds);

    return sock;
}

// ─── Clean stale auth dirs that may cause crashes ───────────────────────────
function cleanStaleAuth() {
    const authRoot = path.join(__dirname, 'auth');
    if (!fs.existsSync(authRoot)) return;

    const dirs = fs.readdirSync(authRoot);
    for (const d of dirs) {
        const dirPath = path.join(authRoot, d);
        if (!fs.statSync(dirPath).isDirectory()) continue;
        const credsPath = path.join(dirPath, 'creds.json');
        if (!fs.existsSync(credsPath)) {
            // No creds = incomplete pairing, remove
            console.log(`🧹 Removing incomplete auth dir: ${d}`);
            fs.rmSync(dirPath, { recursive: true, force: true });
        }
    }
}

// ─── Auto-reconnect previously paired agents on startup ─────────────────────
async function bootLinkedAgents() {
    const authRoot = path.join(__dirname, 'auth');
    if (!fs.existsSync(authRoot)) return;

    // Clean up stale/broken auth first
    cleanStaleAuth();

    const agentDirs = fs.readdirSync(authRoot).filter(d =>
        fs.statSync(path.join(authRoot, d)).isDirectory() &&
        fs.existsSync(path.join(authRoot, d, 'creds.json'))
    );

    if (agentDirs.length === 0) {
        console.log('ℹ️  No previously linked WhatsApp accounts found.');
        return;
    }

    console.log(`🔄 Auto-reconnecting ${agentDirs.length} linked agent(s)...`);

    for (const agentId of agentDirs) {
        try {
            await createBaileysConnection(agentId);
            console.log(`   ✅ ${agentId} — reconnection initiated`);
            // Delay between connections to avoid rate limiting
            await new Promise(r => setTimeout(r, 2000));
        } catch (err) {
            console.error(`   ❌ ${agentId} — failed to reconnect:`, err.message);
            // Don't crash — continue with next agent
        }
    }
}

// ─── SSE endpoint: QR code pairing ──────────────────────────────────────────
app.get('/wa/qr/:agentId', async (req, res) => {
    const { agentId } = req.params;

    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
    });

    const sendEvent = (type, data) => {
        try { res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`); } catch (e) { }
    };
    const closeResponse = () => {
        try { res.end(); } catch (e) { }
    };

    sendEvent('status', { message: 'Initializing WhatsApp connection...' });

    try {
        // If there's already an active session, kill it first for a fresh pairing
        if (activeSessions.has(agentId)) {
            const oldSock = activeSessions.get(agentId);
            try { oldSock.end(); } catch (e) { }
            activeSessions.delete(agentId);
        }

        sendEvent('status', { message: 'Connecting to WhatsApp servers...' });
        await createBaileysConnection(agentId, sendEvent, closeResponse);
    } catch (err) {
        console.error(`[${agentId}] Bridge error:`, err);
        sendEvent('error', { message: err.message || 'Unknown error occurred' });
        closeResponse();
    }

    req.on('close', () => {
        console.log(`[${agentId}] Client disconnected from SSE stream`);
    });
});

// ─── Status endpoint ────────────────────────────────────────────────────────
app.get('/wa/status/:agentId', (req, res) => {
    const { agentId } = req.params;
    const sock = activeSessions.get(agentId);

    if (!sock) {
        return res.json({ status: 'disconnected', linked: false });
    }

    const authDir = path.join(__dirname, 'auth', agentId);
    const linked = fs.existsSync(path.join(authDir, 'creds.json'));
    return res.json({ status: 'active', linked });
});

// ─── Logout endpoint ────────────────────────────────────────────────────────
app.post('/wa/logout/:agentId', async (req, res) => {
    const { agentId } = req.params;

    if (activeSessions.has(agentId)) {
        const sock = activeSessions.get(agentId);
        try { await sock.logout(); } catch (e) { }
        try { sock.end(); } catch (e) { }
        activeSessions.delete(agentId);
    }

    const authDir = path.join(__dirname, 'auth', agentId);
    if (fs.existsSync(authDir)) {
        fs.rmSync(authDir, { recursive: true, force: true });
    }

    return res.json({ success: true, message: "Logged out and auth cleared" });
});

// ─── Send Message endpoint ──────────────────────────────────────────────────
app.post('/wa/send/:agentId', async (req, res) => {
    const { agentId } = req.params;
    const { phone, message } = req.body;

    if (!phone || !message) {
        return res.status(400).json({ success: false, error: 'Phone and message are required' });
    }

    const sock = activeSessions.get(agentId);
    if (!sock) {
        return res.status(404).json({ success: false, error: 'Agent session not found or disconnected' });
    }

    // Format phone number
    const formattedPhone = phone.replace(/[^0-9]/g, '') + '@s.whatsapp.net';

    try {
        await sock.sendMessage(formattedPhone, { text: message });
        return res.json({ success: true });
    } catch (err) {
        console.error(`[${agentId}] ❌ Error sending message to ${phone}:`, err.message);
        return res.status(500).json({ success: false, error: err.message });
    }
});

// ─── Start server & auto-reconnect ──────────────────────────────────────────
app.listen(PORT, async () => {
    console.log(`🟢 WhatsApp Bridge running on http://localhost:${PORT}`);
    console.log(`   Backend URL: ${BACKEND_URL}`);
    console.log(`   QR endpoint:     GET /wa/qr/:agentId`);
    console.log(`   Status endpoint: GET /wa/status/:agentId`);
    console.log('');

    // Auto-reconnect any previously linked agents
    await bootLinkedAgents();
});
