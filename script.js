if (!sessionStorage.getItem("auth")) {
  location.href = "/login.html";
}

let sending = false;

const sendBtn = document.getElementById("sendBtn");
const logoutBtn = document.getElementById("logoutBtn");
const senderName = document.getElementById("senderName");
const gmail = document.getElementById("gmail");
const apppass = document.getElementById("apppass");
const subject = document.getElementById("subject");
const message = document.getElementById("message");
const to = document.getElementById("to");

window.onload = function() {
    senderName.value = localStorage.getItem('save_senderName') || '';
    gmail.value = localStorage.getItem('save_gmail') || '';
    apppass.value = localStorage.getItem('save_apppass') || '';
    subject.value = localStorage.getItem('save_subject') || '';
    message.value = localStorage.getItem('save_message') || '';
    to.value = localStorage.getItem('save_to') || '';
};

function saveData() {
    localStorage.setItem('save_senderName', senderName.value);
    localStorage.setItem('save_gmail', gmail.value);
    localStorage.setItem('save_apppass', apppass.value);
    localStorage.setItem('save_subject', subject.value);
    localStorage.setItem('save_message', message.value);
    localStorage.setItem('save_to', to.value);
}

[senderName, gmail, apppass, subject, message, to].forEach(input => {
    input.addEventListener('blur', saveData);
});

sendBtn.onclick = () => { if (!sending) sendMail(); };

logoutBtn.ondblclick = async () => {
  if (!sending) {
    try { await fetch("/logout", { method: "POST" }); } catch(e){ console.log(e); }
    sessionStorage.clear();
    location.href = "/login.html";
  }
};

async function sendMail() {
  if (!gmail.value.trim() || !apppass.value.trim() || !to.value.trim()) {
    alert("Fill Gmail, App Password, and Recipients.");
    return;
  }

  sending = true;
  sendBtn.disabled = true;
  sendBtn.innerText = "Sending…";
  saveData();

  try {
    const res = await fetch("/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        senderName: senderName.value.trim(),
        gmail: gmail.value.trim(),
        apppass: apppass.value.trim(),
        subject: subject.value.trim(),
        message: message.value.trim(),
        to: to.value.trim()
      })
    });

    const data = await res.json();

    if (!data.success) {
      alert(data.msg || "Sending failed");
      return;
    }

    alert("Success ✅\nEmails Sent: " + data.sent + "\nFailed: " + data.fail);

  } catch (err) {
    alert("Server error");
  } finally {
    sending = false;
    sendBtn.disabled = false;
    sendBtn.innerText = "Send All";
  }
}