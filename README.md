# Modulime

Registrador de horas de trabajo con banco de minutos y sincronización a Google Sheets. Abrí `index.html` en el navegador y listo — sin instalar nada.

## Cómo funciona

Modulime te permite iniciar y pausar un timer mientras trabajás. Los minutos se acumulan en un **banco**: cuando juntás 60 minutos (o múltiplos), se registra una cantidad entera de horas. Los minutos sobrantes vuelven al banco para la próxima sesión.

**Ejemplo:** trabajás 1h 45min, tenías 30min en el banco → se registran 2h y quedan 15min en el banco.

Cada vez que se registran horas, se envía la información a un Google Sheet configurable para que tu jefe o cliente pueda verla.

## Uso

1. Abrí `index.html` en tu navegador (o servilo con `python3 -m http.server 8080`).
2. Presioná **Iniciar** (o la barra espaciadora) para arrancar el timer.
3. Trabajá normalmente. Podés pausar y reanudar cuando quieras.
4. Al terminar, presioná **Terminar** → se abre un modal con el resumen:
   - Cuántos minutos trabajaste
   - Total acumulado con el banco
   - Horas que se van a registrar
   - Nuevo saldo del banco
5. Si se registra al menos 1 hora, completá la descripción y el proyecto.
6. Confirmá y los datos se guardan localmente y se envían a Google Sheets.

### Atajos de teclado

| Tecla | Acción |
|-------|--------|
| `Espacio` | Iniciar / Pausar / Reanudar |
| `Enter` | Confirmar en el modal |
| `Escape` | Cancelar / Cerrar modal |

### Backup y restauración

Usá los botones del pie de página para exportar un backup JSON o restaurar desde uno anterior. El historial se guarda en el navegador — si cambiás de dispositivo, exportá e importá.

## Google Sheets

### Configuración

1. Creá un Google Sheet con una hoja llamada **Registros**.
2. En la primera fila poné los encabezados: `Fecha | Horas | Descripción | Proyecto`.
3. Andá a **Extensiones → Apps Script** y pegá el contenido de [`docs/sheets.gs`](docs/sheets.gs).
4. Desplegalo como **aplicación web** (Deploy → New deployment → Web app):
   - **Execute as:** Me
   - **Who has access:** Anyone (o Anyone with link)
5. Copiá la URL que te da y pegala en Modulime: botón **Config Sheet URL**.

Cada vez que Modulime registre horas, el script va a:
- Buscar si ya existe una fila con la fecha de hoy.
- Si existe: suma las horas a esa fila y actualiza descripción y proyecto.
- Si no: crea una fila nueva.

Las columnas esperadas son: `A = Fecha`, `B = Horas`, `C = Descripción`, `D = Proyecto`.

### Limitaciones del script

- La búsqueda de la fecha actual solo mira las últimas 30 filas. Si la planilla tiene cientos de filas y hoy quedó muy atrás, se va a crear una fila duplicada.
- Si trabajás en varios proyectos en un mismo día, cada sesión nueva **pisa** la descripción y proyecto de la anterior (pero las horas se acumulan correctamente).
- El script asume que la hoja se llama exactamente `Registros` y que existe. Si no, falla.
- El envío usa `no-cors`, por lo que Modulime no puede confirmar si Google Sheets recibió los datos — lo informa en pantalla.

## Estructura del proyecto

```
index.html          — Interfaz completa (timer, modal, diálogos)
style.css           — Estilos (CSS nativo con custom properties, paleta Gruvbox)
fonts.css           — Roboto Mono (woff2 en fonts/)
scripts/
  app.js            — Punto de entrada, listeners, atajos de teclado
  state.js          — Estado en localStorage (lectura/escritura segura)
  timer.js          — Timer por requestAnimationFrame (preciso con tab sleep)
  ui.js             — Manipulación de DOM, diálogos modales
  data.js           — Webhook a Google Sheets, import/export JSON
docs/
  AGENTS.md         — Guía para agentes de IA que trabajen en el proyecto
  revision.md       — Revisión completa de bugs, UX y mejoras
  sheets.gs         — Script de Google Apps Script para el webhook
```

Tecnologías: HTML, CSS nativo con nesting, JS módulos ES. Cero dependencias, cero build step.

## Desarrollo

No hay tests ni linting. Abrí `index.html` directamente o servilo con cualquier servidor estático:

```bash
python3 -m http.server 8080
```

Los datos se persisten en `localStorage` bajo estas claves: `currentSession`, `workMinuteBank`, `sessionHistory`, `googleWebhookURL`. Si las cambiás, perdés los datos existentes del usuario.

Más detalles de arquitectura y convenciones en [`docs/AGENTS.md`](docs/AGENTS.md).
