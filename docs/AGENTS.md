# AGENTS.md — Modulime

## Project overview

Modulime is a **single-page work-time tracker** — vanilla JS, no frameworks, no build step, no npm. It counts fractional work minutes, accumulates them in a "minute bank", and bills whole hours to a Google Sheet via a webhook. Open `index.html` directly in a browser to run it. There are **no tests, no linting, no CI**.

## File structure

```
index.html          — single HTML page (app, finish modal, dialog modal)
style.css           — all styles (CSS custom properties, native nesting)
fonts.css           — Roboto Mono @font-face (woff2 files in fonts/)
docs/
  AGENTS.md         — this file
  revision.md       — full code review with findings
scripts/
  app.js            — entry point, all event listeners, keyboard shortcuts
  state.js          — localStorage-backed state, safe read/write helpers
  timer.js          — requestAnimationFrame timer
  ui.js             — DOM reads/writes, dialogs (showAlert, showConfirm)
  data.js           — Google Sheets webhook, JSON import/export
```

## Architecture & data flow

### State (`state.js`)
All persistent state lives in `localStorage` under four keys. All reads go through `safeGet()` / `safeJSON()` / `safeFloat()` wrappers that handle corrupt data gracefully. All writes use `safeSet()` which silently ignores errors (storage full, unavailable, etc.). The app detects unavailable storage at init and works in memory-only mode with a warning.

| Key | Shape |
|---|---|
| `currentSession` | `{ status: 'IDLE'|'RUNNING'|'PAUSED', startTime: number|null, accumulated: number }` |
| `workMinuteBank` | `number` (fractional minutes, rounded to 2 decimals on every save) |
| `sessionHistory` | `Array<{ date: ISO-string, duration: number, hoursBilled: number, desc: string, project: string }>` |
| `googleWebhookURL` | `string` |

`State` is exported as a plain object. There is **no reactivity** — callers must manually update the UI after mutating state.

### Timer (`timer.js`)
Uses `requestAnimationFrame` loop calling `getLiveMs()` on every frame. The timer does **not** count ticks — it computes elapsed time as `accumulated + (Date.now() - startTime)`. This means the timer is accurate even if the tab sleeps or the browser throttles rAF.

**Important**: `Timer.stop()` clears the rAF loop but does NOT modify `State.currentSession`. The caller (app.js) must update state separately. Only `app.js` mutates `State.currentSession` — `timer.js` only reads it.

### Session lifecycle (app.js)
```
IDLE  → [Iniciar] → RUNNING
RUNNING → [Pausar] → PAUSED (accumulated += now - startTime; startTime = null)
PAUSED → [Reanudar] → RUNNING (startTime = now)
any → [Terminar] → modal → confirm → reset to IDLE
any → [Descartar] → hard reset to IDLE (time discarded)
```

On "Terminar":
1. Timer stops, total ms computed via `Timer.getLiveMs()`
2. Session minutes added to existing bank, **rounded to 2 decimals** to prevent floating point drift
3. Floor to whole hours → remainder stays in bank (also rounded)
4. If hours > 0: modal asks for description + project (datalist populated from history)
5. If hours == 0: time goes to bank only, no description needed
6. On confirm: entry pushed to `sessionHistory` (unshift, max 100), webhook fires
7. Calculations stored in `modal.dataset` (not a global variable) to survive re-renders

### UI (`ui.js`)
All DOM elements are cached once in `UI.elements` object. Methods directly manipulate DOM. `updateControls()` toggles button visibility, text, and CSS classes based on `State.currentSession.status`. Also provides `showAlert(msg)` and `showConfirm(msg)` that render styled modal dialogs (no native `alert`/`confirm`). `updateTimerDisplay()` also updates `document.title` with a running/paused prefix. `escapeHtml()` now also escapes quotes for safe attribute insertion.

### Data (`data.js`)
- `sendToSheet()` uses `fetch` with `mode: 'no-cors'` — **responses are opaque**, so success can't be confirmed. The UI message is honest about this.
- Export/Import uses a JSON format: `{ app, version, bank, history, webhook }`. Version is hardcoded `6.0`.
- File download creates a blob + temporary `<a>` element.

### Keyboard shortcuts (app.js)
- `Espacio` — Iniciar / Pausar / Reanudar (ignorado si el foco está en un input/textarea)
- `Escape` — Cerrar el modal de finalización o el diálogo genérico
- `Enter` — Confirmar en el modal de finalización o en el diálogo genérico

## Commands

There is no build step. Open `index.html` directly or serve from any static file server:

```bash
# Serve locally (Python)
python3 -m http.server 8080

# Or with any static server
npx serve .
```

## Conventions

- **Language**: All UI text, comments, and variable names are in Spanish.
- **CSS**: Uses native CSS nesting (`&` syntax). No preprocessor. Custom properties defined in `:root`. Dark Gruvbox-inspired palette. Responsive with `clamp()` for font sizing.
- **JS modules**: All JS files use ES modules (`import`/`export`) loaded natively in the browser (`<script type="module">`). No bundler.
- **Module pattern**: Each JS file exports a single object (e.g. `State`, `Timer`, `UI`, `Data`). Everything is public — no private fields.
- **Error handling**: Uses `UI.showAlert()` and `UI.showConfirm()` (styled modal dialogs) for user-facing messages. `console.error()` for debugging.
- **No comments**: The codebase intentionally avoids comments — self-documenting code only.

## Gotchas

- **State references are not reactive.** After mutating `State.currentSession`, you must call `UI.updateControls()`, `UI.updateTimerDisplay()`, etc. to reflect changes.
- **Only `app.js` mutates `State.currentSession`.** Other modules read it but never write it. `Timer.stop()` doesn't touch state at all.
- **`State.resetSession()` creates a new object** (`this.currentSession = { ... }`). Any other module holding a reference to the old session object will have a stale reference.
- **The timer is accuracy-critical.** Don't change `getLiveMs()` to count ticks — it must use wall-clock time to survive tab throttling.
- **Bank calculations are rounded to 2 decimals** at every step (potentialBank sum, modulo remainder, save) to prevent floating point drift from distorting hour counts. If you change the bank logic, keep the `Math.round(x * 100) / 100` pattern.
- **`fetch` with `mode: 'no-cors'` always "succeeds"** even on network errors. Don't rely on the `.catch()` for error detection — assume the request may or may not arrive.
- **Session history has a hard cap of 100 entries** (enforced on push, not during import).
- **LocalStorage keys are fixed strings** — changing them would break existing user data.
- **The modal form only appears for billable hours (>0).** If the bank doesn't reach 60 minutes, the session resolves silently without asking for a description.
- **Finish calculations live in `modal.dataset`**, not in a module-level variable. This prevents race conditions if the modal is opened twice.
- **`submitting` flag in app.js** prevents double-submit on the finish button. Reset it in the `btnFinish` handler.
- **`btnFinish` calls `Timer.stop()` without changing state.** This is intentional: the timer stops visually but the session is still RUNNING/PAUSED until confirmed or cancelled.
