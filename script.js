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

// Top popup
function showResult(sent, fail) {
    var popup = document.createElement('div');
    popup.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#064e3b;border:1px solid #065f46;color:#6ee7b7;padding:16px 32px;border-radius:12px;font-size:16px;font-weight:600;z-index:9999;display:flex;align-items:center;gap:12px;box-shadow:0 10px 40px rgba(0,0,0,0.5);animation:popIn 0.3s ease;';

    var text = '';
    if (sent > 0) text += '✅ Sent: ' + sent + '   ';
    if (fail > 0) text += '❌ Fail: ' + fail;

    popup.innerHTML = text + '<span style="cursor:pointer;margin-left:8px;opacity:0.7;" onclick="this.parentElement.remove()">✕</span>';

    var style = document.createElement('style');
    style.textContent = '@keyframes popIn{from{transform:translateX(-50%) translateY(-30px);opacity:0}to{transform:translateX(-50%) translateY(0);opacity:1}}';
    popup.appendChild(style);

    document.body.appendChild(popup);

    setTimeout(function () {
        popup.style.transition = 'opacity 0.4s';
        popup.style.opacity = '0';
        setTimeout(function () { popup.remove(); }, 400);
    }, 4000);
}

function showError(msg) {
    var popup = document.createElement('div');
    popup.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#450a0a;border:1px solid #7f1d1d;color:#fca5a5;padding:16px 32px;border-radius:12px;font-size:16px;font-weight:600;z-index:9999;display:flex;align-items:center;gap:12px;box-shadow:0 10px 40px rgba(0,0,0,0.5);animation:popIn 0.3s ease;';

    popup.innerHTML = '❌ ' + msg + '<span style="cursor:pointer;margin-left:8px;opacity:0.7;" onclick="this.parentElement.remove()">✕</span>';

    var style = document.createElement('style');
    style.textContent = '@keyframes popIn{from{transform:translateX(-50%) translateY(-30px);opacity:0}to{transform:translateX(-50%) translateY(0);opacity:1}}';
    popup.appendChild(style);

    document.body.appendChild(popup);

    setTimeout(function () {
        popup.style.transition = 'opacity 0.4s';
        popup.style.opacity = '0';
        setTimeout(function () { popup.remove(); }, 400);
    }, 4000);
}

// Send
document.getElementById('sendBtn').addEventListener('click', async function () {
    var token = localStorage.getItem('sessionToken');
