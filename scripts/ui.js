import { State } from './state.js';
import { Timer } from './timer.js';

export const UI = {
    elements: {
        display: document.getElementById('display'),
        badge: document.getElementById('statusBadge'),
        btnMain: document.getElementById('btnMain'),
        btnFinish: document.getElementById('btnFinish'),
        btnDiscard: document.getElementById('btnDiscard'),
        bankDisplay: document.getElementById('bankDisplay'),
        message: document.getElementById('message'),
        historyTableBody: document.querySelector('#historyTable tbody'),
        modal: document.getElementById('finishModal'),
        modalStats: document.getElementById('modalStats'),
        descContainer: document.getElementById('descContainer'),
        sessionDesc: document.getElementById('sessionDesc'),
        sessionProject: document.getElementById('sessionProject'),
        projectList: document.getElementById('projectList')
    },

    updateTimerDisplay(ms) {
        const formatted = Timer.formatMs(ms);
        this.elements.display.textContent = formatted;

        const status = State.currentSession.status;
        if (status === 'RUNNING') {
            document.title = `▶ ${formatted} - Modulime`;
        } else if (status === 'PAUSED') {
            document.title = `⏸ ${formatted} - Modulime`;
        } else {
            document.title = 'Modulime';
        }
    },

    updateControls() {
        const { status } = State.currentSession;
        const { display, badge, btnMain, btnFinish, btnDiscard } = this.elements;
        display.classList.remove('running', 'paused');

        if (status === 'IDLE') {
            btnMain.textContent = "Iniciar";
            btnMain.className = "btn btn-primary";
            btnFinish.classList.add('hidden');
            btnDiscard.classList.add('hidden');
            badge.textContent = "Listo";
        } else if (status === 'RUNNING') {
            btnMain.textContent = "Pausar";
            btnMain.className = "btn";
            btnMain.style.borderColor = "var(--warn)";
            btnMain.style.color = "var(--warn)";
            btnFinish.classList.remove('hidden');
            btnDiscard.classList.remove('hidden');
            badge.textContent = "Grabando...";
            display.classList.add('running');
        } else if (status === 'PAUSED') {
            btnMain.textContent = "Reanudar";
            btnMain.className = "btn btn-success";
            btnMain.style.borderColor = "";
            btnMain.style.color = "";
            btnFinish.classList.remove('hidden');
            btnDiscard.classList.remove('hidden');
            badge.textContent = "Pausado";
            display.classList.add('paused');
        }
    },

    updateBank() { this.elements.bankDisplay.textContent = Math.round(State.minuteBank); },
    showMessage(msg) { this.elements.message.textContent = msg; },

    renderHistory() {
        this.elements.historyTableBody.innerHTML = '';
        const validLogs = State.sessionHistory.filter(log => log.hoursBilled > 0);

        validLogs.slice(0, 10).forEach(log => {
            const dateStr = new Date(log.date).toLocaleDateString('es-AR');
            const row = document.createElement('tr');
            if (!log.synced) row.classList.add('unsynced');
            row.innerHTML = `
                <td>${dateStr}</td>
                <td>${log.hoursBilled} hs</td>
                <td>${this.escapeHtml(log.desc)}</td>
                <td>${this.escapeHtml(log.project || '-')}</td>
            `;
            this.elements.historyTableBody.appendChild(row);
        });
    },

    openModal(sessionMin, potentialBank, hoursToLog, newBank) {
        this.elements.modalStats.innerHTML = `
            <div class="stats-row">
                <span>Tiempo sesión:</span>
                <strong>${sessionMin.toFixed(1)} min</strong>
            </div>
            <div class="stats-row">
                <span>Total c/ banco:</span>
                <strong>${potentialBank.toFixed(1)} min</strong>
            </div>
            ${hoursToLog > 0
                ? `<div class="stats-row highlight">
                    <span>A registrar:</span>
                    <span>${hoursToLog} hs</span>
                   </div>`
                : `<div class="stats-row" style="color: var(--muted); font-size: 0.9rem; text-align: center; margin-top: 10px;">
                    No se alcanza 1 hora entera. El tiempo irá al banco.
                   </div>`
            }
            <div class="stats-row bank-info">
                <span>Nuevo banco:</span>
                <span>${newBank.toFixed(1)} min</span>
            </div>
        `;

        if (hoursToLog > 0) {
            this.elements.descContainer.classList.remove('hidden');
            this.elements.sessionDesc.value = '';

            // Poblar datalist con proyectos anteriores únicos
            const uniqueProjects = [...new Set(State.sessionHistory.map(l => l.project).filter(Boolean))];
            this.elements.projectList.innerHTML = uniqueProjects.map(p => `<option value="${this.escapeHtml(p)}">`).join('');
            this.elements.sessionProject.value = '';

        } else {
            this.elements.descContainer.classList.add('hidden');
            this.elements.sessionDesc.value = 'Guardado en banco (Automático)';
            this.elements.sessionProject.value = 'N/A';
        }

        this.elements.modal.classList.remove('hidden');
    },

    closeModal() { this.elements.modal.classList.add('hidden'); },
    escapeHtml(str) {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    },

    showAlert(msg) {
        return new Promise(resolve => {
            document.getElementById('dialogMessage').textContent = msg;
            const okBtn = document.getElementById('btnDialogOk');
            const cancelBtn = document.getElementById('btnDialogCancel');
            const dialog = document.getElementById('dialogModal');

            okBtn.textContent = 'Aceptar';
            cancelBtn.classList.add('hidden');
            dialog.classList.remove('hidden');
            okBtn.focus();

            function close() {
                dialog.classList.add('hidden');
                okBtn.removeEventListener('click', close);
                document.removeEventListener('keydown', onKey);
                resolve();
            }

            function onKey(e) {
                if (e.key === 'Escape' || e.key === 'Enter') {
                    e.preventDefault();
                    close();
                }
            }

            okBtn.addEventListener('click', close);
            dialog.addEventListener('click', (e) => {
                if (e.target === e.currentTarget) close();
            });
            document.addEventListener('keydown', onKey);
        });
    },

    showConfirm(msg) {
        return new Promise(resolve => {
            document.getElementById('dialogMessage').textContent = msg;
            const okBtn = document.getElementById('btnDialogOk');
            const cancelBtn = document.getElementById('btnDialogCancel');
            const dialog = document.getElementById('dialogModal');

            okBtn.textContent = 'Aceptar';
            okBtn.className = 'btn btn-primary';
            cancelBtn.classList.remove('hidden');
            dialog.classList.remove('hidden');
            cancelBtn.focus();

            function close(result) {
                dialog.classList.add('hidden');
                okBtn.removeEventListener('click', onOk);
                cancelBtn.removeEventListener('click', onCancel);
                document.removeEventListener('keydown', onKey);
                dialog.removeEventListener('click', onOverlay);
                resolve(result);
            }

            function onOk() { close(true); }
            function onCancel() { close(false); }
            function onOverlay(e) {
                if (e.target === e.currentTarget) close(false);
            }
            function onKey(e) {
                if (e.key === 'Escape') { e.preventDefault(); close(false); }
                if (e.key === 'Enter') { e.preventDefault(); close(true); }
            }

            okBtn.addEventListener('click', onOk);
            cancelBtn.addEventListener('click', onCancel);
            dialog.addEventListener('click', onOverlay);
            document.addEventListener('keydown', onKey);
        });
    }
};
