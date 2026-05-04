export const State = {
    minuteBank: parseFloat((parseFloat(localStorage.getItem('workMinuteBank')) || 0).toFixed(2)),
    sessionHistory: JSON.parse(localStorage.getItem('sessionHistory')) || [],
    currentSession: JSON.parse(localStorage.getItem('currentSession')) || {
        status: 'IDLE',
        startTime: null,
        accumulated: 0
    },
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
