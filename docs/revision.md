# Revisión de Modulime

Revisión completa del proyecto: JS, CSS, HTML, UX, accesibilidad y arquitectura.

---

## 🔴 Bugs

### 1. Doble click en "Confirmar" duplica el registro

**Archivo:** `scripts/app.js:80` — handler de `btnConfirmFinish`

No hay guarda contra múltiples envíos. Si el usuario hace doble click en Confirmar, se crean dos entradas de historial, se envía el webhook dos veces, y el banco de minutos queda inconsistente (se descuenta dos veces pero solo se sumó una vez el remanente).

**Solución:** deshabilitar el botón al primer click o usar un flag `let submitting = false`.

### 2. `fonts.css` tiene paths rotos

**Archivo:** `fonts.css:7`

Usa `url('../fonts/...')` pero `fonts.css` está en la raíz del proyecto (no en un subdirectorio). Los navegadores resuelven esto relativo a la ubicación del archivo CSS, por lo que `../fonts/` apunta al directorio padre de la raíz. Debería ser `url('./fonts/...')` o `url('fonts/...')`.

Consecuencia: los fonts no se cargan, solo se ve el fallback `'Fira Code', monospace`. Es difícil notarlo porque ambas son monoespaciadas y parecidas.

### 3. `sendToSheet` con `no-cors` siempre reporta éxito

**Archivo:** `scripts/data.js:22-27`

`mode: 'no-cors'` hace que la promesa de `fetch` **nunca** falle, incluso si la red está caída o el servidor devuelve error. La respuesta es opaca (no se puede leer el status code). El usuario ve "¡Sincronizado OK!" aunque el webhook nunca haya llegado a destino.

Es cierto que Google Apps Script requiere `no-cors` y no permite leer la respuesta, pero al menos deberías advertir en la UI que "no se puede confirmar la recepción" en lugar de afirmar "¡Sincronizado OK!".

### 4. `JSON.parse` sin try/catch puede romper la app al iniciar

**Archivo:** `scripts/state.js:3-4`

```js
sessionHistory: JSON.parse(localStorage.getItem('sessionHistory')) || [],
currentSession: JSON.parse(localStorage.getItem('currentSession')) || { ... }
```

Si `localStorage` tiene datos corruptos (edición manual, sync malformada, bug previo), `JSON.parse` lanza una excepción no capturada y la app entera no arranca — se queda en blanco sin ningún mensaje.

**Solución:** envolver en try/catch con fallback al valor por defecto.

### 5. `NaN` en `accumulated` si `startTime` es null al pausar

**Archivo:** `scripts/app.js:30`

```js
State.currentSession.accumulated += (now - State.currentSession.startTime);
```

Si por algún bug `startTime` fuera `null` al llegar a esta línea (no debería por lógica de estados, pero es frágil), `now - null` es `NaN` y `accumulated` se contamina irreversiblemente. El timer mostraría `NaN:NaN:NaN`.

**Solución:** validar `startTime !== null` antes de acumular, o usar un operador de defensa.

---

## 🟠 Problemas de UX

### 6. El modal no se cierra con Escape ni click fuera

**Archivo:** `scripts/app.js` y `scripts/ui.js`

El modal de finalización solo se cierra con los botones Cancelar o Confirmar. En una app de uso diario esto genera fricción. Comportamiento esperado: tecla Escape cierra el modal (equivalente a Cancelar), y click en el overlay (fondo oscuro) también.

### 7. No hay atajos de teclado

Para una herramienta de time tracking que se usa constantemente, los atajos de teclado son críticos. Sin ellos cada acción requiere mover la mano al mouse.

Sugerencias:
- `Espacio` → Iniciar / Pausar / Reanudar
- `Escape` → Cancelar modal o Descartar sesión
- `Enter` → Confirmar en el modal

### 8. Al cancelar el modal desde estado PAUSED, el display queda congelado

**Archivo:** `scripts/app.js:73-77` — handler de `btnCancelFinish`

Cuando la sesión está PAUSED y apretás Terminar, `Timer.stop()` se ejecuta (aunque el timer ya estaba detenido). Al cancelar, solo se reanuda si `status === 'RUNNING'`. Esto es correcto — no debería arrancar a correr si estaba pausado. Pero falta refrescar el display:

```js
// Actual: solo reanuda si estaba RUNNING
if (State.currentSession.status === 'RUNNING') {
    Timer.start(ms => UI.updateTimerDisplay(ms));
}
// Debería también refrescar el display si estaba PAUSED
else {
    UI.updateTimerDisplay(Timer.getLiveMs());
}
```

### 9. El mensaje de "Descartar" no muestra cuánto tiempo se pierde

**Archivo:** `scripts/app.js:47`

```js
confirm("¿Descartar el tiempo de esta sesión?")
```

Si acumulaste 3 horas y sin querer tocás Descartar, el diálogo no te da ninguna pista de lo que estás por perder. Debería incluir el tiempo actual:

```js
confirm(`¿Descartar ${Timer.formatMs(Timer.getLiveMs())} de esta sesión?`)
```

### 10. Falta indicador de timer en el título de la pestaña

Cambiar `document.title` mientras el timer corre permite ver el tiempo sin cambiar de pestaña — extremadamente útil para una app que corre en segundo plano:

```
▶ 01:23:45 - Modulime    (corriendo)
⏸ 01:23:45 - Modulime    (pausado)
```

### 11. `alert()` y `confirm()` nativos rompen la estética

**Archivos:** `scripts/app.js`, `scripts/data.js`

Usás un diseño cuidado con paleta Gruvbox, modal propio y tipografía personalizada, pero los diálogos de error/confirmación son los grises del navegador. Reemplazarlos por un modal estilizado (o al menos adaptar el `finishModal` para usarlo como diálogo genérico) mantendría la cohesión visual.

### 12. Los botones de administración son casi invisibles

**Archivo:** `style.css:251`

```css
& .data-controls {
    opacity: 0.5;
    transition: opacity 0.2s;
    &:hover { opacity: 1; }
}
```

Los botones de "Config Sheet URL", "Backup JSON", "Restaurar JSON" y "Borrar Datos" están semitransparentes. Un usuario nuevo probablemente no los note. Sugerencia: `opacity: 0.7` base y mostrar siempre visibles.

### 13. La tabla de historial no es responsive

**Archivo:** `style.css:204-243`

En pantallas chicas (< 500px), las 4 columnas (Fecha, Horas, Descripción, Proyecto) colapsan o hacen scroll horizontal. Faltan media queries para que el historial sea legible en mobile (ej: apilar en formato lista, reducir columnas, o permitir scroll horizontal solo en la tabla).

### 14. `updateBank` redondea para abajo pero el banco usa decimales

**Archivo:** `scripts/ui.js:56`

```js
updateBank() { this.elements.bankDisplay.textContent = Math.floor(State.minuteBank); }
```

Si el banco tiene 59.8 minutos, el display muestra 59. El usuario cree que le falta 1 minuto para la hora cuando en realidad le faltan 0.2. Usá `Math.round` o mostrá un decimal.

---

## 🟡 Mejoras de código

### 15. `currentSessionCalculations` es estado global mutable

**Archivo:** `scripts/app.js:56`

```js
let currentSessionCalculations = {};
```

Se pisa en cada llamada al handler de Terminar. Si por algún bug el modal se abre dos veces (ej: doble click rápido en Terminar), los cálculos de la primera apertura se pierden y el Confirmar usa los de la segunda. Es frágil.

**Alternativa:** pasar los valores por closure al crear el handler de Confirmar, o guardarlos en el dataset del modal.

### 16. Doble `parseFloat` redundante en `minuteBank`

**Archivo:** `scripts/state.js:2`

```js
minuteBank: parseFloat((parseFloat(localStorage.getItem('workMinuteBank')) || 0).toFixed(2))
```

`toFixed(2)` devuelve string, el `parseFloat` externo lo convierte a número otra vez. Es una forma enrevesada de redondear a 2 decimales. Más simple y directo:

```js
minuteBank: Math.round((parseFloat(localStorage.getItem('workMinuteBank')) || 0) * 100) / 100
```

### 17. Sin indicadores `:focus-visible` en botones e inputs

**Archivo:** `style.css`

No hay estilos de foco visibles. Si alguien navega con teclado (Tab), no sabe dónde está el foco. Esto es un problema de accesibilidad. Agregar:

```css
.btn:focus-visible,
input:focus-visible,
textarea:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
}
```

### 18. `escapeHtml` no cubre comillas

**Archivo:** `scripts/ui.js:120`

```js
escapeHtml(str) { return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
```

Solo escapa `&`, `<`, `>`. Para valores que van dentro de atributos HTML (como `value="..."` en el datalist), también hay que escapar `"` y `'`:

```js
escapeHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
```

En el uso actual (`innerHTML` directo, no atributos) no hay riesgo, pero es frágil ante cambios futuros.

### 19. Sin favicon

**Archivo:** `index.html` — falta `<link rel="icon">` en el `<head>`. Agregar un favicon mínimo (incluso un emoji como SVG) mejora la presencia en bookmarks y pestañas.

### 20. Sin `meta theme-color`

**Archivo:** `index.html`

Agregar `<meta name="theme-color" content="#282828">` para que la barra de navegación del navegador matchee con el fondo oscuro de la app (Chrome en Android, Safari con `apple-mobile-web-app-status-bar-style`).

### 21. `localStorage` sin manejo de errores

**Archivo:** `scripts/state.js`

Si el storage está lleno, no disponible (modo incógnito restrictivo), o el usuario lo deshabilitó, `setItem` falla silenciosamente y `getItem` devuelve null. La app no informa al usuario. Debería al menos detectar si `localStorage` está disponible al iniciar y mostrar un mensaje si no lo está.

---

## 🟢 Lo que está bien

- **El patrón del timer** (`accumulated + (Date.now() - startTime)`) es correcto y sobrevive tab sleep / throttling de `requestAnimationFrame`.
- **Separación en módulos** clara y con responsabilidades bien definidas: State, Timer, UI, Data, App.
- **`font-variant-numeric: tabular-nums`** evita que los números bailen al cambiar — detalle importante en un timer.
- **`escapeHtml`** en datos de usuario antes de `innerHTML` previene XSS básico.
- **La paleta Gruvbox** está bien definida con custom properties, facilitando cambios futuros.
- **El modal de finalización** es claro y muestra el desglose: minutos de sesión → total con banco → horas a registrar → nuevo banco.
- **La app funciona sin build step ni dependencias** — abrís `index.html` y listo. ideal para una herramienta personal.
- **El historial usa `unshift` + cap de 100** — pone lo más reciente arriba y previene crecimiento indefinido.
- **Import/export JSON** permite backup y migración entre dispositivos.

---

## 📊 Resumen

| Categoría | Cantidad |
|-----------|----------|
| 🔴 Bugs | 5 |
| 🟠 UX | 9 |
| 🟡 Mejoras | 7 |
| 🟢 Aciertos | 8 |
