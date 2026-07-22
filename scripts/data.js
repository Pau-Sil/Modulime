import { State } from './state.js';
import { UI } from './ui.js';

function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export const Data = {
    setupWebhook() {
        const current = State.webhookURL;
        const url = prompt("Ingresa la URL de tu Web App de Google Apps Script:", current);
        if (url !== null) {
            State.saveWebhook(url.trim());
            UI.showAlert("Webhook configurado correctamente.");
        }
    },

    sendToSheet(hours, desc, project, entryId) {
        if (!State.webhookURL) {
            UI.showMessage("No hay webhook configurado. Los datos solo se guardaron localmente.");
            if (entryId) State.markEntrySynced(entryId);
            return Promise.resolve();
        }

        UI.showMessage("Enviando datos a Google Sheets...");

        return fetch(State.webhookURL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: entryId,
                hours: hours,
                description: desc,
                project: project
            })
        }).then(() => {
            if (entryId) State.markEntrySynced(entryId);
            UI.showMessage("Datos enviados (no se puede confirmar recepción con Google Sheets).");
        }).catch(() => {
            UI.showMessage("Error de conexión al enviar. Queda pendiente de sincronización.");
        });
    },

    syncPending() {
        if (!State.webhookURL) {
            UI.showMessage("Configurá primero la URL de Google Sheets.");
            return;
        }

        const pending = State.sessionHistory.filter(e => e.hoursBilled > 0 && !e.synced);
        if (pending.length === 0) {
            UI.showMessage("No hay entradas pendientes de sincronización.");
            return;
        }

        UI.showMessage(`Reintentando ${pending.length} entrada(s) pendiente(s)...`);

        let chain = Promise.resolve();
        pending.forEach(entry => {
            chain = chain.then(() =>
                fetch(State.webhookURL, {
                    method: 'POST',
                    mode: 'no-cors',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id: entry.id,
                        hours: entry.hoursBilled,
                        description: entry.desc,
                        project: entry.project
                    })
                }).then(() => {
                    State.markEntrySynced(entry.id);
                }).catch(() => {
                })
            );
        });

        chain.then(() => {
            UI.renderHistory();
            const remaining = State.getUnsyncedCount();
            if (remaining === 0) {
                UI.showMessage("Todas las entradas sincronizadas.");
            } else {
                UI.showMessage(`${remaining} entrada(s) siguen pendientes. Revisá tu conexión.`);
            }
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
