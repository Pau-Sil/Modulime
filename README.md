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

Cada sesión que registra horas intenta enviarse a Google Sheets automáticamente. Si la conexión falla, la entrada queda marcada como **pendiente** (borde naranja en la tabla del historial). Usá el botón **Reintentar sync** para reenviar todas las pendientes.

### Backup y restauración

Usá los botones del pie de página para exportar un backup JSON o restaurar desde uno anterior. El historial se guarda en el navegador — si cambiás de dispositivo, exportá e importá.

## Google Sheets

### Configuración

1. Creá un Google Sheet con una hoja llamada **Registros** (si no existe, el script la crea automáticamente).
2. Andá a **Extensiones → Apps Script** y pegá el contenido de [`docs/sheets.gs`](docs/sheets.gs).
3. Desplegalo como **aplicación web** (Deploy → New deployment → Web app):
   - **Execute as:** Me
   - **Who has access:** Anyone
4. Copiá la URL que te da y pegala en Modulime: botón **Config Sheet URL**.

Cada vez que Modulime registre horas, el script va a:
- Buscar si ya existe una fila con la fecha de hoy (en toda la planilla, no solo las últimas filas).
- Verificar que el ID de la sesión no haya sido procesado antes (evita duplicados).
- Si la fecha ya existe: suma las horas y **concatena** la descripción y proyecto (no los pisa).
- Si no: crea una fila nueva.

Las columnas son: `A = Fecha`, `B = Horas`, `C = Descripción`, `D = Proyecto`, `E = ID`.

### Limitaciones

- El envío usa `no-cors`, por lo que Modulime no puede confirmar si Google Sheets recibió los datos — las entradas enviadas se marcan como sincronizadas asumiendo que llegaron.
- Si trabajás en varias sesiones en un mismo día, las descripciones y proyectos se concatenan con saltos de línea. Si repetís exactamente la misma descripción, no se duplica.

## Estructura del proyecto

```
index.html          — Interfaz completa (timer, modal, diálogos)
style.css           — Estilos (CSS nativo con custom properties, paleta Gruvbox)
fonts.css           — Roboto Mono (woff2 en fonts/)
scripts/
  app.js            — Punto de entrada, listeners, atajos de teclado
  state.js          — Estado en localStorage (lectura/escritura segura, migración)
  timer.js          — Timer por requestAnimationFrame (preciso con tab sleep)
  ui.js             — Manipulación de DOM, diálogos modales, indicador de sync
  data.js           — Webhook a Google Sheets, cola de reintento, import/export JSON
docs/
  AGENTS.md         — Guía para agentes de IA que trabajen en el proyecto
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

Más detalles de arquitectura y convenciones en [`docs/AGENTS.md`](docs/AGENTS.md).
