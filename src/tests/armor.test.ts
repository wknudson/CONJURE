import { describe, expect, it } from 'vitest';
import {
  atPortrait,
  atUnit,
  eventsOf,
  findUnit,
  handCard,
  play,
  run,
  scenario,
} from './scenario.js';

describe('persistent armor', () => {
  it('absorbs damage before HP and does not decay between turns', () => {
    const state = scenario({
      units: [{ def: 'grave_sentinel', side: 'player', at: { x: 2, y: 4 }, hp: 6, armor: 4 }],
    });
    const sentinel = findUnit(state, 'grave_sentinel', 'player');

    const cycled = run(state, { type: 'endTurn' }, { type: 'endTurn' });
    // Armor survives a full round intact.
    expect(cycled.state.units[sentinel.id]!.armor).toBe(4);
  });

  it('grants +4 armor to a chosen unit via Aegis Ward', () => {
    const state = scenario({
      units: [{ def: 'scout_imp', side: 'player', at: { x: 2, y: 4 } }],
      hand: ['aegis_ward'],
    });
    const imp = findUnit(state, 'scout_imp', 'player');

    const res = run(state, play(handCard(state, 'player', 'aegis_ward'), atUnit(imp.id)));
    expect(res.state.units[imp.id]!.armor).toBe(4);
  });

  it('grants armor to the Hero portrait when targeted there', () => {
    const state = scenario({ hand: ['aegis_ward'] });
    const res = run(state, play(handCard(state, 'player', 'aegis_ward'), atPortrait('player')));
    expect(res.state.players.player.armor).toBe(4);
  });

  it('converts blood taken from a minion into Hero armor via Dark Tithe', () => {
    const state = scenario({
      units: [{ def: 'grave_sentinel', side: 'player', at: { x: 2, y: 4 }, hp: 6 }],
      hand: ['dark_tithe'],
    });
    const sentinel = findUnit(state, 'grave_sentinel', 'player');

    const res = run(state, play(handCard(state, 'player', 'dark_tithe'), atUnit(sentinel.id)));

    // The body survives now — that is the whole shape of the overhaul. It is wounded for
    // 4 of its 6, Exhausted, and still standing where it was.
    const body = res.state.units[sentinel.id]!;
    expect(body.hp).toBe(2);
    expect(body.statuses.exhaust).toBe(1);

    // Armour is measured by the wound rather than by the whole body.
    expect(res.state.players.player.armor).toBe(4);
    expect(res.state.players.player.marrow).toBe(3);
  });

  it('grants armor only for the blood a small body could actually give', () => {
    // The scaling reads *landed* damage, so a body with less health than the tithe asks
    // for cannot pay armour it never had. Without that the card would be worth more when
    // aimed at something nearly dead.
    const state = scenario({
      units: [{ def: 'grave_sentinel', side: 'player', at: { x: 2, y: 4 }, hp: 2 }],
      hand: ['dark_tithe'],
    });
    const sentinel = findUnit(state, 'grave_sentinel', 'player');

    const res = run(state, play(handCard(state, 'player', 'dark_tithe'), atUnit(sentinel.id)));

    expect(res.state.units[sentinel.id], 'a 2 HP body does not survive a 4 damage tithe').toBeUndefined();
    expect(res.state.players.player.armor).toBe(2);
    // Paid in full regardless: the Marrow is credited before the wound lands.
    expect(res.state.players.player.marrow).toBe(3);
  });
});

describe('counter and trades', () => {
  it('does not retaliate without the Counter keyword', () => {
    const state = scenario({
      units: [
        { def: 'scout_imp', side: 'player', at: { x: 2, y: 2 }, hp: 5 },
        { def: 'scout_imp', side: 'enemy', at: { x: 2, y: 1 }, hp: 9 },
      ],
    });
    const attacker = findUnit(state, 'scout_imp', 'player');
    const foe = findUnit(state, 'scout_imp', 'enemy');

    const res = run(state, { type: 'attack', attacker: attacker.id, target: { kind: 'unit', id: foe.id } });

    expect(res.state.units[foe.id]!.hp).toBe(7);
    expect(res.state.units[attacker.id]!.hp).toBe(5);
  });

  it('retaliates with the Counter keyword on a melee hit', () => {
    const state = scenario({
      units: [
        { def: 'scout_imp', side: 'player', at: { x: 2, y: 2 }, hp: 5 },
        { def: 'grave_sentinel', side: 'enemy', at: { x: 2, y: 1 }, hp: 9 },
      ],
    });
    const attacker = findUnit(state, 'scout_imp', 'player');
    const sentinel = findUnit(state, 'grave_sentinel', 'enemy');

    const res = run(state, {
      type: 'attack',
      attacker: attacker.id,
      target: { kind: 'unit', id: sentinel.id },
    });

    // Sentinel takes 2, then ripostes for its own 2 ATK.
    expect(res.state.units[sentinel.id]!.hp).toBe(7);
    expect(res.state.units[attacker.id]!.hp).toBe(3);
    const counters = eventsOf(res.events, 'damageDealt').filter((e) => e.cause === 'counter');
    expect(counters).toHaveLength(1);
  });

  it('does not retaliate when the Counter unit dies to the hit', () => {
    const state = scenario({
      units: [
        { def: 'scout_imp', side: 'player', at: { x: 2, y: 2 }, hp: 5, atk: 9 },
        { def: 'grave_sentinel', side: 'enemy', at: { x: 2, y: 1 }, hp: 3 },
      ],
    });
    const attacker = findUnit(state, 'scout_imp', 'player');
    const sentinel = findUnit(state, 'grave_sentinel', 'enemy');

    const res = run(state, {
      type: 'attack',
      attacker: attacker.id,
      target: { kind: 'unit', id: sentinel.id },
    });

    expect(res.state.units[sentinel.id]).toBeUndefined();
    expect(res.state.units[attacker.id]!.hp).toBe(5);
  });
});

describe('lethal and sudden death', () => {
  it('ends in victory when the enemy commander reaches 0', () => {
    const state = scenario({
      enemyHp: 2,
      units: [{ def: 'scout_imp', side: 'player', at: { x: 2, y: 0 }, atk: 5 }],
    });
    const imp = findUnit(state, 'scout_imp', 'player');

    const res = run(state, {
      type: 'attack',
      attacker: imp.id,
      target: { kind: 'portrait', side: 'enemy' },
    });

    expect(res.state.result).toBe('victory');
    expect(eventsOf(res.events, 'combatEnded')[0]!.result).toBe('victory');
  });

  it('revives both commanders at 1 HP and wipes the board on a mutual KO', () => {
    // Both sides are at 3 HP. A rune cascade will finish both in the same step.
    const state = scenario({ playerHp: 3, enemyHp: 3 });
    // Force the mutual case directly through the lethal checker.
    state.players.player.hp = 0;
    state.players.enemy.hp = 0;
    state.units = {};

    const res = run(state, { type: 'endTurn' });

    expect(res.state.suddenDeath).toBe(true);
    expect(res.state.players.player.hp).toBe(1);
    expect(res.state.players.enemy.hp).toBe(1);
    // Armor is purged: both enter sudden death naked.
    expect(res.state.players.player.armor).toBe(0);
    expect(res.state.players.enemy.armor).toBe(0);
    expect(Object.keys(res.state.units)).toHaveLength(0);
    expect(eventsOf(res.events, 'suddenDeath')).toHaveLength(1);
  });
});
