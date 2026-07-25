# Plan de implementación: GitHub como backend de sincronización

> Documento vivo. Se actualiza a medida que definimos los detalles.  
> Al finalizar la discusión, este documento guía la implementación.  
> **Estado: completo, listo para implementar.**

---

## 1. Modelo de datos

### 1.1 `registro.csv` — sesiones individuales

Una fila por sesión registrada. Cada sesión tiene su propio `id` único.

```csv
id,fecha,horas,descripcion,proyecto
```

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | string | ID único de la sesión. Clave para merge y deduplicación. |
| `fecha` | string | Día en formato `dd/mm/aaaa`. |
| `horas` | number | Horas enteras registradas en esa sesión. |
| `descripcion` | string | Qué se hizo en esa sesión. |
| `proyecto` | string | Proyecto o `General`. |

**Ejemplo:**
```csv
id,fecha,horas,descripcion,proyecto
m4k2n9x1,25/07/2026,3,Fix bug en navbar y diseño de vista principal,Gutenflyerg
a7b3c1d4,25/07/2026,2,Refactor de módulo de autenticación,Modulime
k9p2w5r8,24/07/2026,4,Implementar endpoints de API y tests,Backend
```

### 1.2 `resumen.csv` — totales mensuales

Agrupación por mes calendario calculada desde `registro.csv`. Este es el archivo que mira tu jefe.

```csv
mes,horas_totales,total_a_cobrar
```

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `mes` | string | Mes y año en formato `mm/aaaa`. |
| `horas_totales` | number | Suma de horas de todas las sesiones de ese mes. |
| `total_a_cobrar` | number | `horas_totales × hourlyRate` (en USD). |

**Ejemplo (con hourlyRate = 25 USD/h):**
```csv
mes,horas_totales,total_a_cobrar
07/2026,15,375
06/2026,42,1050
05/2026,38,950
```

### 1.3 El costo por hora (`hourlyRate`)

- Lo configura el usuario en Modulime (botón "Configurar tarifa").
- Se persiste en `localStorage` bajo la clave `hourlyRate` (number, en USD).
- Se incluye en el payload del export/import JSON para backup.
- **Si `hourlyRate` es 0 al intentar registrar una sesión, se bloquea el registro** y se muestra un mensaje pidiendo configurar la tarifa. Esto evita generar un `resumen.csv` con `total_a_cobrar = 0` por error.

### 1.4 El ID como clave de merge

Cada sesión tiene un `id` único generado al crearse (`Date.now().toString(36) + random`). Este ID es la fuente de verdad para:

- **Deduplicación**: si un ID ya está en `registro.csv`, no se agrega de nuevo.
- **Merge entre dispositivos**: al importar desde GitHub, los IDs que están en remoto pero no en local se agregan con `synced: true`. Los IDs locales no remotos se marcan como pendientes y se reintentan.
- **Filas independientes**: a diferencia del modelo anterior con Sheets (donde sesiones del mismo día se fusionaban en una sola fila), ahora **cada sesión es una fila independiente con su propio ID**. Esto preserva el detalle de qué se hizo en cada bloque de trabajo y evita pérdida de información por sobrescritura.

### 1.5 Sesiones múltiples en el mismo día

**Comportamiento anterior (Sheets):** El script buscaba la fila del día, sumaba las horas y pisaba la descripción. Se perdía el detalle de cada sesión.

**Nuevo comportamiento:** Cada sesión genera una fila nueva e independiente en `registro.csv` con su propio ID, sin importar si ya existen otras sesiones en la misma fecha. No se modifica ni se precarga nada de sesiones anteriores — cada una tiene su propia descripción, proyecto y horas. El modal de finalización arranca limpio como siempre, con el datalist de proyectos usados anteriormente como única ayuda.

Las horas de todas las sesiones del mes se suman automáticamente en `resumen.csv`.

---

## 2. Flujo de sincronización

### 2.1 Al finalizar una sesión

```
1. Si hourlyRate es 0 → bloquear, pedir configuración
2. GET registro.csv  → obtener contenido y SHA actual
3. Agregar nueva fila al CSV (con id único)
4. GET resumen.csv   → obtener contenido y SHA actual
5. Recalcular resumen.csv desde registro.csv completo:
   a. Parsear todas las filas de registro.csv
   b. Agrupar por mes (mm/aaaa), sumar horas
   c. Para cada mes: total_a_cobrar = horas_totales * hourlyRate
   d. Generar nuevo resumen.csv
6. PUT ambos archivos en UN SOLO commit → mensaje: "Registro: Xhs - descripción [proyecto]"
```

**Un solo commit** que actualiza `registro.csv` y `resumen.csv` juntos. El mensaje del commit describe la sesión registrada. El resumen se menciona implícitamente (se actualiza como consecuencia).

**¿Por qué recalcular todo el resumen y no solo el mes afectado?**  
`resumen.csv` podría tener errores acumulados (bugs, ediciones manuales, sync parcial). Recalcular desde `registro.csv` completo garantiza consistencia. Con cientos de filas como máximo, el parseo es instantáneo.

### 2.2 Al importar desde GitHub (inicio o botón "Importar/Sincronizar")

```
1. GET registro.csv
2. Parsear filas
3. Por cada fila remota:
   - Si el ID no existe en historial local → agregar (synced: true)
   - Si el ID ya existe → ignorar
4. Entradas locales con synced: false que no están en remoto → reintentar envío
5. Guardar historial local
6. Reconstruir minuteBank (no se persiste en el CSV, es solo local)
```

### 2.3 Manejo de conflictos (409 Conflict)

GitHub rechaza escrituras con SHA desactualizado. Si dos dispositivos escriben simultáneamente:

1. Dispositivo A hace GET (SHA = `abc`), prepara su PUT
2. Dispositivo B hace GET (SHA = `abc`), hace PUT → éxito, SHA ahora es `def`
3. Dispositivo A intenta PUT con SHA `abc` → GitHub devuelve **409 Conflict**
4. Dispositivo A reintenta: GET (SHA = `def`), mergea su fila, PUT con SHA `def` → éxito

Modulime implementa reintento automático con un máximo de 3 intentos y backoff de 1s.

### 2.4 Confirmación real de sincronización

A diferencia del modelo anterior (`no-cors` que nunca confirmaba), ahora el PUT de GitHub devuelve un **status HTTP 200/201** con los datos del commit. Esto permite:

- Marcar una entrada como `synced: true` **solo después de recibir confirmación del PUT**.
- El indicador de borde naranja (git-diff) ahora es **confiable**: solo aparece en entradas que realmente no llegaron al repo.
- Al importar, las entradas que están en remoto se marcan `synced: true` con certeza.

---

## 3. Seguridad del token

El token de GitHub (fine-grained PAT) se almacena en `localStorage`. Esto implica:

**Riesgo:** Cualquier persona con acceso físico al navegador o capaz de ejecutar JS en la página (extensión maliciosa, XSS) podría extraer el token.

**Mitigaciones:**
- **Fine-grained PAT**: scope limitado a **un solo repositorio** y solo permiso **Contents: read/write**. No puede acceder a otros repos, issues, pull requests, ni configuraciones de la cuenta.
- **Sin exposición en UI**: el token se ingresa una vez y nunca se vuelve a mostrar. La UI solo indica "Token configurado ✓".
- **Revocación instantánea**: desde GitHub Settings → Tokens, se revoca en un click.
- **Git history como red de seguridad**: si alguien abusa del token, todos los cambios quedan registrados en git. Se puede revertir a cualquier commit anterior.

**No es un problema para el caso de uso:** Modulime es una herramienta personal. El token está en tu navegador, al igual que tus contraseñas guardadas y cookies de sesión. La superficie de ataque no es mayor que la de cualquier otra web app que usa localStorage.

**Alternativa considerada (OAuth):** Requeriría un backend para manejar el flujo OAuth de GitHub. Agrega complejidad desproporcionada para una herramienta single-user. El PAT es el estándar para este tipo de integraciones.

---

## 4. Cambios en la UI

### 4.1 Footer

Agrupado visualmente por función:

```
[GitHub: ⚙ Configurar] [⬇ Importar/Sincronizar]  |  [JSON: ⬆ Exportar] [⬇ Importar]  |  [🗑 Borrar Datos]
```

- `⚙ Configurar`: abre un mini-formulario (usuario, repo, token, tarifa horaria).
- `⬇ Importar/Sincronizar`: hace GET del CSV remoto, mergea con local, reintenta pendientes. Reemplaza al viejo "Reintentar sync".
- `⬆ Exportar / ⬇ Importar`: backup y restauración JSON local.
- `🗑 Borrar Datos`: resetea todo.

"Configurar tarifa" no tiene botón propio: va dentro del modal de Configurar GitHub.

### 4.2 Modal de configuración de GitHub

Campos:

| Campo | Ejemplo | Notas |
|-------|---------|-------|
| Usuario de GitHub | `franco` | |
| Repositorio | `horas-trabajo` | Solo el nombre, no la URL completa |
| Token | `github_pat_11A...` | Se muestra solo al ingresar. Después: `••••••••` |
| Tarifa horaria (USD/h) | `25` | Requerido para generar `resumen.csv` |

### 4.3 Indicador de sync

- Sección de stats muestra cuando GitHub está configurado: `Banco: 15 min | $25/h | Sincronizado hace 3 min`.
- Si hay pendientes: `⚠ 2 entradas sin sincronizar`.

---

## 5. Cambios en el código

### 5.1 Renombrar `scripts/data.js` → `scripts/backup.js`

`data.js` actualmente maneja dos responsabilidades: sync con webhook + export/import JSON. Al eliminar el webhook, queda solo JSON. El nuevo nombre refleja su única responsabilidad.

```js
// scripts/backup.js
export const Backup = {
    exportJson(),                     // sin cambios
    importJson(file, callback),       // sin cambios
    downloadFile(content, type, name) // sin cambios
};
```

### 5.2 Nuevo módulo: `scripts/github.js`

```js
export const GitHub = {
    isConfigured(),         // true si user, repo y token están seteados

    // Lectura
    fetchFile(path),        // GET → { content, sha }
    parseRegistro(csv),     // CSV string → array de objetos
    buildRegistroCSV(rows), // array de objetos → CSV string
    buildResumenCSV(registroRows, hourlyRate), // recalcular y generar CSV

    // Sincronización
    syncSession(entry, hourlyRate),
    // 1. GET registro.csv
    // 2. Agregar fila → PUT (commit con ambos CSVs)
    // 3. Si 409 → reintentar hasta 3 veces

    importFromGitHub(),
    // GET registro.csv → merge con historial local → reintentar pendientes
};
```

### 5.3 `scripts/state.js`

Nuevas claves. Se elimina `googleWebhookURL`.

| Clave | Tipo | Default |
|-------|------|---------|
| `githubUser` | string | `""` |
| `githubRepo` | string | `""` |
| `githubToken` | string | `""` |
| `hourlyRate` | number | `0` |

### 5.4 `scripts/app.js`

Cambios en handlers:

- `btnConfirmFinish` → validar `hourlyRate > 0`, llamar a `GitHub.syncSession()`.
- `btnImportGitHub` → llamar a `GitHub.importFromGitHub()`.
- `btnConfigGitHub` → abrir modal de configuración.
- Eliminados: `btnSyncRetry`, `btnConfigWebhook`, referencias a `Data.sendToSheet`.

### 5.5 `index.html`

- Footer reorganizado (ver 4.1).
- Modal de configuración de GitHub (ver 4.2).

---

## 6. Archivos a eliminar o archivar

| Archivo | Acción |
|---------|--------|
| `docs/sheets.gs` | Eliminar. Ya no es necesario. |
| `scripts/data.js` | Renombrar a `scripts/backup.js`. |

---

## 7. Plan de migración para el usuario

Si ya existen datos en Google Sheets:

1. Exportar la hoja "Registros" como CSV.
2. Agregar columna `id` con valores únicos (se puede hacer con cualquier herramienta; Modulime puede generar IDs al importar un CSV legacy como paso futuro).
3. Crear el repo en GitHub.
4. Generar fine-grained PAT (Settings → Developer settings → Fine-grained tokens → Contents: read/write sobre el repo).
5. Pushear `registro.csv` como primer commit manual.
6. En Modulime, abrir Configurar GitHub, ingresar los datos y la tarifa horaria.
7. Usar "Importar/Sincronizar" para traer el historial.
8. Listo. La próxima sesión genera su primer commit automático.

---

## 8. Decisiones tomadas

| Pregunta | Decisión |
|----------|----------|
| ¿Rama del repo? | `main`, fijo, no configurable. |
| ¿Formato de fecha en CSV? | `dd/mm/aaaa`. |
| ¿Recalcular resumen o incremental? | Recalcular siempre desde `registro.csv`. |
| ¿Uno o dos commits? | **Un solo commit** con ambos archivos. |
| ¿`hourlyRate` en 0? | **Bloquear** el registro hasta que se configure. |
| ¿Funciona sin GitHub? | Sí, modo solo local. |
| ¿Sesiones mismo día? | Filas independientes con IDs distintos. Sin merging ni precarga. |
| ¿Moneda de `hourlyRate`? | **USD**. |
| ¿`data.js`? | Renombrar a `backup.js`. |
