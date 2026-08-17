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
  /** Filled rather than stroked, for a steam cloud instead of a shockwave. */
  fill?: boolean;
  /** Vertical squash, so a cloud sits on the isometric plane instead of facing us. */
  flatten?: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  /** Colour reached as the particle dies, for Wildfire's green-to-orange bloom. */
  colorTo?: string;
  /** Half-extent in pixels. Shards are long and thin; embers are small squares. */
  size?: number;
  /** Radians. Shards are drawn as oriented slivers rather than as dots. */
  angle?: number;
  /** Multiplier on the shared downward pull. Steam floats; shards fall hard. */
  gravity?: number;
  /** How fast it fades. Steam lingers, shards snap out. */
  decay?: number;
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
  /**
   * Shatter: ice breaking. Hard, bright, and over almost immediately.
   *
   * Shards are drawn as oriented slivers thrown along their own vectors, so the burst
   * reads as something rigid failing rather than as a puff of dust.
   */
  shatterBurst(at: Coord, duration: number): Promise<void> {
    const centre = this.cam.tileCenter(at);

    for (let i = 0; i < 18; i++) {
      const angle = (i / 18) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
      const speed = 2.6 + Math.random() * 2.4;
      this.particles.push({
        x: centre.x,
        y: centre.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed * 0.55 - 0.7,
        life: 1,
        color: i % 3 === 0 ? '#ffffff' : '#7dd3fc',
        size: 2 + Math.random() * 2.2,
        angle,
        gravity: 2.2,
        decay: 0.0042,
      });
    }

    const ring: Ring = { at, radius: 0, alpha: 1, color: '#e0f2fe' };
    this.rings.push(ring);
    this.flashAlpha = 0.3;
    void tween(Math.max(1, duration * 0.25), linear, (k) => {
      this.flashAlpha = 0.3 * (1 - k);
    });

    return tween(Math.max(1, duration), easeOutQuad, (k) => {
      ring.radius = k * this.cam.tileW * 1.25;
      ring.alpha = 1 - k;
      if (k >= 1) this.rings = this.rings.filter((r) => r !== ring);
    });
  }

  /**
   * Vaporize: flash-boiled ice. Slow, soft, and it hangs about.
   *
   * No flash and no shake — the tile quietly fills instead. The cloud outlives the
   * animation beat because the fog it leaves behind is a real rule, and the visual
   * should imply something was left rather than something happened.
   */
  steamBloom(at: Coord, duration: number): Promise<void> {
    const centre = this.cam.tileCenter(at);

    for (let i = 0; i < 12; i++) {
      const angle = Math.random() * Math.PI * 2;
      this.particles.push({
        x: centre.x + (Math.random() - 0.5) * this.cam.tileW * 0.4,
        y: centre.y + (Math.random() - 0.5) * this.cam.tileH * 0.3,
        vx: Math.cos(angle) * 0.5,
        vy: -0.5 - Math.random() * 0.6,
        life: 1,
        color: i % 2 === 0 ? '#e2f4ff' : '#cbd5e1',
        size: 3 + Math.random() * 3,
        gravity: -0.25,
        decay: 0.0013,
      });
    }

    const cloud: Ring = {
      at,
      radius: this.cam.tileW * 0.2,
      alpha: 0.9,
      color: 'rgba(226,244,255,0.95)',
      fill: true,
      flatten: 0.62,
    };
    this.rings.push(cloud);

    return tween(Math.max(1, duration), easeOutQuad, (k) => {
      cloud.radius = this.cam.tileW * (0.2 + k * 0.55);
      // Holds near full opacity, then clears late, so the tile stays obscured a moment.
      cloud.alpha = k < 0.6 ? 0.9 : 0.9 * (1 - (k - 0.6) / 0.4);
      if (k >= 1) this.rings = this.rings.filter((r) => r !== cloud);
    });
  }

  /**
   * Wildfire: toxin catching light. Green becomes fire as it spreads.
   *
   * Every ember crosses from green to orange over its own lifetime rather than the
   * effect switching colour wholesale, so the two elements read as one reaction.
   */
  wildfireBloom(at: Coord, duration: number): Promise<void> {
    const centre = this.cam.tileCenter(at);

    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const speed = 1.8 + Math.random() * 2.2;
      this.particles.push({
        x: centre.x,
        y: centre.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed * 0.6 - 1.1,
        life: 1,
        color: '#4ADE80',
        colorTo: i % 3 === 0 ? '#fbbf24' : '#FF6B35',
        size: 2.4 + Math.random() * 2,
        gravity: -0.35,
        decay: 0.0026,
      });
    }

    const inner: Ring = { at, radius: 0, alpha: 1, color: '#4ADE80' };
    const outer: Ring = { at, radius: 0, alpha: 1, color: '#FF6B35' };
    this.rings.push(inner, outer);

    this.flashAlpha = 0.22;
    void tween(Math.max(1, duration * 0.3), linear, (k) => {
      this.flashAlpha = 0.22 * (1 - k);
    });

    return tween(Math.max(1, duration), easeOutQuad, (k) => {
      // The fire front runs ahead of the green one, so the bloom visibly turns as it goes.
      inner.radius = k * this.cam.tileW * 1.1;
      inner.alpha = Math.max(0, 1 - k * 1.6);
      outer.radius = k * this.cam.tileW * 1.7;
      outer.alpha = 1 - k;
      if (k >= 1) this.rings = this.rings.filter((r) => r !== inner && r !== outer);
    });
  }

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
      p.vy += dt * 0.004 * (p.gravity ?? 1);
      p.life -= dt * (p.decay ?? 0.0022);
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  draw(ctx: CanvasRenderingContext2D, canvasW: number, canvasH: number): void {
    for (const ring of this.rings) {
      const centre = this.cam.tileCenter(ring.at);
      const squash = ring.flatten ?? 0.5;
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(centre.x, centre.y, ring.radius, ring.radius * squash, 0, 0, Math.PI * 2);

      if (ring.fill) {
        // A volume rather than a shockwave: soft-edged, so steam looks like steam.
        ctx.globalAlpha = ring.alpha * 0.5;
        const grad = ctx.createRadialGradient(
          centre.x,
          centre.y,
          0,
          centre.x,
          centre.y,
          Math.max(1, ring.radius),
        );
        grad.addColorStop(0, ring.color);
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grad;
        ctx.fill();
      } else {
        ctx.globalAlpha = ring.alpha * 0.85;
        ctx.strokeStyle = ring.color;
        ctx.lineWidth = 3;
        ctx.shadowColor = ring.color;
        ctx.shadowBlur = 16;
        ctx.stroke();
      }
      ctx.restore();
    }

    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      // A particle with a `colorTo` crosses from one colour to the other as it dies,
      // which is how Wildfire reads as nature catching light rather than as two effects.
      ctx.fillStyle = p.colorTo ? mixHex(p.color, p.colorTo, 1 - Math.max(0, p.life)) : p.color;

      const half = p.size ?? 2.5;
      if (p.angle !== undefined) {
        // Oriented sliver: an ice shard should look like a shard, not like confetti.
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.fillRect(-half * 2.4, -half * 0.42, half * 4.8, half * 0.84);
      } else {
        ctx.fillRect(p.x - half, p.y - half, half * 2, half * 2);
      }
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


/** Blends two #rrggbb colours, for particles that change as they die. */
function mixHex(from: string, to: string, k: number): string {
  const parse = (hex: string): [number, number, number] => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
  if (from.length !== 7 || to.length !== 7) return from;

  const a = parse(from);
  const b = parse(to);
  const t = Math.max(0, Math.min(1, k));
  const mix = a.map((v, i) => Math.round(v + (b[i]! - v) * t));
  return `rgb(${mix[0]}, ${mix[1]}, ${mix[2]})`;
}
