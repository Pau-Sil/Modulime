// --- ESTADO GLOBAL ---
let timerInterval;
let minuteBank = parseFloat(localStorage.getItem('workMinuteBank')) || 0;
let sessionHistory = JSON.parse(localStorage.getItem('sessionHistory')) || [];

// Sesión actual
let currentSession = JSON.parse(localStorage.getItem('currentSession')) || {
    status: 'IDLE',   
    startTime: null,
    accumulated: 0
};

// --- INICIALIZACIÓN ---
if (currentSession.status !== 'IDLE') {
    updateUI();
    if (currentSession.status === 'RUNNING') startTicker();
}
updateBankDisplay();
renderHistory();

// --- LÓGICA DEL TIMER ---
function handleMainAction() {
    const now = Date.now();
    
    if (currentSession.status === 'IDLE') {
        currentSession.status = 'RUNNING';
        currentSession.startTime = now;
        currentSession.accumulated = 0;
        startTicker();
    } 
    else if (currentSession.status === 'RUNNING') {
        clearInterval(timerInterval);
        currentSession.status = 'PAUSED';
        currentSession.accumulated += (now - currentSession.startTime);
        currentSession.startTime = null;
    } 
    else if (currentSession.status === 'PAUSED') {
        currentSession.status = 'RUNNING';
        currentSession.startTime = now;
        startTicker();
    }
    saveSession();
    updateUI();
}

function startTicker() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(updateTimerDisplay, 1000);
    updateTimerDisplay();
}

function updateTimerDisplay() {
    let totalMs = currentSession.accumulated;
    if (currentSession.status === 'RUNNING') {
        totalMs += (Date.now() - currentSession.startTime);
    }
    document.getElementById('display').textContent = msToHMS(totalMs);
}

// --- MODAL Y CÁLCULOS ---

function openFinishModal() {
    // 1. Congelar cálculo actual
    clearInterval(timerInterval);
    let totalMs = currentSession.accumulated;
    if (currentSession.status === 'RUNNING') {
        totalMs += (Date.now() - currentSession.startTime);
    }
    
    // 2. Predecir el futuro (Simulación del Banco)
    const currentSessionMinutes = totalMs / 1000 / 60;
    const potentialTotalBank = minuteBank + currentSessionMinutes;
    const potentialHoursToLog = Math.floor(potentialTotalBank / 60);
    const potentialRemaining = potentialTotalBank - (potentialHoursToLog * 60);

    // 3. Mostrar la "Realidad Contable" en el Modal
    const infoHTML = `
        <span style="display:block; font-size: 1.5rem; color: var(--fg); margin-bottom: 5px;">
            ${msToHMS(totalMs)} <span style="font-size:0.8rem; color:var(--muted)">(Sesión)</span>
        </span>
        <span style="display:block; font-size: 0.9rem; color: var(--accent); border-top: 1px solid #444; padding-top: 5px;">
            + Banco: ${minuteBank.toFixed(1)} min
            <br>
            = Total Acumulado: ${potentialTotalBank.toFixed(1)} min
        </span>
        <span style="display:block; font-size: 1.1rem; color: var(--success); font-weight: bold; margin-top: 10px;">
            >> SE REGISTRARÁN: ${potentialHoursToLog} HORAS
        </span>
    `;
    
    document.getElementById('modalTime').innerHTML = infoHTML;
    
    // 4. Lógica de descripción
    const today = new Date().toLocaleDateString();
    const existingLogIndex = sessionHistory.findIndex(log => new Date(log.date).toLocaleDateString() === today);
    const textarea = document.getElementById('sessionDesc');
    const label = document.getElementById('descLabel');
    
    if (existingLogIndex !== -1) {
        label.textContent = "Editando descripción de hoy:";
        label.style.color = "var(--warn)";
        textarea.value = sessionHistory[existingLogIndex].desc;
    } else {
        label.textContent = "¿Qué hiciste hoy?";
        label.style.color = "var(--fg)";
        textarea.value = "";
    }
    
    document.getElementById('finishModal').classList.remove('hidden');
}

function closeFinishModal() {
    document.getElementById('finishModal').classList.add('hidden');
    if (currentSession.status === 'RUNNING') startTicker();
}

function confirmFinish() {
    const description = document.getElementById('sessionDesc').value.trim() || "Sin descripción";
    
    // Cálculo Final Real
    let totalMs = currentSession.accumulated;
    if (currentSession.status === 'RUNNING') {
        totalMs += (Date.now() - currentSession.startTime);
    }
    const minutesWorked = totalMs / 1000 / 60;
    
    // Procesar Banco
    minuteBank += minutesWorked;
    const hoursToLog = Math.floor(minuteBank / 60);
    if (hoursToLog > 0) {
        minuteBank -= (hoursToLog * 60);
    }
    
    // Historial Local
    const today = new Date().toLocaleDateString();
    const existingLogIndex = sessionHistory.findIndex(log => new Date(log.date).toLocaleDateString() === today);

    if (existingLogIndex !== -1) {
        sessionHistory[existingLogIndex].duration += minutesWorked;
        sessionHistory[existingLogIndex].hoursBilled += hoursToLog; 
        sessionHistory[existingLogIndex].desc = description; 
        
        const updatedLog = sessionHistory.splice(existingLogIndex, 1)[0];
        sessionHistory.unshift(updatedLog);
    } else {
        sessionHistory.unshift({
            date: new Date().toISOString(),
            duration: minutesWorked,
            hoursBilled: hoursToLog,
            desc: description
        });
    }
    
    if (sessionHistory.length > 50) sessionHistory.pop();
    
    localStorage.setItem('sessionHistory', JSON.stringify(sessionHistory));
    localStorage.setItem('workMinuteBank', minuteBank);
    
    resetSessionState();
    closeFinishModal();
    updateBankDisplay();
    renderHistory();
    
    const feedbackMsg = hoursToLog > 0 
        ? `¡Registrado! ${hoursToLog} hrs enviadas.` 
        : `Guardado en banco. Saldo: ${minuteBank.toFixed(0)} min`;
        
    document.getElementById('message').textContent = feedbackMsg;

    // Sincronización
    if (webhookURL && (hoursToLog > 0 || existingLogIndex !== -1)) {
        sendToSheet(hoursToLog, description);
    } else if (hoursToLog > 0 && !webhookURL) {
        alert(`IMPORTANTE: No tienes Sheet configurada.\nAnota manualmente: ${hoursToLog} HORAS.`);
    }
}

// --- UTILS ---

function discardSession() {
    if(confirm("¿Descartar sesión?")) {
        clearInterval(timerInterval);
        resetSessionState();
        document.getElementById('message').innerText = "Descartado.";
    }
}

function resetSessionState() {
    currentSession = { status: 'IDLE', startTime: null, accumulated: 0 };
    saveSession();
    updateUI();
    document.getElementById('display').textContent = "00:00:00";
}

function saveSession() {
    localStorage.setItem('currentSession', JSON.stringify(currentSession));
}

function msToHMS(ms) {
    const h = Math.floor(ms / (1000 * 60 * 60)).toString().padStart(2, '0');
    const m = Math.floor((ms / (1000 * 60)) % 60).toString().padStart(2, '0');
    const s = Math.floor((ms / 1000) % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
}

function updateUI() {
    const btnMain = document.getElementById('btnMain');
    const btnFinish = document.getElementById('btnFinish');
    const btnDiscard = document.getElementById('btnDiscard');
    const badge = document.getElementById('statusBadge');
    
    if (currentSession.status === 'IDLE') {
        btnMain.textContent = "Iniciar";
        btnMain.style.borderColor = "var(--accent)";
        btnMain.style.color = "var(--accent)";
        btnFinish.classList.add('hidden');
        btnDiscard.classList.add('hidden');
        badge.textContent = "Listo";
    } else if (currentSession.status === 'RUNNING') {
        btnMain.textContent = "Pausar";
        btnMain.style.borderColor = "var(--warn)";
        btnMain.style.color = "var(--warn)";
        btnFinish.classList.remove('hidden');
        btnDiscard.classList.remove('hidden');
        badge.textContent = "Grabando...";
    } else if (currentSession.status === 'PAUSED') {
        btnMain.textContent = "Reanudar";
        btnMain.style.borderColor = "var(--success)";
        btnMain.style.color = "var(--success)";
        btnFinish.classList.remove('hidden');
        btnDiscard.classList.remove('hidden');
        badge.textContent = "Pausado";
        updateTimerDisplay();
    }
}

function renderHistory() {
    const tbody = document.querySelector('#historyTable tbody');
    tbody.innerHTML = '';
    
    sessionHistory.slice(0, 10).forEach(log => {
        const date = new Date(log.date);
        const row = document.createElement('tr');
        
        let displayTime;
        let styleClass = '';

        if (log.hoursBilled > 0) {
            displayTime = `${log.hoursBilled} hs`;
            styleClass = 'color: var(--success); font-weight: bold; font-size: 1.1em;';
        } else {
            displayTime = `${log.duration.toFixed(1)} m`;
            styleClass = 'color: var(--muted);';
        }

        row.innerHTML = `
            <td>${date.toLocaleDateString()}</td>
            <td style="${styleClass}">${displayTime}</td>
            <td>${log.desc}</td>
        `;
        tbody.appendChild(row);
    });
}

function updateBankDisplay() {
    document.getElementById('bankDisplay').textContent = minuteBank.toFixed(1);
}

// Backup 
function exportData() {
    const data = { app: "modulime", version: 2, bank: minuteBank, history: sessionHistory, webhook: webhookURL };
    const blob = new Blob([JSON.stringify(data)], {type: "application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `modulime_bkp_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
}
function triggerImport() { document.getElementById('importFile').click(); }

function importData(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        try {
            const data = JSON.parse(e.target.result);
            if (typeof data.bank === 'number') {
                minuteBank = data.bank;
                sessionHistory = data.history || [];
                if (data.webhook) { webhookURL = data.webhook; localStorage.setItem('googleWebhookURL', webhookURL); }
                localStorage.setItem('workMinuteBank', minuteBank);
                localStorage.setItem('sessionHistory', JSON.stringify(sessionHistory));
                updateBankDisplay(); renderHistory();
                alert("Restaurado.");
            }
        } catch (err) { alert("Error JSON"); }
    };
    reader.readAsText(file);
    input.value = ''; 
}

function hardReset() {
    // 1. Confirmación inicial
    const confirm1 = confirm("⚠️ ¿ESTÁS SEGURO?\n\nEsto borrará todo el historial local y el banco de minutos.\nLa configuración de Google Sheets NO se borrará.");
    if (!confirm1) return;

    // 2. Segunda confirmación de seguridad
    const confirm2 = confirm("¿De verdad? Esta acción no se puede deshacer (a menos que tengas un backup json).");
    if (!confirm2) return;

    // 3. Resetear variables en memoria
    minuteBank = 0;
    sessionHistory = [];
    currentSession = { status: 'IDLE', startTime: null, accumulated: 0 };
    
    // 4. Resetear LocalStorage (Manual para no borrar la URL)
    localStorage.setItem('workMinuteBank', 0);
    localStorage.setItem('sessionHistory', JSON.stringify([]));
    localStorage.setItem('currentSession', JSON.stringify(currentSession));
    
    // 5. Detener reloj si estaba corriendo
    if (timerInterval) clearInterval(timerInterval);
    
    // 6. Actualizar UI
    document.getElementById('display').textContent = "00:00:00";
    document.getElementById('message').textContent = "Sistema reiniciado.";
    updateUI();
    updateBankDisplay();
    renderHistory();
    
    alert("Datos borrados. Tu conexión con Google Sheets sigue activa.");
}