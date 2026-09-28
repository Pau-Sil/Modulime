# Modulime

Registrador de horas de trabajo con banco de minutos y sincronización a Google Sheets. Publicado con GitHub Pages — sin instalar nada, siempre disponible desde el navegador.

## Cómo funciona

Modulime te permite iniciar y pausar un timer mientras trabajás. Los minutos se acumulan en un **banco**: cuando juntás 60 minutos (o múltiplos), se registra una cantidad entera de horas. Los minutos sobrantes vuelven al banco para la próxima sesión.

**Ejemplo:** trabajás 1h 45min, tenías 30min en el banco → se registran 2h y quedan 15min en el banco.

Cada vez que se registran horas, se envía la información a un Google Sheet configurable para que tu jefe o cliente pueda verla.

## Uso

1. Entrá a la página (GitHub Pages) y presioná **Iniciar** (o la barra espaciadora) para arrancar el timer.
2. Trabajá normalmente. Podés pausar y reanudar cuando quieras.
3. Al terminar, presioná **Terminar** → se abre un modal con el resumen:
   - Cuántos minutos trabajaste
   - Total acumulado con el banco
   - Horas que se van a registrar
   - Nuevo saldo del banco
4. Si se registra al menos 1 hora, completá la descripción y el proyecto.
5. Confirmá y los datos se guardan localmente y se envían a Google Sheets.

### Atajos de teclado

| Tecla | Acción |
|-------|--------|
| `Espacio` | Iniciar / Pausar / Reanudar |
| `Enter` | Confirmar en el modal |
| `Escape` | Cancelar / Cerrar modal |

### Sincronización

Cada sesión que registra horas se envía automáticamente a la nube. Si la conexión falla, la entrada queda marcada como **pendiente** (borde naranja en la tabla del historial). El botón **Sync** (en la barra superior) reconcilia el historial local con la nube, reenvía las pendientes y resuelve conflictos.

### Backup y restauración

Desde el menú **Backup** podés exportar un backup JSON o restaurar desde uno anterior. El historial, la tarifa y el banco también se sincronizan con la nube, así que al cambiar de dispositivo se restauran con **Sync**.

## Setup (Google Sheets)

Guía para conectar Modulime a un Google Sheet. Es un **sheet por persona**: cada usuario tiene su propio spreadsheet con su historial, su resumen y su tarifa.

### 1. Crear el spreadsheet y las hojas

1. Entrá a [Google Sheets](https://sheets.google.com) y creá un spreadsheet nuevo.
2. Creá tres hojas (pestañas) con estos encabezados exactos:

   | Hoja | Encabezados (primera fila) | Para qué |
   |---|---|---|
   | **Registros** | `Fecha, Horas, Descripción, Proyecto, ID` | una fila por sesión |
   | **Resumen** | `Mes, Horas totales, A cobrar` | totales que ve tu jefe |
   | **Config** | `clave, valor` | estado interno (tarifa y banco) |

> Si no las creás, el webhook las crea la primera vez que recibe datos, pero conviene crearlas desde el inicio para poder publicarlas (paso 3).

### 2. Desplegar el webhook (Apps Script)

1. En el spreadsheet: **Extensiones → Apps Script**.
2. Borrá el código de ejemplo y pegá el contenido de [`docs/sheets.gs`](docs/sheets.gs).
3. Desplegá como aplicación web: **Desplegar → Nueva implementación → Aplicación web**.
   - **Ejecutar como:** Yo
   - **Quién tiene acceso:** Cualquier persona
4. Copiá la URL de la aplicación web. Esa es la **webhook URL**.

### 3. Publicar los CSV

Modulime lee los datos desde dos CSVs publicados (uno por hoja):

1. **Archivo → Compartir → Publicar en la web**.
2. En "Enlace", elegí la hoja **"Registros"** y el formato **Valores separados por comas (.csv)** → **Publicar** → copiá la URL.
3. Repetí para la hoja **"Config"** → copiá la segunda URL.

> Publicar el spreadsheet entero no sirve: devuelve una página web, no un CSV. Hay que publicar **cada hoja por separado**.

### 4. Configurar Modulime

1. Abrí Modulime (GitHub Pages o local).
2. Botón **Config Sheet URL** → pegá la webhook URL (paso 2).
3. Botón **Config CSV Registros** → pegá la URL del CSV de "Registros" (paso 3).
4. Botón **Config CSV Config** → pegá la URL del CSV de "Config" (paso 3).
5. Botón **Configurar tarifa** → ingresá tu coste por hora en USD.

### Cómo funciona después

- Al **terminar una sesión**, Modulime escribe la fila en "Registros" y actualiza "Resumen" (suma las horas del mes y calcula "A cobrar").
- Modulime relee el CSV de "Registros" para **confirmar** que la sesión llegó (puede tardar unos minutos por el retraso de publicación).
- La **tarifa** y el **banco de minutos** se guardan en "Config" y se restauran al cambiar de dispositivo.
- El **jefe** abre el spreadsheet por su link normal y ve "Registros" y "Resumen" como siempre.

## Estructura del proyecto

```
index.html          — Interfaz completa (timer, modal, diálogos)
style.css           — Estilos (CSS nativo con custom properties, paleta Gruvbox)
fonts.css           — JetBrains Mono (woff2 en fonts/)
scripts/
  app.js            — Punto de entrada, listeners, atajos de teclado
  state.js          — Estado en localStorage (lectura/escritura segura, migración)
  timer.js          — Timer por requestAnimationFrame (preciso con tab sleep)
  ui.js             — Manipulación de DOM, diálogos modales, indicador de sync
  data.js           — Webhook a Google Sheets, cola de reintento, import/export JSON
docs/
  AGENTS.md         — Guía para agentes de IA (ver AGENTS.md en la raíz)
  revision.md       — Revisión completa de bugs, UX y mejoras
  sheets.gs         — Script de Google Apps Script para el webhook
```

Tecnologías: HTML, CSS nativo con nesting, JS módulos ES. Cero dependencias, cero build step.

## Desarrollo

Para desarrollo local, serví la raíz del proyecto con cualquier servidor estático:

```bash
python3 -m http.server 8080
```

Los datos se persisten en `localStorage` bajo estas claves: `currentSession`, `workMinuteBank`, `sessionHistory`, `googleWebhookURL`. Si las cambiás, perdés los datos existentes del usuario.

Más detalles de arquitectura y convenciones en [`AGENTS.md`](AGENTS.md).
