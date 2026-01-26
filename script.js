let startTime;
let interval;
let isRunning = false;
let minuteBank = parseFloat(localStorage.getItem('workMinuteBank')) || 0;

updateBankDisplay();

function toggleTimer() {
    const btn = document.getElementById('btnToggle');
    
    if (!isRunning) {
        startTime = new Date();
        interval = setInterval(updateDisplay, 1000);
        btn.textContent = "Detener y Procesar";
        btn.classList.add("stop");
        document.getElementById('message').textContent = "Trabajando...";
        isRunning = true;
    } else {
        clearInterval(interval);
        const endTime = new Date();
        const diffMs = endTime - startTime;
        const diffMinutes = diffMs / 1000 / 60;
        
        processSession(diffMinutes);
        
        btn.textContent = "Iniciar";
        btn.classList.remove("stop");
        document.getElementById('display').textContent = "00:00:00";
        isRunning = false;
    }
}

function updateDisplay() {
    const now = new Date();
    const diff = now - startTime;
    const h = Math.floor(diff / (1000 * 60 * 60)).toString().padStart(2, '0');
    const m = Math.floor((diff / (1000 * 60)) % 60).toString().padStart(2, '0');
    const s = Math.floor((diff / 1000) % 60).toString().padStart(2, '0');
    document.getElementById('display').textContent = `${h}:${m}:${s}`;
}

function processSession(minutesWorked) {
    minuteBank += minutesWorked;

    const hoursToLog = Math.floor(minuteBank / 60);
    
    if (hoursToLog > 0) {
        minuteBank -= (hoursToLog * 60);
    }

    localStorage.setItem('workMinuteBank', minuteBank);
    updateBankDisplay();
    
    const msg = `Sesión: ${minutesWorked.toFixed(1)} min.\n` +
                `>> REGISTRAR HOY: ${hoursToLog} HORAS.\n` +
                `>> TE DEBEN: ${minuteBank.toFixed(1)} min.`;
    
    document.getElementById('message').innerText = msg;
    alert(msg);
}

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