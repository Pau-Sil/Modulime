// --- CONFIGURACIÓN Y RED (Google Sheets) ---

let webhookURL = localStorage.getItem('googleWebhookURL') || "";

/**
 * Configura la URL del Webhook de Google Apps Script.
 */
function setupWebhook() {
    const url = prompt("Ingresa la URL de tu Web App de Google Apps Script:");
    if (url) {
        webhookURL = url;
        localStorage.setItem('googleWebhookURL', url);
        alert("Webhook configurado correctamente.");
    }
}

/**
 * Envía los datos a la hoja de cálculo.
 * @param {number} hours - Horas a registrar (puede ser 0 si solo actualizamos descripción).
 * @param {string} desc - Descripción de la tarea.
 */
function sendToSheet(hours, desc) {
    if (!webhookURL) {
        alert("No tienes configurada la URL de Google Sheets.\nSe guardó localmente, pero no se sincronizó.");
        return;
    }

    const msgEl = document.getElementById('message');
    msgEl.innerText = "Sincronizando con la nube...";
    
    fetch(webhookURL, {
        method: 'POST',
        mode: 'no-cors', // Necesario para Google Apps Script
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