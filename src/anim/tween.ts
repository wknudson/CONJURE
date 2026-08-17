/**
 * A tiny tween engine: one rAF loop drives every active tween.
 *
 * `finishAll()` snaps every tween to completion and resolves its promise, which is what
 * makes skip and fast-forward uniform across every animation handler.
 */

export type Easing = (k: number) => number;

export const linear: Easing = (k) => k;
export const easeOutQuad: Easing = (k) => k * (2 - k);
export const easeInQuad: Easing = (k) => k * k;
export const easeInOutQuad: Easing = (k) => (k < 0.5 ? 2 * k * k : -1 + (4 - 2 * k) * k);
export const easeOutBack: Easing = (k) => {
  const c = 1.70158;
  const t = k - 1;
  return t * t * ((c + 1) * t + c) + 1;
};

interface ActiveTween {
  elapsed: number;
  duration: number;
  ease: Easing;
  update: (k: number) => void;
  resolve: () => void;
}

const active = new Set<ActiveTween>();
let scheduled = false;
let lastTime = 0;

/**
 * Browsers stop firing rAF on a hidden tab. Without a fallback the sequencer would stall
 * mid-batch with input still locked, so a player who alt-tabs during the enemy turn
 * would come back to a frozen game. Timers keep running, so use them when hidden.
 */
function schedule(): void {
  scheduled = true;
  if (typeof document !== 'undefined' && document.hidden) {
    setTimeout(() => pump(performance.now()), 16);
  } else {
    requestAnimationFrame(pump);
  }
}

function pump(now: number): void {
  scheduled = false;
  const dt = lastTime === 0 ? 16 : Math.min(64, now - lastTime);
  lastTime = now;

  for (const t of [...active]) {
    t.elapsed += dt;
    const k = t.duration <= 0 ? 1 : Math.min(1, t.elapsed / t.duration);
    t.update(t.ease(k));
    if (k >= 1) {
      active.delete(t);
      t.resolve();
    }
  }

  if (active.size > 0) schedule();
  else lastTime = 0;
}

export function tween(duration: number, ease: Easing, update: (k: number) => void): Promise<void> {
  // A zero duration (skip mode) applies the final value immediately.
  if (duration <= 0) {
    update(1);
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    active.add({ elapsed: 0, duration, ease, update, resolve });
    if (!scheduled) {
      lastTime = 0;
      schedule();
    }
  });
}

/** Snaps every running tween to its end state. */
export function finishAll(): void {
  for (const t of [...active]) {
    t.update(1);
    active.delete(t);
    t.resolve();
  }
}

export function delay(ms: number): Promise<void> {
  return tween(ms, linear, () => {});
}
