function storageAvailable() {
    try {
        const key = '__modulime_test__';
        localStorage.setItem(key, '1');
        localStorage.removeItem(key);
        return true;
    } catch {
        return false;
    }
}

const hasStorage = storageAvailable();

function safeSet(key, value) {
    if (!hasStorage) return;
    try {
        localStorage.setItem(key, value);
    } catch {
    }
}

function safeGet(key) {
    if (!hasStorage) return null;
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
}

function safeJSON(key, fallback) {
    try {
        const raw = safeGet(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch {
        return fallback;
    }
}

function safeFloat(key, fallback) {
    try {
        const raw = safeGet(key);
        if (raw === null) return fallback;
        const val = parseFloat(raw);
        return isNaN(val) ? fallback : Math.round(val * 100) / 100;
    } catch {
        return fallback;
    }
}

export const State = {
    minuteBank: safeFloat('workMinuteBank', 0),
    sessionHistory: safeJSON('sessionHistory', []),
    currentSession: safeJSON('currentSession', {
        status: 'IDLE',
        startTime: null,
        accumulated: 0
    }),
    webhookURL: safeGet('googleWebhookURL') || "",

    saveSession() { safeSet('currentSession', JSON.stringify(this.currentSession)); },
    saveBank() { safeSet('workMinuteBank', Math.round(this.minuteBank * 100) / 100); },
    saveHistory() { safeSet('sessionHistory', JSON.stringify(this.sessionHistory)); },

    migrateHistory() {
        let changed = false;
        this.sessionHistory = this.sessionHistory.map(entry => {
            if (!entry.id) {
                changed = true;
                entry.id = entry.date || new Date().toISOString();
            }
            if (entry.synced === undefined) {
                changed = true;
                entry.synced = true;
            }
            return entry;
        });
        if (changed) this.saveHistory();
    },

    markEntrySynced(id) {
        const entry = this.sessionHistory.find(e => e.id === id);
        if (entry) {
            entry.synced = true;
            this.saveHistory();
        }
    },

    getUnsyncedCount() {
        return this.sessionHistory.filter(e => e.hoursBilled > 0 && !e.synced).length;
    },
    saveWebhook(url) {
        this.webhookURL = url;
        safeSet('googleWebhookURL', url);
    },
    resetSession() {
        this.currentSession = { status: 'IDLE', startTime: null, accumulated: 0 };
        this.saveSession();
    },
    hardReset() {
        this.minuteBank = 0;
        this.sessionHistory = [];
        this.resetSession();
        this.saveBank();
        this.saveHistory();
    }
};
