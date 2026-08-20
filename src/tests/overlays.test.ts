import { describe, expect, it } from 'vitest';
import { TargetingController } from '../hud/TargetingController.js';
import { emptyOverlays, type Overlays } from '../render/BoardRenderer.js';
import type { BoardView, CastInfo, RulesQuery, TargetSpec } from '../contract/query.js';
import type { CardSnapshot } from '../contract/snapshots.js';
import { coordKey } from '../contract/ids.js';

/**
 * The overlay layer: what the board is told to draw, and why.
 *
 * These are tests of the **contract between the rules and the renderer**, not of pixels.
 * `Overlays` is the whole boundary — the controller fills it from snapshots and the
 * renderer draws it and nothing else — so asserting what lands in it is the honest way to
 * test a visual layer without asserting on a canvas.
 */

function unit(over: Record<string, unknown> = {}): BoardView['units'][number] {
  return {
    id: 'u1',
    defId: 'scout_imp',
    name: 'Scout Imp',
    side: 'player',
    anchor: { x: 2, y: 2 },
    footprint: 1,
    hp: 4,
    maxHp: 4,
    armor: 0,
    atk: 2,
    mov: 2,
    rangeMin: 1,
    rangeMax: 1,
    school: 'arcane',
    keywords: [],
    archetype: 'skirmisher',
    escalation: 0,
    exhausted: false,
    ...over,
  } as BoardView['units'][number];
}

function board(over: Partial<BoardView> = {}): BoardView {
  return {
    width: 6,
    height: 6,
    territoryDepth: 2,
    turn: 1,
    activeSide: 'player',
    phase: 'action',
    units: [],
    obstacles: [],
    hazards: [],
    intents: [],
    runes: [],
    statuses: [],
    escalation: [],
    anchors: [],
    roster: [],
    player: {} as BoardView['player'],
    enemy: {} as BoardView['enemy'],
    encounterName: 'test',
    ...over,
  } as BoardView;
}

/** A rules stub that answers only what the overlay painting actually asks for. */
function harness(opts: {
  units?: BoardView['units'];
  moves?: { x: number; y: number }[];
  attacks?: BoardView['units'][number]['anchor'][];
  cast?: CastInfo;
  targets?: TargetSpec;
  hand?: CardSnapshot[];
  occluded?: { x: number; y: number }[];
}) {
  let painted: Overlays = emptyOverlays();

  const rules = {
    getBoard: () => board({ units: opts.units ?? [] }),
    getHand: () => opts.hand ?? [],
    getPlayableCards: () => (opts.hand ?? []).map((c) => c.instanceId),
    getLegalTargets: () => opts.targets ?? ({ kind: 'none' } as TargetSpec),
    castInfo: () => opts.cast,
    getLegalMoves: () => opts.moves ?? [],
    getLegalAttacks: () =>
      (opts.attacks ?? []).map((_, i) => ({ kind: 'unit', id: `t${i}` }) as const),
    getOccludedTiles: () => opts.occluded ?? [],
    getThreat: () => ({ tiles: [], commanderThreatCount: 0 }),
    getReadyUnits: () => [],
    getUnspentPotential: () => ({ readyUnits: 0, playableCards: 0 }),
    previewAction: () => ({ tileEffects: [], displacements: [] }) as never,
    isOver: () => false,
  } as unknown as RulesQuery;

  const ctrl = new TargetingController(rules, {
    commit: () => {},
    setOverlays: (o) => {
      painted = o;
    },
    setSelectedCard: () => {},
    setEnemyTargetable: () => {},
    askChannel: () => {},
    setAwaitingFallen: () => {},
    notice: () => {},
    warn: () => {},
    setInspected: () => {},
  });

  return { ctrl, overlays: () => painted };
}

describe('the selection ring follows the body, not the anchor', () => {
  it('rings all four cells of a Behemoth', () => {
    // A 2x2 ringed on its anchor alone reads as a 1x1 standing inside a Behemoth.
    const behemoth = unit({ id: 'b1', footprint: 2, anchor: { x: 1, y: 1 } });
    const h = harness({ units: [behemoth] });

    h.ctrl.selectUnit('b1');

    const cells = h.overlays().selectedCells.map(coordKey).sort();
    expect(cells).toHaveLength(4);
    expect(cells).toEqual(
      [
        { x: 1, y: 1 },
        { x: 2, y: 1 },
        { x: 1, y: 2 },
        { x: 2, y: 2 },
      ]
        .map(coordKey)
        .sort(),
    );
  });

  it('rings exactly one cell for an ordinary body', () => {
    const h = harness({ units: [unit()] });
    h.ctrl.selectUnit('u1');
    expect(h.overlays().selectedCells).toHaveLength(1);
  });
});

describe('reach badges say which of the three profiles a body has', () => {
  const profileOf = (over: Record<string, unknown>): string => {
    const h = harness({ units: [unit(over)] });
    h.ctrl.selectUnit('u1');
    return h.overlays().badges[0]?.profile ?? 'none';
  };

  it('reads a one-tile body as melee', () => {
    expect(profileOf({ rangeMax: 1 })).toBe('melee');
  });

  it('reads a long reach as ranged', () => {
    expect(profileOf({ rangeMax: 4 })).toBe('ranged');
  });

  it('reads an arcing profile as arcing, however far it shoots', () => {
    // The profile wins over the range: a mortar and a bow can have identical envelopes
    // and differ entirely in what they may shoot over.
    expect(profileOf({ rangeMax: 4, rangeMin: 2, attackProfile: 'arcing' })).toBe('arcing');
  });

  it('carries the blind spot, which is the one number nothing else shows', () => {
    const h = harness({ units: [unit({ rangeMin: 2, rangeMax: 4, attackProfile: 'arcing' })] });
    h.ctrl.selectUnit('u1');
    const badge = h.overlays().badges[0]!;
    expect(badge.rangeMin).toBe(2);
    expect(badge.rangeMax).toBe(4);
  });

  it('badges the selected body and nothing else', () => {
    const h = harness({ units: [unit(), unit({ id: 'u2', anchor: { x: 4, y: 4 } })] });
    h.ctrl.selectUnit('u1');
    const badges = h.overlays().badges;
    expect(badges).toHaveLength(1);
    expect(badges[0]!.unitId).toBe('u1');
  });
});

describe('dimming answers “why not that tile?”', () => {
  const aiming = () =>
    harness({
      units: [unit()],
      // The occluded tile sits *inside* the reach envelope on purpose: outside it, the
      // range check would exclude it first and the fog rule would never be exercised.
      cast: { origin: { x: 2, y: 2 }, range: 2, needsLoS: true, occluded: [{ x: 3, y: 3 }] },
      targets: { kind: 'tiles', tiles: [{ x: 3, y: 2 }] } as TargetSpec,
      hand: [{ instanceId: 'c1', school: 'frost' } as CardSnapshot],
    });

  it('shades what the cast reaches and cannot use', () => {
    const h = aiming();
    h.ctrl.onCardHover('c1');
    const dimmed = h.overlays().dimmed.map(coordKey);

    // Inside the envelope, not a legal target -> shaded.
    expect(dimmed).toContain(coordKey({ x: 1, y: 1 }));
    // The legal target itself is never shaded; it is the offer.
    expect(dimmed).not.toContain(coordKey({ x: 3, y: 2 }));
    // The origin is not a refusal.
    expect(dimmed).not.toContain(coordKey({ x: 2, y: 2 }));
  });

  it('stops at the edge of the card’s reach', () => {
    // Beyond the envelope there is nothing to explain: "too far to show you" and "you can
    // reach that and it will not work" are different answers, and only the second is drawn.
    const h = aiming();
    h.ctrl.onCardHover('c1');
    const dimmed = h.overlays().dimmed.map(coordKey);
    expect(dimmed).not.toContain(coordKey({ x: 5, y: 5 }));
    expect(dimmed).not.toContain(coordKey({ x: 0, y: 5 }));
  });

  it('leaves blocked sight to the hatching instead', () => {
    // A tile the origin cannot see is already answered by `fog`; shading it too would
    // stack two different refusals on one tile.
    const h = aiming();
    h.ctrl.onCardHover('c1');
    const o = h.overlays();
    for (const c of o.fog) {
      expect(o.dimmed.map(coordKey)).not.toContain(coordKey(c));
    }
  });

  it('shades nothing for a Hero card, which has no origin to reach from', () => {
    // `castOriginCells` is 'global' for a Hero card, so there is no envelope and no
    // refusal to draw. Drawing one would invent a rule the engine does not apply.
    const h = harness({
      units: [unit()],
      targets: { kind: 'tiles', tiles: [{ x: 3, y: 2 }] } as TargetSpec,
      hand: [{ instanceId: 'c1', school: 'arcane' } as CardSnapshot],
    });
    h.ctrl.onCardHover('c1');
    expect(h.overlays().dimmed).toHaveLength(0);
    expect(h.overlays().trajectory).toHaveLength(0);
  });
});

describe('the flight line is drawn to what the cursor is on', () => {
  const aiming = (needsLoS: boolean) =>
    harness({
      units: [unit()],
      cast: { origin: { x: 2, y: 2 }, range: 4, needsLoS, occluded: [] },
      targets: { kind: 'tiles', tiles: [{ x: 4, y: 2 }] } as TargetSpec,
      hand: [{ instanceId: 'c1', school: 'frost' } as CardSnapshot],
    });

  it('draws one line, in the card’s school, to the hovered target', () => {
    const h = aiming(true);
    h.ctrl.onCardHover('c1');
    h.ctrl.onTileHover({ x: 4, y: 2 });

    const shots = h.overlays().trajectory;
    expect(shots).toHaveLength(1);
    expect(shots[0]!.from).toEqual({ x: 2, y: 2 });
    expect(shots[0]!.to).toEqual({ x: 4, y: 2 });
    expect(shots[0]!.school).toBe('frost');
  });

  it('draws nothing while the cursor is on a tile the card cannot use', () => {
    // The line answers "what happens if I click here". Over an illegal tile the honest
    // answer is nothing, and a line drawn anyway would promise a cast that is refused.
    const h = aiming(true);
    h.ctrl.onCardHover('c1');
    h.ctrl.onTileHover({ x: 0, y: 5 });
    expect(h.overlays().trajectory).toHaveLength(0);
  });

  it('lobs a card that needs no line of sight', () => {
    // Not needing a line *is* going over rather than through, and on an isometric board
    // the arc is the only thing that says so.
    const h = aiming(false);
    h.ctrl.onCardHover('c1');
    h.ctrl.onTileHover({ x: 4, y: 2 });
    expect(h.overlays().trajectory[0]!.arcing).toBe(true);
  });

  it('keeps a sighted cast flat', () => {
    const h = aiming(true);
    h.ctrl.onCardHover('c1');
    h.ctrl.onTileHover({ x: 4, y: 2 });
    expect(h.overlays().trajectory[0]!.arcing).toBe(false);
  });
});

describe('an empty board asks for nothing', () => {
  it('paints no overlay fields by default', () => {
    const o = emptyOverlays();
    expect(o.dimmed).toEqual([]);
    expect(o.trajectory).toEqual([]);
    expect(o.selectedCells).toEqual([]);
    expect(o.badges).toEqual([]);
  });
});
