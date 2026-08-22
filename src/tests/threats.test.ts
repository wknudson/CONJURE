import { describe, expect, it } from 'vitest';
import { addUnit, damageTo, eventsOf, run, scenario } from './scenario.js';
import { CARDS } from '../core/data/cards/index.js';
import { THREAT_CARDS } from '../core/data/cards/threats.js';
import { isObtainable } from '../core/data/collection.js';
import { bestiaryRoster } from '../core/data/bestiary.js';
import { feralAggressStep } from '../core/engine/feral.js';
import { makeCtx } from '../core/engine/context.js';
import { RUBBLE_MOVE_COST } from '../core/engine/movement.js';
import { coordKey } from '../contract/ids.js';
import { GROWTH_CAP_BEHEMOTH } from '../core/engine/growth.js';

/**
 * The Bestiary.
 *
 * Three creatures an encounter fields against you, each leaning on a capability rather
 * than on a stat line — a creature that is only a bigger number is one the player answers
 * exactly as they answered the last one.
 */

const THREATS = Object.keys(THREAT_CARDS);

describe('the roster as data', () => {
  it('keeps every one of them out of the player’s hands', () => {
    // Enemies are stat blocks, not cards. `setupOnly` is what stops one turning up in a
    // reward roll or on the Schematic shelf.
    for (const id of THREATS) {
      expect(CARDS[id]!.setupOnly, id).toBe(true);
      expect(isObtainable(CARDS[id]!), `${id} leaked into the loot pool`).toBe(false);
    }
  });

  it('puts every one of them in the Threat Ledger', () => {
    // The Ledger builds itself from every definition carrying a `unit`, so a creature the
    // player can meet is a creature they can eventually read about.
    const roster = bestiaryRoster().map((d) => d.id);
    for (const id of THREATS) expect(roster, id).toContain(id);
  });

  it('bleeds at no premium', () => {
    // They are never yours to tithe, so a bonus on one would be a number nothing in the
    // game can read.
    for (const id of THREATS) expect(CARDS[id]!.unit!.titheBonus ?? 0, id).toBe(0);
  });
});

describe('Scrap-Titan', () => {
  const titan = () => {
    const state = scenario({ width: 8, height: 8 });
    const beast = addUnit(state, {
      def: 'scrap_titan',
      side: 'enemy',
      at: { x: 3, y: 3 },
      fresh: false,
    });
    state.activeSide = 'enemy';
    return { state, beast };
  };

  it('is a 2x2 body that grows without a ceiling', () => {
    const stats = CARDS.scrap_titan!.unit!;
    expect(stats.footprint).toBe(2);
    expect(stats.hp).toBe(250);
    expect(CARDS.scrap_titan!.keywords).toContain('Growth');

    const { state, beast } = titan();
    // A Behemoth's ceiling is far out of reach but finite — the clock the player plays
    // against. It was `Infinity`, which is not JSON and came back `null` from a save.
    expect(state.units[beast.id]!.escalationCap).toBe(GROWTH_CAP_BEHEMOTH);
    expect(Number.isFinite(state.units[beast.id]!.escalationCap)).toBe(true);
  });

  it('grinds the tiles it walks off into rubble', () => {
    const { state, beast } = titan();
    const before = new Set(Object.keys(state.hazards));

    const res = run(state, { type: 'moveUnit', unit: beast.id, to: { x: 3, y: 4 } });

    const laid = Object.keys(res.state.hazards).filter((k) => !before.has(k));
    expect(laid.length, 'a 2x2 body vacates two tiles').toBe(2);
    for (const key of laid) {
      expect(res.state.hazards[key]!.kind).toBe('rubble');
      expect(res.state.hazards[key]!.permanent, 'the ground does not recover').toBe(true);
    }
  });

  it('does not bury the half of itself it is still standing on', () => {
    // A 2x2 stepping one square still occupies half of where it was. Laying rubble under
    // its own feet would be both wrong and a way to immobilise it.
    const { state, beast } = titan();
    const res = run(state, { type: 'moveUnit', unit: beast.id, to: { x: 3, y: 4 } });

    const now = res.state.units[beast.id]!;
    const occupied = [
      { x: now.anchor.x, y: now.anchor.y },
      { x: now.anchor.x + 1, y: now.anchor.y },
      { x: now.anchor.x, y: now.anchor.y + 1 },
      { x: now.anchor.x + 1, y: now.anchor.y + 1 },
    ];
    for (const cell of occupied) {
      expect(res.state.hazards[coordKey(cell)], `rubble under ${cell.x},${cell.y}`).toBeUndefined();
    }
  });

  it('cannot cross its own wreckage', () => {
    // Rubble costs 2 MOV and the Titan has 1, so it commits to a direction and the arena
    // is different afterwards. That is the creature, not an oversight.
    expect(CARDS.scrap_titan!.unit!.mov).toBeLessThan(RUBBLE_MOVE_COST);
  });

  it('leaves nothing behind when it is shoved', () => {
    // Being dragged is not grinding your way forward, and a trail laid by displacement
    // would hand the player a way to wreck their own board by pushing the wrong thing.
    const { state, beast } = titan();
    state.activeSide = 'player';
    const shover = addUnit(state, {
      def: 'scout_imp',
      side: 'player',
      at: { x: 3, y: 6 },
      fresh: false,
    });
    state.players.player.pips = 8;
    state.players.player.cards.bash = { instanceId: 'bash', defId: 'shield_bash' };
    state.players.player.hand.push('bash');
    void shover;

    const before = Object.keys(state.hazards).length;
    const res = run(state, {
      type: 'playCard',
      card: 'bash',
      target: { kind: 'entity', ref: { kind: 'unit', id: beast.id } },
    });

    expect(Object.keys(res.state.hazards).length, 'no trail from a shove').toBe(before);
  });

  it('leaves nothing behind if it has no trail', () => {
    // The hook is opt-in: an ordinary body must not start wrecking the floor.
    const state = scenario({ width: 8, height: 8 });
    const plain = addUnit(state, { def: 'scout_imp', side: 'player', at: { x: 3, y: 3 }, fresh: false });
    const before = Object.keys(state.hazards).length;

    const res = run(state, { type: 'moveUnit', unit: plain.id, to: { x: 3, y: 4 } });

    expect(Object.keys(res.state.hazards).length).toBe(before);
  });
});

describe('Marrow-Hound', () => {
  /** A healthy body right beside the hound, and a wounded one further away. */
  const scented = () => {
    const state = scenario({ width: 8, height: 8 });
    const hound = addUnit(state, {
      def: 'marrow_hound',
      side: 'enemy',
      at: { x: 3, y: 4 },
      fresh: false,
    });
    const healthy = addUnit(state, { def: 'grave_sentinel', side: 'player', at: { x: 3, y: 5 }, hp: 120 });
    const wounded = addUnit(state, { def: 'grave_sentinel', side: 'player', at: { x: 6, y: 4 }, hp: 10 });
    state.activeSide = 'enemy';
    return { state, hound, healthy, wounded };
  };

  it('walks past the healthy body to reach the hurt one', () => {
    const { state, hound, healthy, wounded } = scented();
    const ctx = makeCtx(state);

    feralAggressStep(ctx, hound.id);

    // It should not have bitten the thing that was already touching it.
    expect(ctx.state.units[healthy.id]!.hp, 'the healthy one is untouched').toBe(120);
    // And it should have closed on, or killed, the wounded one.
    const stillThere = ctx.state.units[wounded.id];
    const closed = Math.max(
      Math.abs(ctx.state.units[hound.id]!.anchor.x - 6),
      Math.abs(ctx.state.units[hound.id]!.anchor.y - 4),
    );
    expect(stillThere === undefined || closed < 3, 'it went for the blood').toBe(true);
  });

  it('leaves an ordinary beast hunting the nearest, as it always did', () => {
    // The Ridge Wolf's behaviour must be untouched by the new field.
    const state = scenario({ width: 8, height: 8 });
    const wolf = addUnit(state, { def: 'ridge_wolf', side: 'enemy', at: { x: 3, y: 4 }, fresh: false });
    const close = addUnit(state, { def: 'grave_sentinel', side: 'player', at: { x: 3, y: 5 }, hp: 120 });
    const farAndHurt = addUnit(state, { def: 'grave_sentinel', side: 'player', at: { x: 7, y: 4 }, hp: 10 });
    state.activeSide = 'enemy';
    const ctx = makeCtx(state);

    feralAggressStep(ctx, wolf.id);

    expect(ctx.state.units[close.id]!.hp, 'it bit what was closest').toBeLessThan(120);
    expect(ctx.state.units[farAndHurt.id]!.hp, 'and ignored the distant wound').toBe(10);
  });

  it('belongs to nobody, and moves the turn it lands', () => {
    expect(CARDS.marrow_hound!.keywords).toEqual(expect.arrayContaining(['Feral', 'Haste']));
    expect(CARDS.marrow_hound!.unit!.mov).toBe(4);
    expect(CARDS.marrow_hound!.unit!.hunts).toBe('weakest');
  });
});

describe('Plague-Bearer', () => {
  // `armor` is a knob because the rider now depends on whether the blow lands: the
  // plated case and the wounded case are two different rules and want two setups.
  const bearer = (opts: { armor?: number } = {}) => {
    const state = scenario({ width: 8, height: 8 });
    const carrier = addUnit(state, {
      def: 'plague_bearer',
      side: 'enemy',
      at: { x: 3, y: 4 },
      fresh: false,
    });
    const victim = addUnit(state, {
      def: 'grave_sentinel',
      side: 'player',
      at: { x: 3, y: 5 },
      hp: 120,
      armor: opts.armor ?? 60,
    });
    state.activeSide = 'enemy';
    return { state, carrier, victim };
  };

  it('leaves Toxin on whatever it wounds', () => {
    // Unarmoured, so the blow lands and the venom rides in with it.
    const { state, carrier, victim } = bearer({ armor: 0 });

    const res = run(state, {
      type: 'attack',
      attacker: carrier.id,
      target: { kind: 'unit', id: victim.id },
    });

    expect(res.state.units[victim.id]!.statuses.toxin).toBe(1);
  });

  it('is turned away by armour that stops the blow outright', () => {
    // This assertion used to run the other way: six armour ate the whole attack and the
    // Toxin landed regardless, because the rider was the one secondary effect in the
    // engine that never asked whether the hit connected. It asks now, on the same
    // `hpLoss` test marks and reactions already used — so plate is a real answer to a
    // Plague-Bearer, and the creature has to be let through before it can poison.
    const { state, carrier, victim } = bearer();
    const hit = run(state, {
      type: 'attack',
      attacker: carrier.id,
      target: { kind: 'unit', id: victim.id },
    });

    expect(damageTo(hit.events, victim.id), 'the blow itself is absorbed').toBe(0);
    expect(hit.state.units[victim.id]!.statuses.toxin, 'and so is the venom').toBeUndefined();
    // Armour is still spent as it soaks (`cmd.armor -= absorbed`), so the swing was not
    // free for the defender either.
    expect(hit.state.units[victim.id]!.armor).toBe(50);
  });

  it('goes around armour once it is actually in', () => {
    // The half that did not change, and the creature's whole point: a wound lets the
    // Toxin in, and from then on the plate is irrelevant — it ticks as `true` damage.
    const { state, carrier, victim } = bearer({ armor: 0 });
    const hit = run(state, {
      type: 'attack',
      attacker: carrier.id,
      target: { kind: 'unit', id: victim.id },
    });

    // Re-plate the victim *after* the poison is in, so the tick has armour to ignore.
    hit.state.units[victim.id]!.armor = 50;
    expect(hit.state.units[victim.id]!.statuses.toxin).toBe(1);

    const ticked = run(hit.state, { type: 'endTurn' });
    const ticks = eventsOf(ticked.events, 'statusTicked').filter(
      (e) => e.unitId === victim.id && e.status === 'toxin',
    );
    expect(ticks.length).toBe(1);
    expect(ticks[0]!.damage, 'straight through the plate').toBeGreaterThan(0);
    expect(
      ticked.state.units[victim.id]!.armor,
      'the tick goes around the armour rather than through it',
    ).toBe(50);
  });

  it('hits for almost nothing, which is the point', () => {
    expect(CARDS.plague_bearer!.unit!.atk).toBe(10);
    expect(CARDS.plague_bearer!.unit!.hp).toBe(80);
  });
});
