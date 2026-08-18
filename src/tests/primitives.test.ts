import { describe, expect, it } from 'vitest';
import { addUnit, giveCard, play, run, scenario } from './scenario.js';
import { CARDS } from '../core/data/cards/index.js';
import type { CardDef, EffectNode } from '../core/types/cards.js';

/**
 * The effect vocabulary, tested through purpose-built cards.
 *
 * Each primitive gets its own probe rather than being tested through a shipped card, so
 * the rule is pinned independently of whichever card happens to use it — and a later
 * re-cost or re-target of real card data cannot quietly invalidate the coverage.
 */

/** Stable id per probe, so repeated runs reuse one definition. */
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

function probe(effect: EffectNode, extra: Partial<CardDef> = {}): string {
  const id = `probe_${Math.abs(hash(JSON.stringify(effect) + JSON.stringify(extra)))}`;
  CARDS[id] = {
    id,
    name: 'Probe',
    cost: { pips: 0, marrow: 0 },
    school: 'arcane',
    source: 'hero',
    kind: 'spell',
    text: '',
    target: { kind: 'none' },
    effect,
    keywords: [],
    ...extra,
  };
  return id;
}

const board = () => scenario({ width: 7, height: 7, pips: 8 });

describe('cone', () => {
  const coneCard = () =>
    probe(
      { op: 'damage', amount: 2, dtype: 'spell', area: { shape: 'cone', depth: 3 } },
      { target: { kind: 'line', length: 3 } },
    );

  it('widens as it travels, catching what a line would miss', () => {
    const state = board();
    // Straight ahead at depth 2, and two tiles off-axis at depth 2 — both inside a wedge
    // that a plain line would miss entirely.
    const ahead = addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 3, y: 1 }, hp: 20 });
    const flank = addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 5, y: 1 }, hp: 20 });
    const id = giveCard(state, 'player', coneCard());

    const res = run(state, play(id, { kind: 'line', from: { x: 3, y: 3 }, dir: { x: 0, y: -1 } }));

    expect(res.state.units[ahead.id]!.hp, 'on the axis').toBe(18);
    expect(res.state.units[flank.id]!.hp, 'two tiles off, at depth two').toBe(18);
  });

  it('does not reach past its depth', () => {
    const state = board();
    // A decoy inside the wedge, so the line is a legal target at all, and the real
    // subject beyond its far edge.
    addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 3, y: 2 }, hp: 20 });
    const far = addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 3, y: 0 }, hp: 20 });
    const id = giveCard(state, 'player', coneCard());

    const res = run(state, play(id, { kind: 'line', from: { x: 3, y: 3 }, dir: { x: 0, y: -1 } }));
    expect(res.state.units[far.id]!.hp, 'depth 3 covers y=3..1, not y=0').toBe(20);
  });
});

describe('adjacentCross', () => {
  it('takes the orthogonals and spares the diagonals', () => {
    const state = board();
    const orth = addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 3, y: 2 }, hp: 20 });
    const diag = addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 4, y: 2 }, hp: 20 });
    const id = giveCard(
      state,
      'player',
      probe(
        { op: 'damage', amount: 2, dtype: 'spell', area: { shape: 'adjacentCross' } },
        { target: { kind: 'emptyTile', zone: 'any', footprint: 1 } },
      ),
    );

    const res = run(state, play(id, { kind: 'tile', at: { x: 3, y: 3 } }));
    expect(res.state.units[orth.id]!.hp, 'orthogonal').toBe(18);
    expect(res.state.units[diag.id]!.hp, 'diagonal is spared').toBe(20);
  });
});

describe('shoveArea', () => {
  it('throws everything in the area directly away from the origin', () => {
    const state = board();
    const north = addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 3, y: 2 }, hp: 20 });
    const south = addUnit(state, { def: 'scout_imp', side: 'enemy', at: { x: 3, y: 4 }, hp: 20 });
    const id = giveCard(
      state,
      'player',
      probe(
        { op: 'shoveArea', distance: 1, area: { shape: 'adjacent8' } },
        { target: { kind: 'emptyTile', zone: 'any', footprint: 1 } },
      ),
    );

    const res = run(state, play(id, { kind: 'tile', at: { x: 3, y: 3 } }));
    expect(res.state.units[north.id]!.anchor.y, 'pushed further north').toBe(1);
    expect(res.state.units[south.id]!.anchor.y, 'pushed further south').toBe(5);
  });
});

describe('drawCards', () => {
  it('draws through the ordinary path', () => {
    // The scenario builder starts with an empty deck; a draw test needs something in it.
    const state = scenario({ width: 6, height: 6, pips: 8, deck: ['scout_imp', 'scout_imp'] });
    const id = giveCard(state, 'player', probe({ op: 'drawCards', amount: 2 }));
    const before = state.players.player.hand.length;
    const deckBefore = state.players.player.deck.length;

    const res = run(state, play(id, { kind: 'none' }));

    // Two drawn, one spent: the probe itself leaves the hand as it resolves.
    expect(res.state.players.player.hand.length).toBe(before + 1);
    expect(res.state.players.player.deck.length).toBe(deckBefore - 2);
  });
});

describe('extractMarrow scaled off a sacrifice', () => {
  const harvest = (max: number) =>
    probe(
      {
        op: 'seq',
        effects: [
          { op: 'sacrificeTarget' },
          { op: 'extractMarrow', amount: { from: 'sacrificedHp', max } },
        ],
      },
      { target: { kind: 'entity', side: 'ally', includeObstacles: false } },
    );

  it('pays out the body it just spent', () => {
    const state = scenario({ width: 6, height: 6, pips: 8, marrow: 0 });
    const victim = addUnit(state, { def: 'grave_sentinel', side: 'player', at: { x: 2, y: 4 }, hp: 3 });
    const id = giveCard(state, 'player', harvest(4));

    const res = run(state, play(id, { kind: 'entity', ref: { kind: 'unit', id: victim.id } }));
    expect(res.state.players.player.marrow).toBe(3);
  });

  it('caps what a fat target is worth', () => {
    const state = scenario({ width: 6, height: 6, pips: 8, marrow: 0 });
    const victim = addUnit(state, { def: 'grave_sentinel', side: 'player', at: { x: 2, y: 4 }, hp: 9 });
    const id = giveCard(state, 'player', harvest(4));

    const res = run(state, play(id, { kind: 'entity', ref: { kind: 'unit', id: victim.id } }));
    expect(res.state.players.player.marrow, 'capped, not 9').toBe(4);
  });
});

describe('spawnConstruct', () => {
  it('raises the obstacle at the spell strength, not the card definition', () => {
    const state = board();
    const id = giveCard(
      state,
      'player',
      probe(
        { op: 'spawnConstruct', obstacleDef: 'stone_barricade', hp: 4 },
        { target: { kind: 'emptyTile', zone: 'any', footprint: 1 } },
      ),
    );

    const res = run(state, play(id, { kind: 'tile', at: { x: 3, y: 3 } }));
    const built = Object.values(res.state.obstacles).find(
      (o) => o.anchor.x === 3 && o.anchor.y === 3,
    );

    expect(built, 'something was raised').toBeDefined();
    expect(built!.hp).toBe(4);
    expect(built!.maxHp, 'at full health, not damaged down to it').toBe(4);
    expect(CARDS.stone_barricade!.obstacleHp, 'the shared card is untouched').not.toBe(4);
  });
});
