import { State } from './state.js';
import { Timer } from './timer.js';
import { UI } from './ui.js';
import { Data } from './data.js';

function init() {
    UI.updateBank();
    UI.renderHistory();
    UI.updateControls();

    try {
        localStorage.setItem('__modulime_test__', '1');
        localStorage.removeItem('__modulime_test__');
    } catch {
        UI.showMessage("Atención: el almacenamiento local no está disponible. Los datos no se guardarán entre sesiones.");
    }

    if (State.currentSession.status !== 'IDLE') {
        if (State.currentSession.status === 'RUNNING') {
            Timer.start(ms => UI.updateTimerDisplay(ms));
        } else {
            UI.updateTimerDisplay(Timer.getLiveMs());
        }
    }
}

document.getElementById('btnMain').addEventListener('click', () => {
    const now = Date.now();

    if (State.currentSession.status === 'IDLE') {
        State.currentSession.status = 'RUNNING';
        State.currentSession.startTime = now;
        State.currentSession.accumulated = 0;
        Timer.start(ms => UI.updateTimerDisplay(ms));
    }
    else if (State.currentSession.status === 'RUNNING') {
        if (State.currentSession.startTime !== null) {
            State.currentSession.accumulated += (now - State.currentSession.startTime);
        }
        State.currentSession.startTime = null;
        State.currentSession.status = 'PAUSED';
        Timer.stop();
        UI.updateTimerDisplay(Timer.getLiveMs());
    }
    else if (State.currentSession.status === 'PAUSED') {
        State.currentSession.status = 'RUNNING';
        State.currentSession.startTime = now;
        Timer.start(ms => UI.updateTimerDisplay(ms));
    }

    State.saveSession();
    UI.updateControls();
});

document.getElementById('btnDiscard').addEventListener('click', async () => {
    const ok = await UI.showConfirm(`¿Descartar ${Timer.formatMs(Timer.getLiveMs())} de esta sesión?`);
    if (ok) {
        Timer.stop();
        State.resetSession();
        UI.updateControls();
        UI.updateTimerDisplay(0);
        UI.showMessage("Sesión descartada.");
    }
});

let submitting = false;

document.getElementById('btnFinish').addEventListener('click', () => {
    submitting = false;
    Timer.stop();

    const totalMs = Timer.getLiveMs();
    const sessionMin = totalMs / 60000;
    const potentialBank = State.minuteBank + sessionMin;

    const hoursToLog = Math.floor(potentialBank / 60);
    const newBank = potentialBank % 60;

    const modal = document.getElementById('finishModal');
    modal.dataset.sessionMin = sessionMin;
    modal.dataset.hoursToLog = hoursToLog;
    modal.dataset.newBank = newBank;

    UI.openModal(sessionMin, potentialBank, hoursToLog, newBank);
});

document.getElementById('btnCancelFinish').addEventListener('click', () => cancelFinish());

document.getElementById('finishModal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) cancelFinish();
});

document.addEventListener('keydown', (e) => {
    const modal = document.getElementById('finishModal');
    const modalOpen = !modal.classList.contains('hidden');

    if (e.key === 'Escape' && modalOpen) {
        cancelFinish();
        return;
    }

    if (e.key === 'Enter' && modalOpen && !submitting) {
        e.preventDefault();
        document.getElementById('btnConfirmFinish').click();
        return;
    }

    const tag = document.activeElement ? document.activeElement.tagName : '';
    const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

    if (e.key === ' ' && !modalOpen && !isInput) {
        e.preventDefault();
        document.getElementById('btnMain').click();
    }
});

function cancelFinish() {
    UI.closeModal();
    if (State.currentSession.status === 'RUNNING') {
        Timer.start(ms => UI.updateTimerDisplay(ms));
    } else {
        UI.updateTimerDisplay(Timer.getLiveMs());
    }
}

document.getElementById('btnConfirmFinish').addEventListener('click', () => {
    if (submitting) return;
    submitting = true;

    const modal = document.getElementById('finishModal');
    const sessionMin = parseFloat(modal.dataset.sessionMin);
    const hoursToLog = parseInt(modal.dataset.hoursToLog);
    const newBank = parseFloat(modal.dataset.newBank);

    const desc = hoursToLog > 0
        ? (document.getElementById('sessionDesc').value.trim() || 'Sin descripción')
        : 'Suma a banco';

    const project = hoursToLog > 0
        ? (document.getElementById('sessionProject').value.trim() || 'General')
        : '-';

    State.minuteBank = newBank;
    State.saveBank();

    State.sessionHistory.unshift({
        date: new Date().toISOString(),
        duration: sessionMin,
        hoursBilled: hoursToLog,
        desc: desc,
        project: project
    });

    if (State.sessionHistory.length > 100) State.sessionHistory.pop();
    State.saveHistory();

    State.resetSession();
    UI.closeModal();
    UI.updateBank();
    UI.renderHistory();
    UI.updateControls();
    UI.updateTimerDisplay(0);

    if (hoursToLog > 0) {
        UI.showMessage(`¡Éxito! Registraste ${hoursToLog} hs. Saldo en banco: ${newBank.toFixed(0)} min`);
        Data.sendToSheet(hoursToLog, desc, project);
    } else {
        UI.showMessage(`Guardado. Nuevo banco: ${newBank.toFixed(0)} min`);
    }
});

document.getElementById('btnConfigWebhook').addEventListener('click', () => Data.setupWebhook());
document.getElementById('btnExportJson').addEventListener('click', () => Data.exportJson());

document.getElementById('btnImportJson').addEventListener('click', () => {
    document.getElementById('importFile').click();
});

document.getElementById('importFile').addEventListener('change', (e) => {
    Data.importJson(e.target.files[0], async (success) => {
        if (success) {
            UI.updateBank();
            UI.renderHistory();
            await UI.showAlert("Datos restaurados correctamente.");
        } else {
            await UI.showAlert("Error: Archivo inválido.");
        }
        e.target.value = '';
    });
});

document.getElementById('btnReset').addEventListener('click', async () => {
    const ok = await UI.showConfirm("⚠️ ¿Borrar TODO el historial y el banco local?");
    if (ok) {
        Timer.stop();
        State.hardReset();
        UI.updateControls();
        UI.updateTimerDisplay(0);
        UI.updateBank();
        UI.renderHistory();
        UI.showMessage("Sistema reiniciado a cero.");
    }
});

init();
