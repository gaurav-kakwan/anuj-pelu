const express = require('express');
const nodemailer = require('nodemailer');
const path = require('path');
const app = express();

const port = 80; // Port 80 set kiya
const MAX_USERS = 1;
const SESSION_TIMEOUT = 60 * 60 * 1000; // 60 min
const MAX_EMAILS =75; // Limit 500 kiya

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

// --- EXCEL DATA PARSER ---
function parseExcelData(raw) {
    const lines = raw.split(/\n/).map(l => l.trim()).filter(l => l);
    const entries = [];

    for (const line of lines) {
        // Excel se paste = Tab separated
        const parts = line.split(/\t/);

        if (parts.length >= 3) {
            entries.push({
                greet: parts[0].trim(),
                website: parts[1].trim(),
                email: parts[2].trim()
            });
        } else if (parts.length === 2) {
            // Sirf Name + Email ho toh
            entries.push({
                greet: parts[0].trim(),
                website: '',
                email: parts[1].trim()
            });
        } else {
            // Purana style sirf email
            const email = parts[0].trim();
            if (email.includes('@')) {
                entries.push({ greet: '', website: '', email: email });
            }
        }
    }

    return entries.filter(e => e.email && e.email.includes('@'));
}

// --- TEMPLATE REPLACER ---
function fillTemplate(template, greet, website) {
    return template
        .replace(/\{greet\}/gi, greet)
        .replace(/\{website\}/gi, website);
}

// --- EMAIL SEND API (BATCH OF 5 + INDIVIDUAL + 3 SEC BATCH WAIT) ---
app.post('/send', async (req, res) => {
    const { senderName, gmail, apppass, subject, message, to } = req.body;

    if (!gmail || !apppass || !to) {
        return res.json({ success: false, msg: "Please fill all required fields." });
    }

    const entries = parseExcelData(to);

    if (entries.length === 0) {
        return res.json({ success: false, msg: "No valid emails found. Paste Excel data: Name \t Website \t Email" });
    }

    if (entries.length > MAX_EMAILS) {
        return res.json({ success: false, msg: "Limit: Max " + MAX_EMAILS + " emails." });
    }

    console.log(`[PARSED] ${entries.length} entries found`);
    console.log(`[SAMPLE] First: "${entries[0].greet}" | "${entries[0].website}" | "${entries[0].email}"`);

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: gmail, pass: apppass }
    });

    let sentCount = 0;
    let failCount = 0;
    const BATCH_SIZE = 1; // 5 ke batch
    const BATCH_DELAY = 10; // 3 seconds between batches

    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
        const batch = entries.slice(i, i + BATCH_SIZE);
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(entries.length / BATCH_SIZE);

        console.log(`\n[BATCH ${batchNum}/${totalBatches}] Started — ${batch.length} emails`);

        // Batch ke andar ek ek karke bhejo (individual)
        for (const entry of batch) {
            try {
                // Har email ke liye template fill karo
                const finalSubject = fillTemplate(subject, entry.greet, entry.website);
                const finalMessage = fillTemplate(message, entry.greet, entry.website);

                await transporter.sendMail({
                    from: `"${senderName}" <${gmail}>`,
                    to: entry.email,
                    subject: finalSubject,
                    text: finalMessage
                });
                sentCount++;
                console.log(`  ✓ [${entry.greet}] → ${entry.email}`);
            } catch (e) {
                failCount++;
                console.log(`  ✗ [${entry.greet}] → ${entry.email} | Error: ${e.message}`);
            }
        }

        // Agla batch se pehle 3 sec wait — LAST BATCH ke baad nahi
        if (i + BATCH_SIZE < entries.length) {
            console.log(`[BATCH ${batchNum}/${totalBatches}] Done. Waiting 3 seconds...`);
            await wait(BATCH_DELAY);
        }
    }

    console.log(`\n[DONE] Sent: ${sentCount} | Failed: ${failCount} | Total: ${entries.length}`);
    res.json({ success: true, sent: sentCount, failed: failCount, total: entries.length });
});

app.listen(port, '0.0.0.0', () => {
    console.log('Server running on port ' + port);
});
