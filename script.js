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
                `>> REGISTRAR: ${hoursToLog} HORAS.\n` +
                `>> SALDO: ${minuteBank.toFixed(1)} min.`;
    
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

function triggerImport() {
    document.getElementById('importFile').click();
}

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
                document.getElementById('message').textContent = "Backup restaurado correctamente.";
                alert(`Restaurado. Saldo actual: ${minuteBank.toFixed(1)} min`);
            } else {
                alert("Error: El archivo JSON no tiene el formato correcto.");
            }
        } catch (err) {
            alert("Error al leer el archivo JSON.");
        }
    };
    reader.readAsText(file);
    input.value = ''; 
}