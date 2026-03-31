document.getElementById('sendBtn').addEventListener('click', async function () {
    const btn = this;
    btn.disabled = true;
    btn.textContent = 'Sending...';

    const res = await fetch('/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            token: localStorage.getItem('sessionToken'),
            senderName: document.getElementById('senderName').value,
            gmail: document.getElementById('gmail').value,
            apppass: document.getElementById('apppass').value,
            subject: document.getElementById('subject').value,
            message: document.getElementById('message').value,
            to: document.getElementById('to').value
        })
    });

    const data = await res.json();
    alert(data.success ? 'Sent: ' + data.sent + ' | Fail: ' + data.fail : data.msg);

    btn.disabled = false;
    btn.textContent = 'Send All';
});

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
