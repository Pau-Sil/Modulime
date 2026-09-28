import { State } from './state.js';
import { UI } from './ui.js';

const SYNC_GRACE_MS = 10 * 60 * 1000;

export const Data = {
    setupWebhook() {
        const current = State.webhookURL;
        const url = prompt("Ingresa la URL de tu Web App de Google Apps Script:", current);
        if (url !== null) {
            State.saveWebhook(url.trim());
            alert("Webhook configurado correctamente.");
        }
    },

    setupCsvUrl() {
        const current = State.csvURL;
        const url = prompt("Ingresa la URL del CSV publicado de la hoja 'Registros':", current);
        if (url !== null) {
            State.saveCsvUrl(url.trim());
            alert("URL de CSV Registros configurada.");
        }
    },

    setupConfigCsvUrl() {
        const current = State.configCsvURL;
        const url = prompt("Ingresa la URL del CSV publicado de la hoja 'Config':", current);
        if (url !== null) {
            State.saveConfigCsvUrl(url.trim());
            alert("URL de CSV Config configurada.");
        }
    },

    setupHourlyRate() {
        const current = State.hourlyRate || '';
        const raw = prompt("Ingresa el coste por hora (USD):", current);
        if (raw !== null) {
            const rate = parseFloat(raw);
            if (!isNaN(rate)) {
                State.saveHourlyRate(rate);
                if (State.webhookURL) {
                    this.postConfig();
                }
                alert("Coste por hora actualizado.");
            } else {
                alert("Valor inválido.");
            }
        }
    },

    formatLocalDate(value) {
        const d = (value instanceof Date) ? value : new Date(value);
        const valid = !isNaN(d.getTime()) ? d : new Date();
        const day = String(valid.getDate()).padStart(2, '0');
        const month = String(valid.getMonth() + 1).padStart(2, '0');
        const year = valid.getFullYear();
        return `${day}/${month}/${year}`;
    },

    parseLocalDateToIso(str) {
        const parts = String(str || '').split('/');
        if (parts.length === 3) {
            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1;
            const year = parseInt(parts[2], 10);
            if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
                return new Date(year, month, day).toISOString();
            }
        }
        return str;
    },

    parseCsvRows(text) {
        const rows = [];
        let row = [];
        let field = '';
        let inQuotes = false;
        for (let i = 0; i < text.length; i++) {
            const c = text[i];
            if (inQuotes) {
                if (c === '"') {
                    if (text[i + 1] === '"') {
                        field += '"';
                        i++;
                    } else {
                        inQuotes = false;
                    }
                } else {
                    field += c;
                }
            } else {
                if (c === '"') {
                    inQuotes = true;
                } else if (c === ',') {
                    row.push(field);
                    field = '';
                } else if (c === '\n' || c === '\r') {
                    if (c === '\r' && text[i + 1] === '\n') i++;
                    row.push(field);
                    field = '';
                    if (row.length > 1 || row[0] !== '') {
                        rows.push(row);
                    }
                    row = [];
                } else {
                    field += c;
                }
            }
        }
        if (field !== '' || row.length > 0) {
            row.push(field);
            rows.push(row);
        }
        return rows;
    },

    parseRecords(text) {
        const rows = this.parseCsvRows(text);
        if (rows.length === 0) return [];
        const header = rows[0].map(h => h.trim());
        const dateCol = header.indexOf('Fecha');
        const hoursCol = header.indexOf('Horas');
        const descCol = header.indexOf('Descripción');
        const projectCol = header.indexOf('Proyecto');
        const idCol = header.indexOf('ID');

        return rows.slice(1).map(row => ({
            id: idCol >= 0 ? String(row[idCol] || '') : '',
            date: dateCol >= 0 ? this.parseLocalDateToIso(row[dateCol]) : '',
            hours: hoursCol >= 0 ? (parseInt(row[hoursCol], 10) || 0) : 0,
            description: descCol >= 0 ? String(row[descCol] || '') : '',
            project: projectCol >= 0 ? String(row[projectCol] || '') : ''
        })).filter(entry => entry.id !== '');
    },

    parseConfigRows(text) {
        const rows = this.parseCsvRows(text);
        const config = {};
        rows.slice(1).forEach(row => {
            if (row.length >= 2) {
                config[row[0].trim()] = row[1].trim();
            }
        });
        return config;
    },

    fetchPublishedCsv(url) {
        return fetch(url).then(res => res.text());
    },

    fetchCsvRecords() {
        if (!State.csvURL) return Promise.resolve([]);
        return this.fetchPublishedCsv(State.csvURL)
            .then(text => this.parseRecords(text))
            .catch(err => {
                UI.reportError("No se pudo leer el CSV de Registros.", err);
                return [];
            });
    },

    fetchConfig() {
        if (!State.configCsvURL) return Promise.resolve({});
        return this.fetchPublishedCsv(State.configCsvURL)
            .then(text => this.parseConfigRows(text))
            .catch(err => {
                UI.reportError("No se pudo leer el CSV de Config.", err);
                return {};
            });
    },

    postEntry(entry, action) {
        return fetch(State.webhookURL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: action || 'create',
                id: entry.id,
                date: entry.date,
                hours: entry.hours,
                description: entry.description,
                project: entry.project
            })
        });
    },

    postConfig() {
        return fetch(State.webhookURL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'setConfig',
                hourlyRate: State.hourlyRate,
                minuteBank: State.minuteBank
            })
        });
    },

    sendToSheet(hours, desc, project, entryId) {
        if (!State.webhookURL) {
            UI.showMessage("No hay webhook configurado. Los datos solo se guardaron localmente.");
            return Promise.resolve();
        }

        UI.showMessage("Enviando datos a Google Sheets...");

        return this.postEntry({
            id: entryId,
            date: this.formatLocalDate(new Date()),
            hours: hours,
            description: desc,
            project: project
        }, 'create').catch(err => {
            UI.reportError("Error de conexión al enviar. Queda pendiente de sincronización.", err);
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
                this.postEntry({
                    id: entry.id,
                    date: this.formatLocalDate(entry.date),
                    hours: entry.hoursBilled,
                    description: entry.desc,
                    project: entry.project
                }, 'create').then(() => {
                    State.markEntrySynced(entry.id);
                }).catch(err => {
                    UI.reportError("Error al reenviar una entrada.", err);
                })
            );
        });

        return chain.then(() => {
            UI.renderHistory();
            const remaining = State.getUnsyncedCount();
            if (remaining === 0) {
                UI.showMessage("Todas las entradas sincronizadas.");
            } else {
                UI.showMessage(`${remaining} entrada(s) siguen pendientes. Revisá tu conexión.`);
            }
        });
    },

    reconcile() {
        if (!State.csvURL) return Promise.resolve({ conflicts: [] });
        return this.fetchCsvRecords().then(remoteEntries => {
            const conflicts = [];
            const remoteIds = new Set(remoteEntries.map(r => r.id));
            remoteEntries.forEach(remote => {
                const local = State.sessionHistory.find(e => e.id === remote.id);
                if (!local) {
                    State.sessionHistory.unshift({
                        id: remote.id,
                        date: remote.date,
                        duration: 0,
                        hoursBilled: remote.hours,
                        desc: remote.description,
                        project: remote.project,
                        synced: true,
                        lastSynced: Date.now()
                    });
                } else {
                    const localDateKey = String(local.date || '').slice(0, 10);
                    const remoteDateKey = String(remote.date || '').slice(0, 10);
                    const differs = local.desc !== remote.description
                        || local.project !== remote.project
                        || local.hoursBilled !== remote.hours
                        || localDateKey !== remoteDateKey;
                    if (differs) {
                        conflicts.push({ local, remote });
                    } else {
                        local.synced = true;
                        local.lastSynced = Date.now();
                    }
                }
            });
            State.sessionHistory.forEach(local => {
                if (local.synced && local.hoursBilled > 0 && !remoteIds.has(local.id)) {
                    const lastSynced = local.lastSynced || 0;
                    if (Date.now() - lastSynced >= SYNC_GRACE_MS) {
                        local.synced = false;
                    }
                }
            });
            State.saveHistory();
            UI.renderHistory();
            return { conflicts };
        });
    },

    pollUntilSynced(entryId, opts) {
        const options = opts || {};
        const interval = options.interval || 30000;
        const maxAttempts = options.maxAttempts || 12;
        let attempts = 0;
        return new Promise(resolve => {
            const check = () => {
                attempts++;
                this.fetchCsvRecords().then(records => {
                    if (records.some(r => r.id === entryId)) {
                        State.markEntrySynced(entryId);
                        resolve(true);
                    } else if (attempts >= maxAttempts) {
                        resolve(false);
                    } else {
                        setTimeout(check, interval);
                    }
                }).catch(() => {
                    if (attempts >= maxAttempts) {
                        resolve(false);
                    } else {
                        setTimeout(check, interval);
                    }
                });
            };
            check();
        });
    },

    pollUntilAbsent(entryId, opts) {
        const options = opts || {};
        const interval = options.interval || 30000;
        const maxAttempts = options.maxAttempts || 12;
        let attempts = 0;
        return new Promise(resolve => {
            const check = () => {
                attempts++;
                this.fetchCsvRecords().then(records => {
                    if (!records.some(r => r.id === entryId)) {
                        resolve(true);
                    } else if (attempts >= maxAttempts) {
                        resolve(false);
                    } else {
                        setTimeout(check, interval);
                    }
                }).catch(() => {
                    if (attempts >= maxAttempts) {
                        resolve(false);
                    } else {
                        setTimeout(check, interval);
                    }
                });
            };
            check();
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
                if (typeof data.bank !== 'number' || isNaN(data.bank)) throw new Error('Formato inválido');
                if (data.history !== undefined && !Array.isArray(data.history)) throw new Error('Formato inválido');

                const history = (data.history || []).map(entry => {
                    if (!entry || typeof entry !== 'object') throw new Error('Formato inválido');
                    const synced = typeof entry.synced === 'boolean' ? entry.synced : true;
                    return {
                        id: entry.id || entry.date || new Date().toISOString(),
                        date: entry.date || new Date().toISOString(),
                        duration: typeof entry.duration === 'number' ? entry.duration : 0,
                        hoursBilled: typeof entry.hoursBilled === 'number' ? entry.hoursBilled : 0,
                        desc: entry.desc || '',
                        project: entry.project || '',
                        synced: synced,
                        lastSynced: synced ? Date.now() : 0
                    };
                });

                State.minuteBank = data.bank;
                State.sessionHistory = history;
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
