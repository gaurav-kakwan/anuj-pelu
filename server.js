const express = require('express');
const nodemailer = require('nodemailer');
const path = require('path');
const app = express();

const port = process.env.PORT || 3000;
const MAX_USERS = 1;
const SESSION_TIMEOUT = 60 * 60 * 1000; // 60 min
const MAX_EMAILS = 25; // 25 per gmail

app.use(express.json());

// Route pehle, warna bina login ke index.html khul jata tha
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

app.use(express.static(__dirname));

let activeSessions = new Map();

function generateToken() {
    return Math.random().toString(36).substr(2, 12) + Date.now().toString(36);
}

function cleanupExpiredSessions() {
    const now = Date.now();
    let removed = 0;
    for (const [token, data] of activeSessions) {
        if (now - data.lastActivity > SESSION_TIMEOUT) {
            activeSessions.delete(token);
            removed++;
        }
    }
    if (removed > 0) {
        console.log('[CLEANUP] ' + removed + ' dead session(s) removed — ' + activeSessions.size + '/' + MAX_USERS + ' active');
    }
}

setInterval(cleanupExpiredSessions, 60 * 60 * 1000);

function validateSession(token) {
    if (!token || !activeSessions.has(token)) return false;
    const data = activeSessions.get(token);
    if (Date.now() - data.lastActivity > SESSION_TIMEOUT) {
        activeSessions.delete(token);
        console.log('[SESSION DEAD] expired — ' + activeSessions.size + '/' + MAX_USERS + ' active');
        return false;
    }
    data.lastActivity = Date.now();
    return true;
}

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (username === "subhangi" && password === "kakwan") {
        cleanupExpiredSessions();
        if (activeSessions.size >= MAX_USERS) {
            return res.json({ success: false, msg: "User Limit Reached! Max " + MAX_USERS + " users allowed." });
        }
        const token = generateToken();
        activeSessions.set(token, { loginTime: Date.now(), lastActivity: Date.now() });
        console.log('[LOGIN] Session started — ' + activeSessions.size + '/' + MAX_USERS + ' active');
        return res.json({ success: true, token: token });
    }
    return res.json({ success: false, msg: "Invalid Credentials" });
});

app.post('/logout', (req, res) => {
    const { token } = req.body;
    if (token && activeSessions.has(token)) {
        activeSessions.delete(token);
        console.log('[LOGOUT] Session ended — ' + activeSessions.size + '/' + MAX_USERS + ' active');
    }
    res.json({ success: true });
});

app.post('/check-session', (req, res) => {
    const { token } = req.body;
    if (validateSession(token)) {
        res.json({ valid: true, activeUsers: activeSessions.size, maxUsers: MAX_USERS });
    } else {
        res.json({ valid: false });
    }
});

// --- HELPER FUNCTION: DELAY ---
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// --- EMAIL SEND API (BATCH 5 + INDIVIDUAL + 3 SEC BATCH WAIT) ---
app.post('/send', async (req, res) => {
    const { senderName, gmail, apppass, subject, message, to } = req.body;

    if (!gmail || !apppass || !to) {
        return res.json({ success: false, msg: "Please fill all required fields." });
    }

    const recipients = to.split(/[,\n]/).map(e => e.trim()).filter(e => e);
    if (recipients.length > MAX_EMAILS) return res.json({ success: false, msg: "Limit: Max " + MAX_EMAILS + " emails." });

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: gmail, pass: apppass }
    });

    let sentCount = 0;
    const BATCH_SIZE = 3;
    const BATCH_DELAY = 2000; // 3 seconds between batches

    for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
        const batch = recipients.slice(i, i + BATCH_SIZE);
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(recipients.length / BATCH_SIZE);

        console.log(`[BATCH ${batchNum}/${totalBatches}] Started — ${batch.length} emails`);

        // Batch ke andar ek ek karke bhejo (individual)
        for (const email of batch) {
            try {
                await transporter.sendMail({
                    from: `"${senderName}" <${gmail}>`,
                    to: email,
                    subject: subject,
                    text: message
                });
                sentCount++;
                console.log(`  ✓ Sent to: ${email}`);
            } catch (e) {
                console.log(`  ✗ Failed: ${email}`);
            }
        }

        // Agla batch se pehle 3 sec wait — LAST BATCH ke baad nahi
        if (i + BATCH_SIZE < recipients.length) {
            console.log(`[BATCH ${batchNum}/${totalBatches}] Done. Waiting 3 seconds...`);
            await wait(BATCH_DELAY);
        }
    }

    console.log(`[DONE] Total sent: ${sentCount}/${recipients.length}`);
    res.json({ success: true, sent: sentCount });
});

app.listen(port, '0.0.0.0', () => {
    console.log('Server running on port ' + port);
});
