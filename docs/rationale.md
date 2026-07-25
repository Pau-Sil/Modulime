# Racional: migración de sincronización de Google Sheets a GitHub

## Estado actual

Modulime sincroniza horas trabajadas con un Google Sheet mediante un script de Apps Script (`sheets.gs`) desplegado como webhook. El flujo es:

```
Modulime ──POST (no-cors)──→ Google Apps Script ──→ Google Sheet
```

**Problemas de este enfoque:**

1. **Setup en dos lugares distintos.** El usuario debe crear un Sheet, desplegar un script en Apps Script, y pegar la URL del webhook en Modulime. Son 4 pasos con herramientas separadas.

2. **`mode: 'no-cors'` impide confirmar la recepción.** La respuesta de fetch es opaca — Modulime asume que los datos llegaron aunque la red haya fallado. El `catch` del fetch nunca se dispara.

3. **Sincronización unidireccional.** Modulime solo escribe. No puede leer el Sheet para reconciliar el historial local con lo remoto. Cambiar de dispositivo o navegador implica perder el historial salvo que el usuario exporte/importe JSON manualmente.

4. **Requiere un script externo versionado por separado.** `sheets.gs` vive en el repositorio como documentación, pero no se despliega automáticamente. Si el script cambia, el usuario debe volver a copiarlo y redesplegarlo.

5. **El Sheet debe ser público** para que el jefe lo vea. Con el CSV público para lectura bidireccional, el Sheet quedaría expuesto a cualquiera con el link.

## Nueva propuesta: GitHub como backend

Usar la **GitHub Contents API** para leer y escribir un archivo CSV directamente en un repositorio. Sin scripts intermedios, sin `no-cors`, sin deploy.

```
Modulime ──GET/PUT──→ api.github.com/repos/:user/:repo/contents/registro.csv
                         │
                    Tu jefe ve:
                    github.com/:user/:repo/blob/main/registro.csv
                    (GitHub renderiza CSV como tabla)
```

### Setup (3 pasos, todo desde GitHub)

1. Crear un repositorio (público o privado).
2. Generar un **fine-grained personal access token** con scope `Contents: read/write` limitado a ese repositorio.
3. En Modulime: ingresar `usuario`, `repositorio` y `token`.

Nada más. Sin Apps Script, sin Sheets, sin deploy.

### Flujo de sincronización

**Al finalizar una sesión:**

```
1. GET  /repos/:user/:repo/contents/registro.csv → obtener SHA actual
2. Parsear CSV existente, mergear nueva fila
3. PUT  /repos/:user/:repo/contents/registro.csv → commit con el CSV actualizado
```

**Al iniciar Modulime (o manualmente con "Importar desde GitHub"):**

```
1. GET  /repos/:user/:repo/contents/registro.csv
2. Parsear CSV, comparar IDs con historial local
3. Merge: entradas remotas no locales → agregar (synced: true)
          entradas locales no remotas → marcar como pending o reintentar
```

**Commit message automático:** `"Registro: 3hs - Fix bug en navbar [Gutenflyerg]"`

### Formato del CSV

```
id,fecha,horas,descripcion,proyecto
m4k2n9x1,25/07/2026,3,Fix bug en navbar y diseño de vista principal,Gutenflyerg
a7b3c1d4,25/07/2026,2,Refactor de módulo de autenticación,Modulime
```

- Sin encabezados complejos. GitHub lo renderiza prolijo.
- La columna `id` es opaca para el jefe pero crítica para Modulime (merge, deduplicación).
- El CSV no incluye `synced` — todas las entradas remotas se asumen sincronizadas.

### Ventajas

| | Google Sheets actual | GitHub |
|---|---|---|
| Setup | 4 pasos (Sheet + Script + Deploy + URL) | 3 pasos (Repo + Token + Config) |
| Confirmación de envío | `no-cors`, nunca se sabe | Respuesta HTTP con status |
| Bidireccional | No, solo escribe | Nativo: GET y PUT |
| Historial de cambios | Manual | Git history automático |
| Scripts externos | `sheets.gs` desplegado aparte | Ninguno |
| Vista para el jefe | Google Sheets | CSV renderizado en GitHub |
| Merge entre dispositivos | Export/Import JSON manual | GET del CSV, merge automático |
| Formato de datos | Filas de planilla | CSV simple, legible por humanos |

### Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| **Token en localStorage.** Si alguien roba el token, puede pushear al repo. | Fine-grained PAT limitado a un solo repo, solo scope Contents. El daño es reversible (git history). |
| **Conflicto de escritura.** Dos dispositivos escriben al mismo tiempo y pisan cambios. | Obtener el SHA del archivo antes de cada PUT. GitHub rechaza escrituras con SHA desactualizado (409 Conflict). Modulime puede reintentar con el nuevo SHA. |
| **Límites de rate.** GitHub API tiene límites (5000 req/h autenticado). | Las operaciones son esporádicas (una sesión cada varias horas). No hay riesgo real. |
| **Límite de tamaño de archivo.** La API tiene límite de 1 MB por archivo. | Un CSV con 10.000 filas pesa ~500 KB. No es un límite práctico para años de uso. |

### Qué cambia en el código

| Archivo | Cambio |
|---------|--------|
| `scripts/github.js` | **Nuevo.** Reemplaza a `data.js` para la sincronización remota. Maneja GET/PUT a la API de GitHub. |
| `scripts/data.js` | Se simplifica. Solo export/import JSON local. El webhook de Sheets se elimina. |
| `scripts/state.js` | Sin cambios. El modelo de datos (id, synced, history) ya está preparado. |
| `index.html` | El botón "Config Sheet URL" cambia a "Configurar GitHub". Los campos del formulario de configuración ahora piden usuario, repo y token. |
| `docs/sheets.gs` | Se archiva o elimina. Ya no es necesario. |

### Migración desde Google Sheets

Si el usuario ya tiene datos en un Sheet y quiere migrar a GitHub:

1. Exportar el Sheet como CSV
2. Agregar una columna `id` (puede usar la fecha o generar UUIDs)
3. Pushear el CSV manualmente al repo (primer commit)
4. Modulime importa desde GitHub y todo queda sincronizado

---

## Decisión

Se propone **reemplazar** la sincronización vía Google Sheets por sincronización directa vía GitHub Contents API. Google Sheets se elimina del proyecto. El CSV es el formato de intercambio tanto para GitHub como para el jefe.
