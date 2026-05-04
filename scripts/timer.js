import { State } from './state.js';

export const Timer = {
    rafId: null,
    onTick: null,

    start(tickCallback) {
        this.onTick = tickCallback;
        this.stop();
        const tick = () => {
            if (this.onTick) this.onTick(this.getLiveMs());
            this.rafId = requestAnimationFrame(tick);
        };
        this.rafId = requestAnimationFrame(tick);
    },
    stop() {
        if (this.rafId !== null) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
    },
    getLiveMs() {
        let ms = State.currentSession.accumulated;
        if (State.currentSession.status === 'RUNNING' && State.currentSession.startTime !== null) {
            ms += (Date.now() - State.currentSession.startTime);
        }
        return Math.max(0, ms);
    },
    formatMs(ms) {
        const totalSec = Math.floor(ms / 1000);
        const h = Math.floor(totalSec / 3600).toString().padStart(2, '0');
        const m = Math.floor((totalSec % 3600) / 60).toString().padStart(2, '0');
        const s = (totalSec % 60).toString().padStart(2, '0');
        return `${h}:${m}:${s}`;
    }
};
