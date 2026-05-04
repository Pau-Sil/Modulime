import { State } from './state.js';
import { Timer } from './timer.js';
import { UI } from './ui.js';
import { Data } from './data.js';

function init() {
    UI.updateBank();
    UI.renderHistory();
    UI.updateControls();

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
        State.currentSession.accumulated += (now - State.currentSession.startTime);
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

document.getElementById('btnDiscard').addEventListener('click', () => {
    if (confirm("¿Descartar el tiempo de esta sesión?")) {
        Timer.stop();
        State.resetSession();
        UI.updateControls();
        UI.updateTimerDisplay(0);
        UI.showMessage("Sesión descartada.");
    }
});

let currentSessionCalculations = {};

document.getElementById('btnFinish').addEventListener('click', () => {
    Timer.stop();

    const totalMs = Timer.getLiveMs();
    const sessionMin = totalMs / 60000;
    const potentialBank = State.minuteBank + sessionMin;

    const hoursToLog = Math.floor(potentialBank / 60);
    const newBank = potentialBank % 60;

    currentSessionCalculations = { sessionMin, hoursToLog, newBank };

    UI.openModal(sessionMin, potentialBank, hoursToLog, newBank);
});

document.getElementById('btnCancelFinish').addEventListener('click', () => {
    UI.closeModal();
    if (State.currentSession.status === 'RUNNING') {
        Timer.start(ms => UI.updateTimerDisplay(ms));
    }
});

document.getElementById('btnConfirmFinish').addEventListener('click', () => {
    const { sessionMin, hoursToLog, newBank } = currentSessionCalculations;

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
    Data.importJson(e.target.files[0], (success) => {
        if (success) {
            UI.updateBank();
            UI.renderHistory();
            alert("Datos restaurados correctamente.");
        } else {
            alert("Error: Archivo inválido.");
        }
        e.target.value = '';
    });
});

document.getElementById('btnReset').addEventListener('click', () => {
    if (confirm("⚠️ ¿Borrar TODO el historial y el banco local?")) {
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
