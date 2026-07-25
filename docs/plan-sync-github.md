# Plan de implementación: GitHub como backend de sincronización

> Documento vivo. Se actualiza a medida que definimos los detalles.  
> Al finalizar la discusión, este documento guía la implementación.

---

## 1. Modelo de datos

### 1.1 `registro.csv` — sesiones individuales

Igual que ahora pero en CSV. Una fila por sesión registrada.

```csv
id,fecha,horas,descripcion,proyecto
```

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | string | UUID de la sesión. Clave para merge y deduplicación. |
| `fecha` | string | Día en formato `dd/mm/aaaa`. |
| `horas` | number | Horas enteras registradas en esa sesión. |
| `descripcion` | string | Qué se hizo. |
| `proyecto` | string | Proyecto o `General`. |

**Ejemplo:**
```csv
id,fecha,horas,descripcion,proyecto
m4k2n9x1,25/07/2026,3,Fix bug en navbar y diseño de vista principal,Gutenflyerg
a7b3c1d4,25/07/2026,2,Refactor de módulo de autenticación,Modulime
k9p2w5r8,24/07/2026,4,Implementar endpoints de API y tests,Backend
```

### 1.2 `resumen.csv` — totales mensuales

Agrupación por mes calendario. Este es el archivo que mira tu jefe.

```csv
mes,horas_totales,total_a_cobrar
```

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `mes` | string | Mes y año en formato `mm/aaaa`. |
| `horas_totales` | number | Suma de horas de todas las sesiones de ese mes. |
| `total_a_cobrar` | number | `horas_totales × costo_por_hora`. |

**Ejemplo (con costo hora = $1500):**
```csv
mes,horas_totales,total_a_cobrar
07/2026,15,22500
06/2026,42,63000
05/2026,38,57000
```

### 1.3 El costo por hora

- Lo configura el usuario en Modulime desde un campo nuevo (ej: en la sección de stats o un botón "Configurar tarifa").
- Se persiste en `localStorage` bajo la clave `hourlyRate` (number, valor en pesos).
- Se incluye en el payload del export/import JSON para backup.
- Valor por defecto: `0` (sin configurar). Mientras sea 0, `total_a_cobrar` queda en 0.

### 1.4 El ID como clave de merge

Cada sesión tiene un `id` único generado al crearse (`Date.now().toString(36) + random`). Este ID es la **fuente de verdad** para:

- **Deduplicación**: si un ID ya está en `registro.csv`, no se agrega de nuevo.
- **Merge entre dispositivos**: al importar desde GitHub, los IDs que están en remoto pero no en local se agregan al historial local con `synced: true`. Los IDs locales no remotos se marcan como pendientes y se reintentan.
- **Actualización de horas**: si dos sesiones comparten fecha y proyecto, el script de Sheets concatenaba. Con GitHub, simplemente son filas separadas con IDs distintos. El resumen mensual agrupa por mes sumando todas las filas.

---

## 2. Flujo de sincronización

### 2.1 Al finalizar una sesión

```
1. GET registro.csv  → obtener contenido y SHA actual
2. Agregar nueva fila al CSV
3. PUT registro.csv  → commit con SHA
4. Recalcular resumen del mes afectado:
   a. GET registro.csv (versión recién subida) → parsear todas las filas
   b. GET resumen.csv → obtener contenido y SHA
   c. Agrupar filas de registro.csv por mes, sumar horas
   d. Para cada mes, calcular total_a_cobrar = horas * hourlyRate
   e. Generar nuevo resumen.csv
   f. PUT resumen.csv → commit con SHA
```

**¿Por qué recalcular todo el resumen y no solo el mes afectado?**

Porque `resumen.csv` podría tener errores acumulados de sesiones anteriores (bugs, ediciones manuales). Recalcular desde `registro.csv` garantiza consistencia. El CSV de registro va a tener como mucho unos cientos de filas — parsearlo entero es instantáneo.

### 2.2 Commit messages automáticos

```
Registro: 3hs - Fix bug en navbar [Gutenflyerg]
```
```
Actualizar resumen mensual
```

Dos commits separados: uno para `registro.csv`, otro para `resumen.csv`. Esto mantiene el historial de git limpio y permite ver cambios por separado.

### 2.3 Al importar desde GitHub (inicio o manual)

```
1. GET registro.csv
2. Parsear filas
3. Por cada fila remota:
   - Si el ID no existe en historial local → agregar (synced: true)
   - Si el ID ya existe → ignorar
4. Entradas locales con synced: false → reintentar envío
5. Guardar historial local
6. Reconstruir minuteBank (no se persiste en el CSV, es solo local)
7. GET resumen.csv → opcional, solo para mostrar info en UI
```

### 2.4 Manejo de conflictos (409 Conflict)

Si dos dispositivos escriben al mismo tiempo:

1. Dispositivo A hace GET (SHA = `abc`), prepara su PUT
2. Dispositivo B hace GET (SHA = `abc`), hace PUT → éxito, SHA ahora es `def`
3. Dispositivo A intenta PUT con SHA `abc` → GitHub devuelve **409 Conflict**
4. Dispositivo A vuelve a hacer GET (SHA = `def`), mergea su fila, reintenta PUT

Esto es manejado automáticamente por la API de GitHub. Modulime debe implementar reintento con backoff.

---

## 3. Cambios en la UI

### 3.1 Configuración de GitHub

Reemplaza el botón "Config Sheet URL" y el campo `webhookURL`.

Nuevo modal o prompt secuencial con tres campos:

| Campo | localStorage key | Ejemplo |
|-------|-----------------|---------|
| Usuario de GitHub | `githubUser` | `franco` |
| Repositorio | `githubRepo` | `horas-trabajo` |
| Token (fine-grained PAT) | `githubToken` | `github_pat_11A...` |

El token se trata como secreto: no se muestra en la UI después de configurarlo, solo un indicador "Token configurado ✓".

### 3.2 Costo por hora

- Campo numérico accesible desde un botón "Configurar tarifa" en el footer o desde el modal de configuración de GitHub.
- Se muestra en la sección de stats cuando está configurado: `Banco: 15 min | $1500/h`.
- Afecta el cálculo de `resumen.csv`.

### 3.3 Botones del footer

```
[Configurar GitHub] [Configurar tarifa] [Importar desde GitHub] [Backup JSON] [Restaurar JSON] [Borrar Datos]
```

- "Importar desde GitHub" reemplaza a "Reintentar sync" (la importación ya incluye reconciliación de pendientes).
- "Configurar GitHub" abre un mini-formulario (usuario, repo, token).

### 3.4 Indicador de sync en la UI

Cuando hay conexión a GitHub configurada:
- Mostrar último sync: "Última sincronización: hace 5 min"
- Mostrar cantidad de entradas pendientes si las hay

---

## 4. Cambios en el código

### 4.1 Nuevo módulo: `scripts/github.js`

```js
export const GitHub = {
    // Configuración
    isConfigured(),          // true si user, repo y token están seteados

    // Lectura
    fetchCSV(path),          // GET → contenido del archivo como string
    parseRegistro(csv),      // CSV string → array de objetos
    parseResumen(csv),       // CSV string → array de objetos

    // Escritura
    pushRegistro(rows),      // GET SHA → merge → PUT con commit
    pushResumen(registroRows, hourlyRate), // recalcular → PUT con commit

    // Sincronización completa (al finalizar sesión)
    syncSession(entry, hourlyRate),  // pushRegistro + pushResumen

    // Importación (al iniciar o manual)
    importFromGitHub(),      // GET registro.csv → merge con local
};
```

### 4.2 Simplificación de `scripts/data.js`

- Eliminar `sendToSheet()`, `syncPending()`, `setupWebhook()`.
- Quedan solo `exportJson()`, `importJson()`, `downloadFile()`.
- `State.webhookURL` se reemplaza por `State.githubUser`, `State.githubRepo`, `State.githubToken`.

### 4.3 `scripts/state.js`

Nuevas claves en localStorage:

| Clave | Tipo | Default |
|-------|------|---------|
| `githubUser` | string | `""` |
| `githubRepo` | string | `""` |
| `githubToken` | string | `""` |
| `hourlyRate` | number | `0` |

Eliminar: `googleWebhookURL`.

### 4.4 `scripts/app.js`

- `btnConfirmFinish`: llamar a `GitHub.syncSession()` en lugar de `Data.sendToSheet()`.
- `btnSyncRetry` → `btnImportGitHub`: llamar a `GitHub.importFromGitHub()`.
- `btnConfigWebhook` → `btnConfigGitHub`: abrir formulario de configuración.
- Nuevo botón `btnConfigRate` para la tarifa horaria.

### 4.5 `index.html`

- Cambiar botones del footer (ver sección 3.3).
- Agregar modal o sección para configurar GitHub (usuario, repo, token).
- Agregar input para costo por hora.

---

## 5. Archivos a eliminar o archivar

| Archivo | Acción |
|---------|--------|
| `docs/sheets.gs` | Mover a `docs/archived/` o eliminar. Ya no es necesario. |
| `scripts/data.js` | Simplificar (solo export/import JSON). |

---

## 6. Plan de migración para el usuario

Si el usuario ya tiene datos en Google Sheets:

1. Exportar la hoja "Registros" como CSV desde Google Sheets.
2. Si el CSV no tiene columna `id`, agregarla. Se pueden generar IDs con cualquier herramienta (o Modulime puede generarlos al importar un CSV legacy).
3. Crear el repo en GitHub y pushear `registro.csv` como primer commit.
4. En Modulime, configurar GitHub (usuario, repo, token) y tarifa horaria.
5. Usar "Importar desde GitHub" para traer el historial a Modulime.
6. A partir de ahí, todo se sincroniza automáticamente.

---

## 7. Preguntas abiertas

- [ ] **¿Rama del repo?** ¿Siempre `main` o configurable? → `main` por defecto, no configurable por ahora.
- [ ] **¿Formato de fecha en CSV?** ¿`dd/mm/aaaa` como en el Sheet actual? → Sí.
- [ ] **¿El resumen se recalcula siempre desde `registro.csv` o se actualiza incrementalmente?** → Siempre desde `registro.csv` (consistencia > performance).
- [ ] **¿Dos commits (registro + resumen) o uno solo con ambos archivos?** → Dos commits separados para claridad en el historial.
- [ ] **¿Qué pasa si `hourlyRate` es 0?** → `total_a_cobrar` queda en 0. El resumen igual se genera.
- [ ] **¿Modulime debe poder funcionar sin GitHub configurado?** → Sí, en modo solo local (como ahora sin webhook).
