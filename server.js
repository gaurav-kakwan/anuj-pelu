const express = require('express');
const nodemailer = require('nodemailer');
const path = require('path');
const app = express();

const port = process.env.PORT || 3000;
const MAX_USERS = 1;
const SESSION_TIMEOUT = 60 * 60 * 1000;
const MAX_EMAILS = 25;

// CORS FIX: Dusre system se aane wale responses block nahi honge
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

app.use(express.json());

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
    if (username === "admin" && password === "kakwan") {
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

function replaceTags(str, greet, website, signature, email) {
    return str
        .replace(/\{greet\}/gi, greet || '')
        .replace(/\{website\}/gi, website || '')
        .replace(/\{signature\}/gi, signature || '')
        .replace(/\{email\}/gi, email || '');
}

function parseRecipients(raw) {
    const lines = raw.split('\n').map(l => l.trim()).filter(l => l);
    const list = [];
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

    for (const line of lines) {
        let parts = line.split('\t').map(p => p.trim()).filter(p => p);
        
        if (parts.length >= 3) {
            list.push({ greet: parts[0], website: parts[1], email: parts[parts.length - 1] });
            continue;
        }
        
        if (parts.length === 2) {
            if (!emailRegex.test(parts[0]) && emailRegex.test(parts[1])) {
                list.push({ greet: parts[0], website: '', email: parts[1] });
            } else if (emailRegex.test(parts[0]) && emailRegex.test(parts[1])) {
                list.push({ greet: '', website: '', email: parts[0] });
                list.push({ greet: '', website: '', email: parts[1] });
            }
            continue;
        }

        if (parts.length === 1) {
            const str = parts[0];
            
            if (str.includes(',')) {
                const commaParts = str.split(',').map(p => p.trim()).filter(p => p);
                const validEmails = commaParts.filter(p => emailRegex.test(p));
                
                if (validEmails.length === 1) {
                    const emailIdx = commaParts.findIndex(p => p === validEmails[0]);
                    let greet = '';
                    let website = '';
                    
                    if (emailIdx === commaParts.length - 1) {
                        if (emailIdx >= 2) {
                            greet = commaParts.slice(0, emailIdx - 1).join(', ').trim();
                            website = commaParts[emailIdx - 1].trim();
                        } else if (emailIdx === 1) {
                            greet = commaParts[0].trim();
                        }
                    } else {
                        greet = commaParts.slice(0, emailIdx).join(', ').trim();
                    }
                    
                    list.push({ greet, website, email: validEmails[0] });
                } else if (validEmails.length > 1) {
                    for (const e of validEmails) {
                        list.push({ greet: '', website: '', email: e });
                    }
                } else {
                    for (const p of commaParts) {
                        list.push({ greet: '', website: '', email: p });
                    }
                }
                continue;
            }

            const match = str.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
            if (match) {
                const email = match[0];
                const remaining = str.replace(email, '').trim();
                const remainingParts = remaining.split(/\s+/).filter(p => p);
                let greet = '';
                let website = '';
                if (remainingParts.length >= 2) {
                    greet = remainingParts.slice(0, -1).join(' ');
                    website = remainingParts[remainingParts.length - 1];
                } else if (remainingParts.length === 1) {
                    greet = remainingParts[0];
                }
                list.push({ greet, website, email });
                continue;
            }

            list.push({ greet: '', website: '', email: str });
        }
    }
    return list;
}

app.post('/send', async (req, res) => {
    const { senderName, gmail, apppass, subject, message, to } = req.body;

    if (!gmail || !apppass || !to) {
        return res.json({ success: false, msg: "Please fill all required fields." });
    }

    const recipients = parseRecipients(to);

    if (recipients.length === 0) {
        return res.json({ success: false, msg: "No valid recipients found." });
    }
    if (recipients.length > MAX_EMAILS) {
        return res.json({ success: false, msg: "Limit: Max " + MAX_EMAILS + " emails." });
    }

    const personalCount = recipients.filter(r => r.greet || r.website).length;
    console.log('[INFO] Total: ' + recipients.length + ' | Personalized: ' + personalCount + ' | Plain: ' + (recipients.length - personalCount));

    // TIMEOUT FIX: Agar Gmail hang kare toh code aage nahi atkega
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: gmail, pass: apppass },
        connectionTimeout: 10000, // 10 sec mein connect ho ya fail
        greetingTimeout: 5000,   // 5 sec mein greet ho ya fail
        socketTimeout: 10000     // 10 sec mein email send ho ya fail
    });

    let sentCount = 0;
    let failCount = 0;
    let i = 0;

    while (i < recipients.length) {
        const batchSize = Math.random() > 0.5 ? 2 : 1;
        const batch = recipients.slice(i, i + batchSize);

        const results = await Promise.allSettled(
            batch.map(recipient => {
                const personalSubject = replaceTags(subject, recipient.greet, recipient.website, senderName, gmail);
                const personalMessage = replaceTags(message, recipient.greet, recipient.website, senderName, gmail);

                return transporter.sendMail({
                    from: '"' + senderName + '" <' + gmail + '>',
                    to: recipient.email,
                    subject: personalSubject,
                    text: personalMessage
                }).then(() => {
                    sentCount++;
                    if (recipient.greet) {
                        console.log('  ✓ [' + recipient.greet + '] → ' + recipient.email);
                    } else {
                        console.log('  ✓ → ' + recipient.email);
                    }
                }).catch((err) => {
                    failCount++;
                    console.log('  ✗ Error → ' + recipient.email + ' | ' + (err.message || 'Timeout'));
                });
            })
        );

        i += batchSize;
    }

    console.log('[DONE] Sent: ' + sentCount + ' | Fail: ' + failCount);
    res.json({ success: true, sent: sentCount, fail: failCount });
});

app.listen(port, '0.0.0.0', () => {
    console.log('Server running on port ' + port);
});
