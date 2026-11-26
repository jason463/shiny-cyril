// Mouse, keyboard, touch and gamepad, reduced to one steering vector and a few buttons.

export type Device = 'mouse' | 'keys' | 'touch' | 'pad';

export class Input {
  device: Device = 'mouse';
  private keys = new Set<string>();
  private mouse = { x: 0, y: 0, seen: false };
  private stickId: number | null = null;
  stick: { ox: number; oy: number; x: number; y: number } | null = null;
  dashBtn: { x: number; y: number; r: number } | null = null;
  private dashQueued = false;
  private pauseQueued = false;
  private padPrev: boolean[] = [];
  /** menu navigation pulses from the gamepad: -1 / +1 on each axis, plus confirm/back */
  nav = { dx: 0, dy: 0, ok: false, back: false };
  private navHeld = 0;
  /** set false while a menu is open so clicks on buttons do not flick the brush */
  playing = false;

  constructor(el: HTMLElement) {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      if (!this.playing) return;
      if (MOVE_KEYS.has(e.code)) this.device = 'keys';
      if (e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        this.dashQueued = true;
        e.preventDefault();
      }
      if (e.code === 'Escape' || e.code === 'KeyP') this.pauseQueued = true;
      if (e.code.startsWith('Arrow')) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    window.addEventListener('mousemove', (e) => {
      const r = el.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      if (Math.abs(x - this.mouse.x) + Math.abs(y - this.mouse.y) > 3) this.device = 'mouse';
      this.mouse.x = x;
      this.mouse.y = y;
      this.mouse.seen = true;
    });
    el.addEventListener('mousedown', (e) => {
      if (!this.playing) return;
      this.device = 'mouse';
      this.dashQueued = true;
      e.preventDefault();
    });
    el.addEventListener('contextmenu', (e) => e.preventDefault());

    const opts = { passive: false } as AddEventListenerOptions;
    el.addEventListener('touchstart', (e) => {
      if (!this.playing) return;
      e.preventDefault();
      this.device = 'touch';
      const r = el.getBoundingClientRect();
      for (const t of Array.from(e.changedTouches)) {
        const x = t.clientX - r.left, y = t.clientY - r.top;
        const b = this.dashBtn;
        if (b && Math.hypot(x - b.x, y - b.y) < b.r + 14) {
          this.dashQueued = true;
        } else if (this.stickId === null) {
          this.stickId = t.identifier;
          this.stick = { ox: x, oy: y, x, y };
        } else {
          this.dashQueued = true; // a second finger anywhere is a flick
        }
      }
    }, opts);
    el.addEventListener('touchmove', (e) => {
      if (!this.playing) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier !== this.stickId || !this.stick) continue;
        const s = this.stick;
        s.x = t.clientX - r.left;
        s.y = t.clientY - r.top;
        // the base follows a finger that travels far, so you never run out of room
        const dx = s.x - s.ox, dy = s.y - s.oy, d = Math.hypot(dx, dy);
        if (d > 64) {
          s.ox = s.x - (dx / d) * 64;
          s.oy = s.y - (dy / d) * 64;
        }
      }
    }, opts);
    const end = (e: TouchEvent) => {
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier === this.stickId) {
          this.stickId = null;
          this.stick = null;
        }
      }
    };
    el.addEventListener('touchend', end);
    el.addEventListener('touchcancel', end);
  }

  layout(w: number, h: number, insetR: number): void {
    this.dashBtn = this.device === 'touch' ? { x: w - 62 - insetR, y: h - 78, r: 38 } : null;
  }

  releaseAll(): void {
    this.keys.clear();
    this.stick = null;
    this.stickId = null;
    this.dashQueued = false;
    this.pauseQueued = false;
  }

  /** Steering vector, length 0..1. `px,py` is the brush on screen (for mouse steering). */
  move(px: number, py: number): { x: number; y: number } {
    this.pollPad();
    if (this.device === 'pad') {
      const m = Math.hypot(this.padX, this.padY);
      return m < 0.2 ? { x: 0, y: 0 } : { x: this.padX, y: this.padY };
    }
    if (this.device === 'touch') {
      const s = this.stick;
      if (!s) return { x: 0, y: 0 };
      const dx = s.x - s.ox, dy = s.y - s.oy, d = Math.hypot(dx, dy);
      if (d < 7) return { x: 0, y: 0 };
      const k = Math.min(1, d / 42) / d;
      return { x: dx * k, y: dy * k };
    }
    if (this.device === 'keys') {
      const k = this.keys;
      let x = 0, y = 0;
      if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1;
      if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
      if (k.has('KeyW') || k.has('ArrowUp')) y -= 1;
      if (k.has('KeyS') || k.has('ArrowDown')) y += 1;
      const m = Math.hypot(x, y) || 1;
      return { x: x / m, y: y / m };
    }
    if (!this.mouse.seen) return { x: 0, y: 0 };
    const dx = this.mouse.x - px, dy = this.mouse.y - py, d = Math.hypot(dx, dy);
    if (d < 10) return { x: 0, y: 0 };
    const k = Math.min(1, (d - 6) / 70) / d;
    return { x: dx * k, y: dy * k };
  }

  takeDash(): boolean {
    const d = this.dashQueued;
    this.dashQueued = false;
    return d;
  }

  takePause(): boolean {
    const p = this.pauseQueued;
    this.pauseQueued = false;
    return p;
  }

  private padX = 0;
  private padY = 0;

  /** Reads the first connected gamepad; also produces menu navigation pulses. */
  pollPad(dt = 0): void {
    this.nav.dx = this.nav.dy = 0;
    this.nav.ok = this.nav.back = false;
    let pad: Gamepad | null = null;
    try {
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      for (const g of pads) {
        if (g && g.connected) {
          pad = g;
          break;
        }
      }
    } catch {
      pad = null;
    }
    if (!pad) return;
    let x = pad.axes[0] ?? 0, y = pad.axes[1] ?? 0;
    const b = (i: number) => !!pad!.buttons[i]?.pressed;
    if (b(14)) x = -1;
    if (b(15)) x = 1;
    if (b(12)) y = -1;
    if (b(13)) y = 1;
    this.padX = x;
    this.padY = y;
    const m = Math.hypot(x, y);
    const now = [b(0), b(1), b(2), b(5), b(7), b(9)];
    const hit = (i: number) => now[i] && !this.padPrev[i];
    if (m > 0.35 || now.some(Boolean)) this.device = 'pad';
    if (this.playing) {
      if (hit(0) || hit(2) || hit(3) || hit(4)) this.dashQueued = true;
      if (hit(5)) this.pauseQueued = true;
    } else {
      this.navHeld -= dt;
      if (m > 0.55) {
        if (this.navHeld <= 0) {
          if (Math.abs(x) > Math.abs(y)) this.nav.dx = x > 0 ? 1 : -1;
          else this.nav.dy = y > 0 ? 1 : -1;
          this.navHeld = 0.22;
        }
      } else {
        this.navHeld = 0;
      }
      this.nav.ok = hit(0);
      this.nav.back = hit(1) || hit(5);
    }
    this.padPrev = now;
  }
}

const MOVE_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
