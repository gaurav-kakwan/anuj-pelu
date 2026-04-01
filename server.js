const express = require('express');
const nodemailer = require('nodemailer');
const path = require('path');
const app = express();

const port = process.env.PORT || 3000;
const BATCH_SIZE = 5;
const BATCH_DELAY = 1000; // 1 sec batch delay
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
    if (username === "anuj" && password === "2026") {
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

function parseRecipients(text) {
    if (!text) return [];
    const lines = text.split('\n');
    const results = [];
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const parts = trimmed.split('\t');
        let name = '', website = '', email = '';

        if (parts.length >= 3) {
            name = parts[0].trim();
            website = parts[1].trim();
            email = parts[2].trim();
        } else if (parts.length === 2) {
            if (emailRe.test(parts[1].trim())) {
                name = parts[0].trim();
                email = parts[1].trim();
            } else if (emailRe.test(parts[0].trim())) {
                website = parts[0].trim();
                email = parts[1].trim();
            }
        } else {
            email = parts[0].trim();
        }
        if (emailRe.test(email)) {
            results.push({ name, website, email });
        }
    }
    return results;
}

app.post('/send', async (req, res) => {
    const { token, senderName, gmail, apppass, subject, message, to } = req.body;

    if (!validateSession(token)) {
        return res.json({ success: false, msg: "Session expired. Please login again." });
    }

    if (!gmail || !apppass || !to) {
        return res.json({ success: false, msg: "Please fill all required fields." });
    }

    const recipients = parseRecipients(to);

    if (recipients.length === 0) {
        return res.json({ success: false, msg: "No valid recipients found." });
    }

    if (recipients.length > MAX_EMAILS) {
        return res.json({ success: false, msg: "Limit: Max " + MAX_EMAILS + " emails per Gmail." });
    }

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: gmail, pass: apppass }
    });

    let sentCount = 0;
    let failCount = 0;
    const total = recipients.length;
    const totalBatches = Math.ceil(total / BATCH_SIZE);

    for (let b = 0; b < totalBatches; b++) {
        const start = b * BATCH_SIZE;
        const end = Math.min(start + BATCH_SIZE, total);
        const batch = recipients.slice(start, end);

        // Batch ke andar sabko EK SAATH (parallel) bhejo
        await Promise.all(batch.map(async (r) => {
            let finalSubject = (subject || '').replace(/\{greet\}/g, r.name).replace(/\{website\}/g, r.website);
            let finalMessage = (message || '').replace(/\{greet\}/g, r.name).replace(/\{website\}/g, r.website);

            try {
                await transporter.sendMail({
                    from: '"' + senderName + '" <' + gmail + '>',
                    to: r.email,
                    subject: finalSubject,
                    text: finalMessage
                });
                sentCount++;
                console.log('[SENT] ' + r.email + ' (' + r.name + ')');
            } catch (e) {
                failCount++;
                console.log('[FAIL] ' + r.email + ' — ' + e.message);
            }
        }));

        // Batch ke beech 1 sec delay
        if (b < totalBatches - 1) {
            console.log('[BATCH] ' + (b + 1) + '/' + totalBatches + ' done, waiting 1s...');
            await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
        }
    }

    res.json({ success: true, sent: sentCount, fail: failCount });
    transporter.close();
});

app.listen(port, '0.0.0.0', () => {
    console.log('Server running on port ' + port);
});
