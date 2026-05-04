import { State } from './state.js';
import { UI } from './ui.js';

export const Data = {
    setupWebhook() {
        const current = State.webhookURL;
        const url = prompt("Ingresa la URL de tu Web App de Google Apps Script:", current);
        if (url !== null) {
            State.saveWebhook(url.trim());
            alert("Webhook configurado correctamente.");
        }
    },

    sendToSheet(hours, desc, project) {
        if (!State.webhookURL) {
            alert(`IMPORTANTE: No tienes configurada la URL de Google Sheets.\nSe guardó localmente, pero anota manualmente: ${hours} HORAS.`);
            return;
        }

        UI.showMessage("Sincronizando con la nube...");

        fetch(State.webhookURL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ hours: hours, description: desc, project: project })
        }).then(() => {
            UI.showMessage("¡Sincronizado OK!");
            setTimeout(() => {
                if(document.getElementById('message').textContent === "¡Sincronizado OK!") {
                    UI.showMessage("Listo.");
                }
            }, 3000);
        }).catch(err => {
            console.error(err);
            UI.showMessage("Error de conexión.");
            alert("Error al intentar conectar con Google Sheets. Revisa tu internet.");
        });
    },

    exportJson() {
        const payload = {
            app: 'modulime',
            version: 6.0,
            bank: State.minuteBank,
            history: State.sessionHistory,
            webhook: State.webhookURL
        };
        this.downloadFile(JSON.stringify(payload, null, 2), 'application/json', `modulime_bkp_${new Date().toISOString().slice(0, 10)}.json`);
    },

    importJson(file, callback) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = e => {
            try {
                const data = JSON.parse(e.target.result);
                if (typeof data.bank !== 'number') throw new Error('Formato inválido');

                State.minuteBank = data.bank;
                State.sessionHistory = data.history || [];
                if (data.webhook) State.saveWebhook(data.webhook);

                State.saveBank();
                State.saveHistory();
                callback(true);
            } catch {
                callback(false);
            }
        };
        reader.readAsText(file);
    },

    downloadFile(content, type, filename) {
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
};
