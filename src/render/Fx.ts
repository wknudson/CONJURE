/**
 * Screen effects: shake, detonation flashes, expanding rings, particles, and the
 * world-anchored DOM floaters (damage numbers, CRASH badges).
 */

import type { Coord, DamageType } from '../contract/ids.js';
import type { FxCamera } from './IsoCamera.js';
import { schoolOf } from './palette.js';
import { tween, easeInQuad, easeOutQuad, linear } from '../anim/tween.js';
import { getSettings } from '../app/settings.js';

/** The CSS treatments a floating number can take. One class per value, in `board.css`. */
export type FloaterKind =
  | 'damage'
  | 'heal'
  | 'armor'
  | 'fire'
  | 'frost'
  | 'shock'
  | 'impact'
  | 'decay'
  | 'toxic';

/**
 * Which treatment a damage type gets on screen.
 *
 * Written as a total `Record` rather than a lookup with a fallback, deliberately: adding a
 * member to `DamageType` should fail to compile until somebody decides how it *looks*. The
 * damage model went years with a type the player could not see — Shock was the only element
 * distinguishable at a glance, and it was distinguishable because one line special-cased it.
 *
 * Now that a body's swing carries its school, the type is information a player has to act on:
 * a Cinder Mark detonates on fire and fizzles on frost, so "what element just hit that" stops
 * being flavour and becomes the difference between a combo and a wasted card.
 *
 * The three non-elemental types share the plain red number. They have no school colour to
 * borrow and inventing one for `true` would imply an element it deliberately does not have.
 */
export const FLOATER_FOR_DTYPE: Record<DamageType, FloaterKind> = {
  fire: 'fire',
  frost: 'frost',
  shock: 'shock',
  impact: 'impact',
  decay: 'decay',
  toxic: 'toxic',
  physical: 'damage',
  spell: 'damage',
  true: 'damage',
};

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

/**
 * A shot in flight: a line that draws itself from thrower to target and fades.
 *
 * Transient by design — it exists for the length of the swing and leaves nothing behind.
 * The board already says where bodies *are*; this says, for a moment, what just crossed
 * between two of them, which is the half a still frame can never show.
 */
interface Tracer {
  from: Coord;
  to: Coord;
  color: string;
  /** Lobbed rather than flat. An arcing shot goes over things and has to look like it. */
  arcing: boolean;
  /** 1 at launch, 0 when spent. */
  life: number;
  decay: number;
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
  private tracers: Tracer[] = [];
  private rings: Ring[] = [];
  private particles: Particle[] = [];
  private flashAlpha = 0;
  private shakeMag = 0;
  private shakePhase = 0;

  constructor(
    // `FxCamera` rather than `IsoCamera`: everything below works in screen pixels and asks
    // the camera only where a tile is and how far the frame is shaken. That makes the whole
    // of this file reusable over the district's perspective camera, which is why the fight
    // out in the world has no effects layer of its own.
    private readonly cam: FxCamera,
    private readonly floaterLayer: HTMLElement,
  ) {}

  /** Exponentially decaying camera offset. Off entirely when the player has turned it off. */
  screenShake(magnitude: number, duration: number): void {
    if (!getSettings().shake) return;
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

  /** The signature mark-detonation beat: white flash, expanding ring, shrapnel. */
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

  /**
   * The moment a card's magic arrives on a tile.
   *
   * Deliberately quieter than a detonation: no white flash and no shake, because a cast is
   * the player's own act landing where they pointed, not something happening *to* them. A
   * soft ring and a handful of risers in the school's colour say "here" and get out of the
   * way of whatever the card actually does — the summon, the damage, the mark — which
   * follows with its own presentation.
   */
  castBurst(at: Coord, school: string, duration: number): Promise<void> {
    const colors = schoolOf(school as never);
    const centre = this.cam.tileCenter(at);

    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 + Math.random() * 0.5;
      this.particles.push({
        x: centre.x + Math.cos(angle) * this.cam.tileW * 0.2,
        y: centre.y + Math.sin(angle) * this.cam.tileH * 0.15,
        vx: Math.cos(angle) * 0.4,
        vy: -0.8 - Math.random() * 0.6,
        life: 1,
        color: i % 2 === 0 ? colors.main : colors.light,
        size: 1.8 + Math.random() * 1.4,
        gravity: -0.2,
        decay: 0.0024,
      });
    }

    const ring: Ring = { at, radius: 0, alpha: 1, color: colors.main };
    this.rings.push(ring);
    return tween(Math.max(1, duration), easeOutQuad, (k) => {
      ring.radius = k * this.cam.tileW * 0.9;
      ring.alpha = 1 - k;
      if (k >= 1) this.rings = this.rings.filter((r) => r !== ring);
    });
  }

  /**
   * The caster's flourish: magic leaving a body rather than arriving on a tile.
   *
   * Flattened hard onto the ground plane so it reads as a sigil under the figure instead of
   * a blast on it, and the risers drift up slowly — power drawn out of someone, not thrown
   * at them. Used over the Hero or Companion when their card is cast, and over a unit whose
   * Aura reaches its Climax, which are the same shape of moment.
   */
  sigilBurst(at: Coord, school: string, duration: number): Promise<void> {
    const colors = schoolOf(school as never);
    const centre = this.cam.tileCenter(at);

    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 + Math.random() * 0.4;
      this.particles.push({
        x: centre.x + Math.cos(angle) * this.cam.tileW * 0.28,
        y: centre.y + Math.sin(angle) * this.cam.tileH * 0.16,
        vx: Math.cos(angle) * 0.25,
        vy: -0.5 - Math.random() * 0.5,
        life: 1,
        color: i % 2 === 0 ? colors.main : colors.light,
        size: 1.6 + Math.random() * 1.2,
        gravity: -0.3,
        decay: 0.0016,
      });
    }

    const inner: Ring = { at, radius: 0, alpha: 1, color: colors.light, flatten: 0.55 };
    const outer: Ring = { at, radius: 0, alpha: 0.8, color: colors.main, flatten: 0.55 };
    this.rings.push(inner, outer);
    return tween(Math.max(1, duration), easeOutQuad, (k) => {
      inner.radius = k * this.cam.tileW * 0.5;
      inner.alpha = 1 - k;
      outer.radius = k * this.cam.tileW * 0.8;
      outer.alpha = 0.8 * (1 - k);
      if (k >= 1) this.rings = this.rings.filter((r) => r !== inner && r !== outer);
    });
  }

  /**
   * A Soul Pyre giving its body back.
   *
   * The pact blue of the pyre tiles themselves, so the flare and the ground it rises from
   * read as one thing. Soft-filled rather than stroked — a welling-up, not an explosion —
   * with embers that drift the way the revived unit is about to.
   */
  pyreFlare(at: Coord, duration: number): Promise<void> {
    const centre = this.cam.tileCenter(at);

    for (let i = 0; i < 9; i++) {
      const angle = Math.random() * Math.PI * 2;
      this.particles.push({
        x: centre.x + Math.cos(angle) * this.cam.tileW * 0.22,
        y: centre.y + Math.sin(angle) * this.cam.tileH * 0.14,
        vx: Math.cos(angle) * 0.3,
        vy: -0.9 - Math.random() * 0.8,
        life: 1,
        color: i % 3 === 0 ? '#e0f2fe' : '#7dd3fc',
        size: 1.8 + Math.random() * 1.6,
        gravity: -0.35,
        decay: 0.0018,
      });
    }

    const well: Ring = {
      at,
      radius: this.cam.tileW * 0.15,
      alpha: 0.9,
      color: 'rgba(125, 211, 252, 0.9)',
      fill: true,
      flatten: 0.55,
    };
    this.rings.push(well);
    return tween(Math.max(1, duration), easeOutQuad, (k) => {
      well.radius = this.cam.tileW * (0.15 + k * 0.5);
      well.alpha = 0.9 * (1 - k);
      if (k >= 1) this.rings = this.rings.filter((r) => r !== well);
    });
  }

  /**
   * A played card travelling from the hand to the tile it targets.
   *
   * A DOM ghost rather than a canvas sprite, because the journey starts in the HUD — DOM
   * territory — and the floater layer is the one element that spans both worlds. Driven by
   * the shared tween so a skip's `finishAll()` lands it instantly, the same contract every
   * other animation keeps.
   */
  cardFlight(fromRect: DOMRect, at: Coord, school: string, duration: number): Promise<void> {
    if (duration <= 0) return Promise.resolve();
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return Promise.resolve();
    }

    const layerRect = this.floaterLayer.getBoundingClientRect();
    const to = this.cam.tileCenter(at);
    const colors = schoolOf(school as never);

    const el = document.createElement('div');
    el.className = 'card-ghost';
    el.style.color = colors.main;
    const w = fromRect.width * 0.7;
    const h = fromRect.height * 0.7;
    el.style.width = `${w}px`;
    el.style.height = `${h}px`;
    const x0 = fromRect.left - layerRect.left + (fromRect.width - w) / 2;
    const y0 = fromRect.top - layerRect.top + (fromRect.height - h) / 2;
    el.style.left = `${x0}px`;
    el.style.top = `${y0}px`;
    this.floaterLayer.appendChild(el);

    const dx = to.x - (x0 + w / 2);
    const dy = to.y - (y0 + h / 2);
    return tween(duration, easeInQuad, (k) => {
      el.style.transform = `translate(${dx * k}px, ${dy * k}px) scale(${1 - 0.7 * k})`;
      el.style.opacity = String(1 - k * 0.85);
      if (k >= 1) el.remove();
    });
  }

  damageNumber(
    at: Coord,
    amount: number,
    kind: FloaterKind = 'damage',
  ): void {
    const centre = this.cam.tileCenter(at);
    const el = document.createElement('div');
    el.className = `floater floater--${kind}`;
    // Shock is damage too, however it is coloured — only heal and armor add.
    el.textContent = kind === 'heal' || kind === 'armor' ? `+${amount}` : `-${amount}`;
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

  /**
   * A transient label, e.g. a phase-shift or status callout.
   *
   * `dy` exists so two labels can describe one beat — the act above, what it paid below —
   * without landing on the same point, since floaters are centred on where they are put.
   */
  label(at: Coord, text: string, kind = 'note', dy = -42): void {
    const centre = this.cam.tileCenter(at);
    const el = document.createElement('div');
    el.className = `floater floater--${kind}`;
    el.textContent = text;
    el.style.left = `${centre.x}px`;
    el.style.top = `${centre.y + dy}px`;
    this.floaterLayer.appendChild(el);
    window.setTimeout(() => el.remove(), 1100);
  }

  /** Drops every shot still in the air. Used when a fight ends mid-flight. */
  clearTracers(): void {
    this.tracers = [];
  }

  clearFloaters(): void {
    this.floaterLayer.replaceChildren();
  }

  /**
   * Draws a shot crossing the board.
   *
   * Melee swings deliberately do not get one: a blade that already reached is not a
   * projectile, and a tracer between adjacent tiles is a smear rather than a shot. The
   * lunge animation is what sells those.
   */
  tracer(from: Coord, to: Coord, color: string, arcing: boolean, duration: number): void {
    this.tracers.push({
      from: { ...from },
      to: { ...to },
      color,
      arcing,
      life: 1,
      decay: 1 / Math.max(60, duration),
    });
  }

  update(dt: number): void {
    for (const tr of this.tracers) tr.life -= dt * tr.decay;
    this.tracers = this.tracers.filter((tr) => tr.life > 0);

    for (const p of this.particles) {
      p.x += p.vx * dt * 0.06;
      p.y += p.vy * dt * 0.06;
      p.vy += dt * 0.004 * (p.gravity ?? 1);
      p.life -= dt * (p.decay ?? 0.0022);
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  draw(ctx: CanvasRenderingContext2D, canvasW: number, canvasH: number): void {
    // Tracers first: a shot passes behind the blast it causes.
    for (const tr of this.tracers) {
      const a = this.cam.tileCenter(tr.from);
      const b = this.cam.tileCenter(tr.to);
      // The head runs ahead of the tail, so the line reads as travelling rather than as
      // simply appearing. Both are clamped, so the tail never overshoots the target.
      const head = Math.min(1, (1 - tr.life) * 1.8);
      const tail = Math.max(0, head - 0.45);

      const at = (k: number): { x: number; y: number } => {
        const x = a.x + (b.x - a.x) * k;
        const y = a.y + (b.y - a.y) * k;
        if (!tr.arcing) return { x, y };
        // A parabola peaking at the midpoint, scaled to the span it has to cross.
        const span = Math.hypot(b.x - a.x, b.y - a.y);
        const lift = Math.min(90, 24 + span * 0.3);
        return { x, y: y - Math.sin(k * Math.PI) * lift };
      };

      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, tr.life * 1.4));
      ctx.strokeStyle = tr.color;
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.shadowColor = tr.color;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      const steps = tr.arcing ? 12 : 1;
      for (let i = 0; i <= steps; i += 1) {
        const k = tail + ((head - tail) * i) / steps;
        const pt = at(k);
        if (i === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      }
      ctx.stroke();
      ctx.restore();
    }

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
