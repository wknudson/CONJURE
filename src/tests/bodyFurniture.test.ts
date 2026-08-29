/**
 * What a body wears above itself, and the one rule in it that is not decoration.
 *
 * `drawBodyFurniture` was pulled out of `BoardRenderer` when the district's board needed the
 * same set — a fight standing on a real street had no way to show any unit's health, attack or
 * armour, which was the single largest thing standing between it and being readable. Both
 * renderers now call this, which is exactly why it is worth a test: the interesting content is
 * a *rule* about the Bound Form, and a rule that two callers depend on is a rule that should
 * fail here rather than in one presentation and not the other.
 *
 * Drawn against a recording context rather than a real canvas. Nothing here cares what the
 * pixels look like; what it cares about is which of the two mutually exclusive health displays
 * a given body gets, and that every status the game can apply has a face.
 */

import { describe, it, expect } from 'vitest';
import { drawBodyFurniture } from '../render/shapes.js';

/**
 * Enough of a 2D context to be drawn into, recording the text it was asked to write.
 *
 * `fillText` is the whole of the signal: the stat bar writes numbers, the escalation chevron
 * writes a chevron, and the status row writes glyphs — so what was written is a faithful
 * account of what the body is telling the player. The geometry calls are accepted and dropped.
 */
function recorder(): {
  ctx: CanvasRenderingContext2D;
  text: string[];
  calls: string[];
  /**
   * Every origin the context was translated to.
   *
   * The brand draws itself around a local origin — `translate` to the anchor, then a ring and a
   * glyph at zero — so its path coordinates say nothing about where it landed and the translate
   * says everything. Recording the wrong one of the two is how the first draft of the lift test
   * below passed identically for two different lifts.
   */
  origins: { x: number; y: number }[];
} {
  const text: string[] = [];
  const calls: string[] = [];
  const origins: { x: number; y: number }[] = [];
  const noop = (name: string) => (...args: unknown[]) => {
    calls.push(`${name}(${args.length})`);
    if (name === 'translate' && typeof args[0] === 'number' && typeof args[1] === 'number') {
      origins.push({ x: args[0], y: args[1] });
    }
  };
  const ctx = {
    fillText: (s: string) => void text.push(s),
    save: noop('save'),
    restore: noop('restore'),
    beginPath: noop('beginPath'),
    closePath: noop('closePath'),
    moveTo: noop('moveTo'),
    lineTo: noop('lineTo'),
    arc: noop('arc'),
    arcTo: noop('arcTo'),
    ellipse: noop('ellipse'),
    quadraticCurveTo: noop('quadraticCurveTo'),
    fill: noop('fill'),
    stroke: noop('stroke'),
    rect: noop('rect'),
    translate: noop('translate'),
    rotate: noop('rotate'),
    scale: noop('scale'),
    setLineDash: noop('setLineDash'),
    createLinearGradient: () => ({ addColorStop: () => {} }),
    createRadialGradient: () => ({ addColorStop: () => {} }),
  } as unknown as CanvasRenderingContext2D;
  return { ctx, text, calls, origins };
}

type Furniture = Parameters<typeof drawBodyFurniture>[3];

function body(over: Partial<Furniture> = {}): Furniture {
  return {
    snapshot: { side: 'player', keywords: [], footprint: 1 },
    mark: null,
    hp: 7,
    maxHp: 10,
    armor: 0,
    atk: 3,
    escalation: 0,
    statuses: [],
    ...over,
  };
}

const CENTRE = { x: 400, y: 300 };

describe('the health display, which is one of two things and never both', () => {
  it('gives an ordinary body its numbers', () => {
    const { ctx, text } = recorder();
    drawBodyFurniture(ctx, CENTRE, 1, body({ hp: 7, atk: 3 }), 0.5);
    // Attack on the left of the bar, health on the right. Both, because an ordinary unit has
    // an attack of its own to state.
    expect(text, 'the stat bar').toContain('3');
    expect(text, 'the stat bar').toContain('7');
  });

  it('gives a Bound Form a bound mark instead, and no numbers at all', () => {
    const { ctx, text } = recorder();
    drawBodyFurniture(
      ctx,
      CENTRE,
      1,
      body({ snapshot: { side: 'player', keywords: ['BoundForm'], footprint: 1 }, hp: 7 }),
      0.5,
    );
    // This is the rule worth protecting. The Bound Form's health *is* the Pact, which is on
    // the gauge above the board; a bar under the beast reads as a second, separate pool -- and
    // one that never moves, because nothing ever writes to it. The 2D board has always known
    // this and the world board now inherits it from the same function rather than from a
    // comment somebody has to remember to copy.
    expect(text, 'no health number under a Bound Form').not.toContain('7');
  });

  it('leaves the attack slot empty for something with no attack of its own', () => {
    const { ctx, text } = recorder();
    drawBodyFurniture(ctx, CENTRE, 1, body({ hp: 12, atk: 0 }), 0.5);
    expect(text, 'health').toContain('12');
    expect(text, 'and nothing else').toHaveLength(1);
  });

  it('states armour separately, because it is not health and does not spend like it', () => {
    const { ctx, text } = recorder();
    drawBodyFurniture(ctx, CENTRE, 1, body({ hp: 5, atk: 2, armor: 4 }), 0.5);
    expect(text).toEqual(expect.arrayContaining(['2', '5', '4']));
  });
});

describe('the status row', () => {
  it('draws one glyph per status', () => {
    const { ctx, text } = recorder();
    drawBodyFurniture(
      ctx,
      CENTRE,
      1,
      body({ statuses: [{ kind: 'burn', stacks: 1 }, { kind: 'chill', stacks: 1 }] }),
      0.5,
    );
    const glyphs = text.filter((t) => !/^\d+$/.test(t));
    expect(glyphs, 'two statuses, two glyphs').toHaveLength(2);
  });

  it('counts stacks only where there is more than one', () => {
    const single = recorder();
    drawBodyFurniture(single.ctx, CENTRE, 1, body({ statuses: [{ kind: 'burn', stacks: 1 }] }), 0);
    const triple = recorder();
    drawBodyFurniture(triple.ctx, CENTRE, 1, body({ statuses: [{ kind: 'burn', stacks: 3 }] }), 0);

    const one = single.text.find((t) => t.includes('\u{1F525}'))!;
    const three = triple.text.find((t) => t.includes('\u{1F525}'))!;
    expect(one, 'a lone stack needs no number').toBe('\u{1F525}');
    expect(three, 'three of them do').toBe('\u{1F525}3');
  });

  it('has a face for every status the engine can apply', () => {
    // `brittle` and `charged` were the two that fell through to the bullet default -- the first
    // is what Superconduct leaves and the second is half of three reactions, so both were
    // invisible exactly when they mattered most. This is the guard against the next one.
    const kinds = [
      'burn',
      'toxin',
      'chill',
      'freeze',
      'entangle',
      'stun',
      'brittle',
      'charged',
      'aetherPlated',
      'anchor',
    ];
    for (const kind of kinds) {
      const { ctx, text } = recorder();
      drawBodyFurniture(ctx, CENTRE, 1, body({ atk: 0, statuses: [{ kind, stacks: 1 }] }), 0);
      const glyph = text.find((t) => !/^\d+$/.test(t));
      expect(glyph, `${kind} has a face`).toBeDefined();
      expect(glyph, `${kind} is not the fallback bullet`).not.toBe('•');
    }
  });

  it('says nothing when there is nothing to say', () => {
    const { ctx, text } = recorder();
    drawBodyFurniture(ctx, CENTRE, 1, body({ atk: 0, hp: 4 }), 0);
    expect(text, 'health alone').toEqual(['4']);
  });
});

describe('escalation', () => {
  it('shows a stack count once there is one', () => {
    const { ctx, text } = recorder();
    drawBodyFurniture(ctx, CENTRE, 1, body({ escalation: 2 }), 0);
    expect(text.some((t) => t.includes('2') && t.length > 1), 'the chevron').toBe(true);
  });

  it('is silent at zero, which is where nearly every body spends the fight', () => {
    const { ctx, text } = recorder();
    drawBodyFurniture(ctx, CENTRE, 1, body({ atk: 0, hp: 9, escalation: 0 }), 0);
    expect(text).toEqual(['9']);
  });
});

describe('the brand, the one mark anchored to a body head rather than its feet', () => {
  const marked = () => body({ atk: 0, mark: { school: 'pyre' } });

  it('hangs above the body by default, on the 2D board own figure', () => {
    const { ctx, origins } = recorder();
    drawBodyFurniture(ctx, CENTRE, 1, marked(), 0.5);
    // Screen y counts downward, so above the feet is a smaller number.
    expect(origins, 'the brand was drawn').toHaveLength(1);
    expect(origins[0]!.y, 'clear of the body').toBe(CENTRE.y - 30);
    expect(origins[0]!.x, 'and centred on it').toBe(CENTRE.x);
  });

  it('clears a Behemoth by more, because a Behemoth is taller', () => {
    const { ctx, origins } = recorder();
    drawBodyFurniture(
      ctx,
      CENTRE,
      1,
      body({ atk: 0, mark: { school: 'pyre' }, snapshot: { side: 'enemy', keywords: [], footprint: 2 } }),
      0.5,
    );
    expect(origins[0]!.y).toBe(CENTRE.y - 70);
  });

  it('takes a measured lift, because a body is not the same height relative to a tile in both renderers', () => {
    // The 2D board draws a 54-pixel body on a 116-pixel tile and 30 clears its head. Out in the
    // district a body is 1.9 world units on a 4-unit tile, so the same figure lands mid-torso --
    // over the thing it is branding but looking like part of it. The world board measures the
    // gap by projecting the head, and passes it.
    const measured = recorder();
    drawBodyFurniture(measured.ctx, CENTRE, 1, marked(), 0.5, 120);
    expect(measured.origins[0]!.y, 'the caller measurement wins').toBe(CENTRE.y - 120);
  });
});

describe('an obstacle', () => {
  it('still gets its health, because a crate you can break is a thing worth aiming at', () => {
    const { ctx, text } = recorder();
    drawBodyFurniture(ctx, CENTRE, 1, body({ snapshot: null, atk: 0, hp: 3, maxHp: 3 }), 0);
    expect(text).toEqual(['3']);
  });
});
