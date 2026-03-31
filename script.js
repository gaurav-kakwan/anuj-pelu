// Session check — bina login ke index.html pe nahi aayega
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

// Send
document.getElementById('sendBtn').addEventListener('click', async function () {
    var token = localStorage.getItem('sessionToken');
    if (!token) {
        alert('Please login first.');
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
    alert(data.success ? 'Sent: ' + data.sent + ' | Fail: ' + data.fail : data.msg);

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
