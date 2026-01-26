// --- VARIABLES DE ESTADO ---
let timerInterval;
let minuteBank = parseFloat(localStorage.getItem('workMinuteBank')) || 0;

// Estado de la sesión actual (se guarda para persistencia)
let currentSession = {
    status: 'IDLE',   // IDLE, RUNNING, PAUSED
    startTime: null,  // Timestamp de inicio del segmento actual
    accumulated: 0    // Milisegundos acumulados antes de la última pausa
};

// --- INICIALIZACIÓN ---
// Recuperar sesión si se cerró el navegador abruptamente
const savedSession = JSON.parse(localStorage.getItem('currentSession'));
if (savedSession) {
    currentSession = savedSession;
    // Si estaba corriendo, el tiempo siguió pasando "en la vida real"
    // Restauramos la UI según el estado
    updateUI();
    if (currentSession.status === 'RUNNING') {
        startTicker();
    }
}

updateBankDisplay();

// --- LÓGICA DEL TEMPORIZADOR ---

function handleMainAction() {
    const btn = document.getElementById('btnMain');
    
    if (currentSession.status === 'IDLE') {
        // INICIAR
        currentSession.status = 'RUNNING';
        currentSession.startTime = Date.now();
        currentSession.accumulated = 0;
        startTicker();
    } 
    else if (currentSession.status === 'RUNNING') {
        // PAUSAR
        clearInterval(timerInterval);
        currentSession.status = 'PAUSED';
        // Sumamos lo transcurrido al acumulado y limpiamos startTime
        const now = Date.now();
        currentSession.accumulated += (now - currentSession.startTime);
        currentSession.startTime = null;
    } 
    else if (currentSession.status === 'PAUSED') {
        // REANUDAR
        currentSession.status = 'RUNNING';
        currentSession.startTime = Date.now();
        startTicker();
    }
    
    saveSession();
    updateUI();
}

function startTicker() {
    // Limpiamos intervalo previo por seguridad
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(updateTimerDisplay, 1000);
    updateTimerDisplay(); // Actualización inmediata
}

function updateTimerDisplay() {
    let totalMs = currentSession.accumulated;
    
    if (currentSession.status === 'RUNNING') {
        totalMs += (Date.now() - currentSession.startTime);
    }
    
    // Formato HH:MM:SS
    const h = Math.floor(totalMs / (1000 * 60 * 60)).toString().padStart(2, '0');
    const m = Math.floor((totalMs / (1000 * 60)) % 60).toString().padStart(2, '0');
    const s = Math.floor((totalMs / 1000) % 60).toString().padStart(2, '0');
    
    document.getElementById('display').textContent = `${h}:${m}:${s}`;
}

function finishSession() {
    // Detener reloj
    clearInterval(timerInterval);
    
    // Calcular total final
    let totalMs = currentSession.accumulated;
    if (currentSession.status === 'RUNNING') {
        totalMs += (Date.now() - currentSession.startTime);
    }
    
    const minutesWorked = totalMs / 1000 / 60;
    
    // PROCESAR BANCO
    minuteBank += minutesWorked;
    const hoursToLog = Math.floor(minuteBank / 60);
    if (hoursToLog > 0) {
        minuteBank -= (hoursToLog * 60);
    }
    
    // Guardar Banco
    localStorage.setItem('workMinuteBank', minuteBank);
    updateBankDisplay();
    
    // Feedback
    const msg = `Sesión finalizada: ${minutesWorked.toFixed(1)} min.\n` +
                `>> REGISTRAR: ${hoursToLog} HORAS.\n` +
                `>> SALDO: ${minuteBank.toFixed(1)} min.`;
    
    document.getElementById('message').innerText = msg;
    alert(msg);
    
    // Resetear sesión
    resetSessionState();
}

function discardSession() {
    if(confirm("¿Descartar el tiempo de esta sesión sin guardar?")) {
        clearInterval(timerInterval);
        resetSessionState();
        document.getElementById('message').innerText = "Sesión descartada.";
    }
}

function resetSessionState() {
    currentSession = { status: 'IDLE', startTime: null, accumulated: 0 };
    saveSession();
    updateUI();
    document.getElementById('display').textContent = "00:00:00";
}

// Persistencia del estado actual (Crash safety)
function saveSession() {
    localStorage.setItem('currentSession', JSON.stringify(currentSession));
}

// --- ACTUALIZACIÓN DE UI ---

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
        badge.style.color = "var(--muted)";
    } 
    else if (currentSession.status === 'RUNNING') {
        btnMain.textContent = "Pausar";
        btnMain.style.borderColor = "var(--warn)";
        btnMain.style.color = "var(--warn)";
        
        btnFinish.classList.remove('hidden');
        btnDiscard.classList.remove('hidden');
        badge.textContent = "Grabando...";
        badge.style.color = "var(--accent)";
    } 
    else if (currentSession.status === 'PAUSED') {
        btnMain.textContent = "Reanudar";
        btnMain.style.borderColor = "var(--success)";
        btnMain.style.color = "var(--success)";
        
        btnFinish.classList.remove('hidden');
        btnDiscard.classList.remove('hidden');
        badge.textContent = "Pausado";
        badge.style.color = "var(--warn)";
        
        // Aseguramos que el display muestre el tiempo congelado correcto
        updateTimerDisplay();
    }
}

// --- FUNCIONES AUXILIARES (Banco y JSON) ---

function updateBankDisplay() {
    document.getElementById('bankDisplay').textContent = minuteBank.toFixed(1);
}

function resetBank() {
    if(confirm("¿Estás seguro de borrar el banco acumulado?")) {
        minuteBank = 0;
        localStorage.setItem('workMinuteBank', 0);
        updateBankDisplay();
        document.getElementById('message').textContent = "Banco reseteado.";
    }
}

function exportData() {
    const data = {
        app: "modulo-time",
        timestamp: new Date().toISOString(),
        bank: minuteBank
    };
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `modulo_backup_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function triggerImport() { document.getElementById('importFile').click(); }

function importData(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (typeof data.bank === 'number') {
                minuteBank = data.bank;
                localStorage.setItem('workMinuteBank', minuteBank);
                updateBankDisplay();
                alert(`Restaurado. Saldo actual: ${minuteBank.toFixed(1)} min`);
            }
        } catch (err) { alert("Error al leer JSON."); }
    };
    reader.readAsText(file);
    input.value = ''; 
}