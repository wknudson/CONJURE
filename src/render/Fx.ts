/**
 * Screen effects: shake, detonation flashes, expanding rings, particles, and the
 * world-anchored DOM floaters (damage numbers, CRASH badges).
 */

import type { Coord } from '../contract/ids.js';
import type { IsoCamera } from './IsoCamera.js';
import { schoolOf } from './palette.js';
import { tween, easeOutQuad, linear } from '../anim/tween.js';

interface Ring {
  at: Coord;
  radius: number;
  alpha: number;
  color: string;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

export class Fx {
  private rings: Ring[] = [];
  private particles: Particle[] = [];
  private flashAlpha = 0;
  private shakeMag = 0;
  private shakePhase = 0;

  constructor(
    private readonly cam: IsoCamera,
    private readonly floaterLayer: HTMLElement,
  ) {}

  /** Exponentially decaying camera offset. */
  screenShake(magnitude: number, duration: number): void {
    this.shakeMag = Math.max(this.shakeMag, magnitude);
    void tween(duration, linear, (k) => {
      this.shakePhase += 0.9;
      const decay = magnitude * (1 - k);
      this.cam.shake.x = Math.sin(this.shakePhase * 3.1) * decay;
      this.cam.shake.y = Math.cos(this.shakePhase * 2.3) * decay * 0.6;
      if (k >= 1) {
        this.cam.shake.x = 0;
        this.cam.shake.y = 0;
        this.shakeMag = 0;
      }
    });
  }

  /** The signature rune-detonation beat: white flash, expanding ring, shrapnel. */
  detonation(at: Coord, school: string, duration: number): Promise<void> {
    const colors = schoolOf(school as never);
    const centre = this.cam.tileCenter(at);

    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2;
      this.particles.push({
        x: centre.x,
        y: centre.y,
        vx: Math.cos(angle) * (1.6 + Math.random() * 1.4),
        vy: Math.sin(angle) * (0.9 + Math.random() * 0.8),
        life: 1,
        color: colors.main,
      });
    }

    const ring: Ring = { at, radius: 0, alpha: 1, color: colors.main };
    this.rings.push(ring);

    this.flashAlpha = 0.25;
    void tween(Math.max(1, duration * 0.35), linear, (k) => {
      this.flashAlpha = 0.25 * (1 - k);
    });

    return tween(Math.max(1, duration), easeOutQuad, (k) => {
      ring.radius = k * this.cam.tileW * 1.7;
      ring.alpha = 1 - k;
      if (k >= 1) this.rings = this.rings.filter((r) => r !== ring);
    });
  }

  /** A floating number anchored to a board tile. */
  damageNumber(at: Coord, amount: number, kind: 'damage' | 'heal' | 'armor' = 'damage'): void {
    const centre = this.cam.tileCenter(at);
    const el = document.createElement('div');
    el.className = `floater floater--${kind}`;
    el.textContent = kind === 'damage' ? `-${amount}` : `+${amount}`;
    el.style.left = `${centre.x}px`;
    el.style.top = `${centre.y - 30}px`;
    this.floaterLayer.appendChild(el);
    window.setTimeout(() => el.remove(), 900);
  }

  /** The jagged CRASH badge shown at a collision point. */
  crashBadge(at: Coord): void {
    const centre = this.cam.tileCenter(at);
    const el = document.createElement('div');
    el.className = 'floater floater--crash';
    el.textContent = 'CRASH';
    el.style.left = `${centre.x}px`;
    el.style.top = `${centre.y - 14}px`;
    this.floaterLayer.appendChild(el);
    window.setTimeout(() => el.remove(), 800);
  }

  /** A transient label, e.g. a phase-shift or status callout. */
  label(at: Coord, text: string, kind = 'note'): void {
    const centre = this.cam.tileCenter(at);
    const el = document.createElement('div');
    el.className = `floater floater--${kind}`;
    el.textContent = text;
    el.style.left = `${centre.x}px`;
    el.style.top = `${centre.y - 42}px`;
    this.floaterLayer.appendChild(el);
    window.setTimeout(() => el.remove(), 1100);
  }

  clearFloaters(): void {
    this.floaterLayer.replaceChildren();
  }

  update(dt: number): void {
    for (const p of this.particles) {
      p.x += p.vx * dt * 0.06;
      p.y += p.vy * dt * 0.06;
      p.vy += dt * 0.004;
      p.life -= dt * 0.0022;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  draw(ctx: CanvasRenderingContext2D, canvasW: number, canvasH: number): void {
    for (const ring of this.rings) {
      const centre = this.cam.tileCenter(ring.at);
      ctx.save();
      ctx.globalAlpha = ring.alpha * 0.85;
      ctx.strokeStyle = ring.color;
      ctx.lineWidth = 3;
      ctx.shadowColor = ring.color;
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.ellipse(centre.x, centre.y, ring.radius, ring.radius * 0.5, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 2.5, p.y - 2.5, 5, 5);
      ctx.restore();
    }

    if (this.flashAlpha > 0.001) {
      ctx.save();
      ctx.globalAlpha = this.flashAlpha;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvasW, canvasH);
      ctx.restore();
    }
  }
}
