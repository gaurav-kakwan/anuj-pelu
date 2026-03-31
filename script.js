// Session check
(function () {
    var token = localStorage.getItem('sessionToken');
    if (!token) {
        window.location.href = '/login.html';
        return;
    }
    fetch('/check-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token })
    }).then(function (r) { return r.json(); }).then(function (data) {
        if (!data.valid) {
            localStorage.removeItem('sessionToken');
            window.location.href = '/login.html';
        }
    }).catch(function () {
        window.location.href = '/login.html';
    });
})();

// Custom popup instead of alert
function showResult(sent, fail) {
    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:9999;';

    var box = document.createElement('div');
    box.style.cssText = 'background:#1e293b;border:1px solid #334155;border-radius:16px;padding:32px 40px;text-align:center;min-width:280px;box-shadow:0 20px 60px rgba(0,0,0,0.5);';

    var html = '';

    if (sent > 0) {
        html += '<div style="font-size:48px;margin-bottom:8px;">✅</div>';
        html += '<div style="color:#6ee7b7;font-size:20px;font-weight:700;margin-bottom:6px;">' + sent + ' Sent</div>';
    }
    if (fail > 0) {
        html += '<div style="font-size:48px;margin-bottom:8px;">❌</div>';
        html += '<div style="color:#fca5a5;font-size:20px;font-weight:700;margin-bottom:6px;">' + fail + ' Failed</div>';
    }

    html += '<button id="closePopup" style="margin-top:20px;padding:10px 40px;border:none;border-radius:8px;background:#3b82f6;color:#fff;font-size:15px;font-weight:600;cursor:pointer;">OK</button>';

    box.innerHTML = html;
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    document.getElementById('closePopup').addEventListener('click', function () {
        document.body.removeChild(overlay);
    });
}

function showError(msg) {
    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:9999;';

    var box = document.createElement('div');
    box.style.cssText = 'background:#1e293b;border:1px solid #7f1d1d;border-radius:16px;padding:32px 40px;text-align:center;min-width:280px;box-shadow:0 20px 60px rgba(0,0,0,0.5);';

    box.innerHTML = '<div style="font-size:48px;margin-bottom:8px;">❌</div><div style="color:#fca5a5;font-size:18px;font-weight:600;margin-bottom:20px;">' + msg + '</div><button id="closePopup" style="padding:10px 40px;border:none;border-radius:8px;background:#3b82f6;color:#fff;font-size:15px;font-weight:600;cursor:pointer;">OK</button>';

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    document.getElementById('closePopup').addEventListener('click', function () {
        document.body.removeChild(overlay);
    });
}

// Send
document.getElementById('sendBtn').addEventListener('click', async function () {
    var token = localStorage.getItem('sessionToken');
    if (!token) {
        showError('Please login first.');
        window.location.href = '/login.html';
        return;
    }

    var btn = this;
    btn.disabled = true;
    btn.textContent = 'Sending...';

    var res = await fetch('/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            token: token,
            senderName: document.getElementById('senderName').value,
            gmail: document.getElementById('gmail').value,
            apppass: document.getElementById('apppass').value,
            subject: document.getElementById('subject').value,
            message: document.getElementById('message').value,
            to: document.getElementById('to').value
        })
    });

    var data = await res.json();

    if (data.success) {
        showResult(data.sent, data.fail);
    } else {
        showError(data.msg);
    }

    btn.disabled = false;
    btn.textContent = 'Send All';
});

// Logout
document.getElementById('logoutBtn').addEventListener('click', function () {
    fetch('/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: localStorage.getItem('sessionToken') })
    }).finally(function () {
        localStorage.removeItem('sessionToken');
        window.location.href = '/login.html';
    });
});
