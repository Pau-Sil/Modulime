function safeJSON(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch {
        return fallback;
    }
}

function safeFloat(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
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
    webhookURL: localStorage.getItem('googleWebhookURL') || "",

    saveSession() { localStorage.setItem('currentSession', JSON.stringify(this.currentSession)); },
    saveBank() { localStorage.setItem('workMinuteBank', this.minuteBank); },
    saveHistory() { localStorage.setItem('sessionHistory', JSON.stringify(this.sessionHistory)); },
    saveWebhook(url) {
        this.webhookURL = url;
        localStorage.setItem('googleWebhookURL', url);
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
