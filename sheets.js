let webhookURL = localStorage.getItem('googleWebhookURL') || "";

function setupWebhook() {
    const url = prompt("Ingresa la URL de tu Web App de Google Apps Script:");
    if (url) {
        webhookURL = url;
        localStorage.setItem('googleWebhookURL', url);
        alert("Webhook configurado correctamente.");
    }
}

function sendToSheet(hours, desc) {
    if (!webhookURL) {
        alert("No tienes configurada la URL de Google Sheets.\nSe guardó localmente, pero no se sincronizó.");
        return;
    }

    const msgEl = document.getElementById('message');
    msgEl.innerText = "Sincronizando con la nube...";
    
    fetch(webhookURL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hours: hours, description: desc })
    }).then(() => {
        msgEl.innerText = "¡Sincronizado OK!";
        setTimeout(() => msgEl.innerText = "Listo.", 3000);
    }).catch(err => {
        console.error(err);
        msgEl.innerText = "Error de conexión.";
        alert("Error al intentar conectar con Google Sheets. Revisa tu internet.");
    });
}
