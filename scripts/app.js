import { State } from './state.js';
import { Timer } from './timer.js';
import { UI } from './ui.js';
import { Data } from './data.js';

async function resolveConflicts(conflicts) {
    for (const conflict of conflicts) {
        const { local, remote } = conflict;
        const keepLocal = await UI.showConflict(local, remote);
        if (keepLocal) {
            Data.postEntry({
                id: local.id,
                date: Data.formatLocalDate(local.date),
                hours: local.hoursBilled,
                description: local.desc,
                project: local.project
            }, 'edit').then(() => {
                State.markEntrySynced(local.id);
                UI.renderHistory();
            });
        } else {
            local.date = remote.date;
            local.hoursBilled = remote.hours;
            local.desc = remote.description;
            local.project = remote.project;
            local.synced = true;
            local.lastSynced = Date.now();
            State.saveHistory();
            UI.renderHistory();
        }
    }
}

async function restoreConfig() {
    if (!State.configCsvURL) return;
    try {
        const config = await Data.fetchConfig();
        if (config.hourlyRate !== undefined && State.hourlyRate === 0) {
            State.saveHourlyRate(parseFloat(config.hourlyRate) || 0);
        }
        if (config.minuteBank !== undefined && State.minuteBank === 0) {
            State.minuteBank = Math.round((parseFloat(config.minuteBank) || 0) * 100) / 100;
            State.saveBank();
        }
        UI.updateBank();
    } catch (err) {
        UI.reportError("No se pudo leer el CSV de Config.", err);
    }
}

async function fullSync() {
    UI.showMessage("Sincronizando...");
    await restoreConfig();
    await Data.syncPending();
    if (State.csvURL) {
        const { conflicts } = await Data.reconcile();
        await resolveConflicts(conflicts);
    }
    UI.showMessage("Sincronización completa.");
}

function init() {
    document.documentElement.dataset.theme = State.theme;
    State.migrateHistory();
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

    if (State.csvURL) {
        Data.reconcile().then(({ conflicts }) => resolveConflicts(conflicts));
    }
    if (State.configCsvURL) {
        restoreConfig();
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

document.getElementById('btnDiscard').addEventListener('click', () => {
    const ok = confirm(`¿Descartar ${Timer.formatMs(Timer.getLiveMs())} de esta sesión?`);
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
    const potentialBank = Math.round((State.minuteBank + sessionMin) * 100) / 100;

    const hoursToLog = Math.floor(potentialBank / 60);
    const newBank = Math.round((potentialBank % 60) * 100) / 100;

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

    const entryId = State.newId();

    State.sessionHistory.unshift({
        id: entryId,
        date: new Date().toISOString(),
        duration: sessionMin,
        hoursBilled: hoursToLog,
        desc: desc,
        project: project,
        synced: false
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
        UI.showMessage(`Registraste ${hoursToLog} hs.`);
        Data.sendToSheet(hoursToLog, desc, project, entryId).then(() => {
            UI.renderHistory();
            if (State.csvURL) {
                Data.pollUntilSynced(entryId).then(synced => {
                    UI.renderHistory();
                    UI.showMessage(synced
                        ? "Sincronizado."
                        : "Pendiente de confirmación.");
                });
            }
        });
    } else {
        UI.showMessage("Guardado en banco.");
    }

    if (State.webhookURL) {
        Data.postConfig();
    }
});

function closeMenu() {
    document.getElementById('menu').classList.add('hidden');
    document.getElementById('subNube').classList.add('hidden');
    document.getElementById('subBackup').classList.add('hidden');
}

document.getElementById('btnMenu').addEventListener('click', () => {
    const menu = document.getElementById('menu');
    if (menu.classList.contains('hidden')) {
        menu.classList.remove('hidden');
    } else {
        closeMenu();
    }
});
document.getElementById('btnNube').addEventListener('click', () => {
    document.getElementById('subNube').classList.toggle('hidden');
});
document.getElementById('btnBackup').addEventListener('click', () => {
    document.getElementById('subBackup').classList.toggle('hidden');
});
document.getElementById('btnSync').addEventListener('click', () => fullSync());

document.getElementById('btnThemes').addEventListener('click', () => {
    document.getElementById('themeMenu').classList.toggle('hidden');
});
document.querySelectorAll('#themeMenu .menu-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const theme = btn.dataset.theme;
        State.saveTheme(theme);
        document.documentElement.dataset.theme = theme;
        document.getElementById('themeMenu').classList.add('hidden');
    });
});

document.addEventListener('click', (e) => {
    const menu = document.getElementById('menu');
    const btnMenu = document.getElementById('btnMenu');
    if (!menu.classList.contains('hidden') && !menu.contains(e.target) && e.target !== btnMenu) {
        closeMenu();
    }
    const themeMenu = document.getElementById('themeMenu');
    const btnThemes = document.getElementById('btnThemes');
    if (!themeMenu.classList.contains('hidden') && !themeMenu.contains(e.target) && e.target !== btnThemes) {
        themeMenu.classList.add('hidden');
    }
});
document.getElementById('btnConfigWebhook').addEventListener('click', () => Data.setupWebhook());
document.getElementById('btnConfigCsv').addEventListener('click', () => Data.setupCsvUrl());
document.getElementById('btnConfigConfigCsv').addEventListener('click', () => Data.setupConfigCsvUrl());
document.getElementById('btnConfigRate').addEventListener('click', () => Data.setupHourlyRate());
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
    const ok = confirm("¿Borrar TODO el historial y el banco local?");
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

function isCurrentMonth(iso) {
    const d = new Date(iso);
    const now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

const historyBody = document.querySelector('#historyTable tbody');

historyBody.addEventListener('keydown', (e) => {
    const cell = e.target.closest('.editable');
    if (!cell) return;
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        cell.blur();
    }
});

historyBody.addEventListener('focusout', (e) => {
    const cell = e.target.closest('.editable');
    if (!cell) return;
    const row = cell.closest('tr');
    const id = row.dataset.id;
    const value = cell.textContent.trim();
    if (value === cell.dataset.original) return;

    const entry = State.sessionHistory.find(x => x.id === id);
    if (!entry) return;

    const colIndex = cell.cellIndex;
    if (colIndex === 2) entry.desc = value;
    else if (colIndex === 3) entry.project = value;
    State.saveHistory();

    if (State.webhookURL) {
        Data.postEntry({
            id: entry.id,
            description: entry.desc,
            project: entry.project
        }, 'edit').catch(() => {});
    }
    UI.renderHistory();
    UI.showMessage("Entrada actualizada.");
});

historyBody.addEventListener('click', (e) => {
    const btn = e.target.closest('.delete-btn');
    if (!btn) return;
    const row = btn.closest('tr');
    const id = row.dataset.id;
    const entry = State.sessionHistory.find(x => x.id === id);
    if (!entry) return;

    if (!isCurrentMonth(entry.date)) {
        alert("Solo se puede borrar sesiones del mes vigente.");
        return;
    }
    if (!confirm("¿Borrar esta sesión?")) return;
    if (!confirm("Confirmación final: se borrará de acá y de la nube.")) return;

    if (State.webhookURL) {
        Data.postEntry({ id: entry.id }, 'delete').catch(() => {});
    }
    State.sessionHistory = State.sessionHistory.filter(x => x.id !== id);
    State.saveHistory();
    UI.renderHistory();
});

document.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const modal = document.querySelector('.modal:not(.hidden)');
    if (!modal) return;
    const focusable = modal.querySelectorAll('button, input, textarea, select, [contenteditable="true"]');
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
    }
});

init();
