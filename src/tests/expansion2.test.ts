import { describe, expect, it } from 'vitest';
import {
  addUnit,
  alongLine,
  atTile,
  atUnit,
  damageTo,
  eventsOf,
  handCard,
  play,
  run,
  scenario,
} from './scenario.js';
import { CARDS } from '../core/data/cards/index.js';
import { HYBRID_CARDS } from '../core/data/cards/hybrid.js';
import { REAGENTS, SPLICE_RECIPES, hybridSchools, recipeFor } from '../core/data/splicing.js';
import { spliceCard } from '../core/overworld/splice.js';
import { isObtainable } from '../core/data/collection.js';
import { isRosterEligible, rosterPointsOf } from '../core/data/roster.js';
import { tierOf } from '../core/data/deckRules.js';
import { SCHOOLS, spellPool } from '../core/data/pools.js';
import { hybridPool, purePool } from '../core/data/grimoire.js';
import { COMPANIONS, GRIMOIRE_SIZE, companionById } from '../core/data/companions.js';
import { newRun, type GlobalGameState } from '../core/overworld/state.js';

/**
 * The second catalog expansion: forty mono-elemental cards, eight pressings, three Cores.
 *
 * Two things are being claimed and they need different kinds of proof. That every school
 * now holds twenty cards is arithmetic, and the sweeps at the top check it against the
 * registry rather than against a list — a hardcoded roster of forty ids would be a second
 * copy of the data, and the first expansion's version of this file is still carrying one.
 *
 * That the cards *work* is not arithmetic, so the rest of the file casts them. Every
 * pressing gets pressed and every novel mechanic gets a board: a construct that poisons a
 * row, a body that lays burning ground behind it, a shove that discharges only when it
 * hits something, a wound worn as plate.
 */

const board = (hand: string[] = [], pips = 8, marrow = 4) =>
  scenario({ width: 6, height: 8, hand, pips, marrow });

/** Every base printing filed under an elemental school, hybrids excluded. */
const monoOf = (school: string) =>
  Object.values(CARDS).filter(
    (c) => c.school === school && !c.id.endsWith('_r2') && !c.spliceOnly,
  );

const NEW_HYBRIDS = [
  'soulfire',
  'superconductor',
  'black_ice',
  'permafrost',
  'kinetic_arc',
  'bone_bastion',
  'iron_briar',
  'blight_siphon',
];

describe('the shelves are level', () => {
  it('gives every elemental school at least twenty cards of its own', () => {
    // A floor rather than an exact number, and the difference is Dusk. This counts every
    // non-hybrid printing filed under a school, `setupOnly` included — and Dusk carries nine
    // of those (five Bound Forms, because every hybrid companion borrowing Dusk is filed
    // under it, plus the authored threats). So Dusk hitting twenty said almost nothing about
    // what a player could hold, and the three decay cards took it to twenty-three.
    //
    // Asserting the floor keeps the expansion's claim without making the next card a
    // failure. What a player can actually *draft* is the test below, and that one is exact.
    for (const school of SCHOOLS) {
      expect(monoOf(school).length, `${school}`).toBeGreaterThanOrEqual(20);
    }
  });

  it('gives every school a full draftable shelf', () => {
    // The number that matters, and the one `catalogGaps` scores: spells and Constructs a
    // Grimoire can actually draw. Dusk was the last school short at seven; the decay shelf
    // closed it, and with it the gap report's tripwire in `catalog.test.ts`.
    for (const school of SCHOOLS) {
      expect(spellPool(school).length, `${school} shelf`).toBeGreaterThanOrEqual(10);
    }
  });

  it('lets every mono bloodline fill its book from its own colour', () => {
    // What the shelf target is a proxy for, asserted directly. A Grimoire is eight slots; a
    // mono species short of eight in its own school pads the remainder from the neutral
    // fallback, which is a beast whose book does not read as its discipline.
    //
    // Mortis was the one that did — seven Dusk spells against eight slots. Arcane is
    // excluded here and deliberately: Lexis has two draftable cards and pads six, but arcane
    // is the Hero's colour rather than a discipline, which is why `SCHOOLS` leaves it out.
    for (const c of COMPANIONS.filter((x) => x.grimoire.schools.length === 1)) {
      const school = c.grimoire.schools[0]!;
      if (!SCHOOLS.includes(school)) continue;
      expect(purePool(c.grimoire).length, `${c.id} cannot fill its own book`).toBeGreaterThanOrEqual(
        GRIMOIRE_SIZE,
      );
    }
  });

  it('authors no elemental Ability and no elemental Mark, because neither can be played', () => {
    // Both are unreachable by construction and it is worth a test rather than a comment.
    // A Hero Deck takes only neutral and arcane, and the Grimoire draft takes only spells
    // and Constructs -- so an elemental Ability belongs to nobody, and an elemental Mark
    // would break the one-per-school Mark set outright.
    for (const school of SCHOOLS) {
      for (const def of monoOf(school)) {
        expect(def.kind, `${def.id} is an unplayable kind for its school`).not.toBe('ability');
        expect(def.kind, `${def.id} is an unplayable kind for its school`).not.toBe('mark');
      }
    }
  });

  it('keeps every new spell and Construct forgeable, and every new body fieldable', () => {
    for (const school of SCHOOLS) {
      for (const def of monoOf(school)) {
        if (def.setupOnly) continue;
        if (def.kind === 'minion') {
          expect(isRosterEligible(def), `${def.id} cannot be fielded`).toBe(true);
          expect(rosterPointsOf(def), `${def.id} price`).toBeGreaterThan(0);
        } else {
          expect(isObtainable(def), `${def.id} cannot be obtained`).toBe(true);
        }
        expect(def.text.length, `${def.id} has no rules text`).toBeGreaterThan(20);
      }
    }
  });

  it('prices the two new elites at Tier 3, one copy each', () => {
    for (const id of ['verdant_colossus', 'anvil_lord', 'arc_dynamo', 'glacier_warden']) {
      expect(tierOf(CARDS[id]!), id).toBe(3);
    }
  });
});

describe('the book is closed', () => {
  it('presses all fifteen elemental pairings', () => {
    const covered = new Set(
      SPLICE_RECIPES.map((r) => hybridSchools(r.resultId).slice().sort().join('+')),
    );
    const missing: string[] = [];
    for (let i = 0; i < SCHOOLS.length; i++) {
      for (let j = i + 1; j < SCHOOLS.length; j++) {
        const pair = [SCHOOLS[i]!, SCHOOLS[j]!].sort().join('+');
        if (!covered.has(pair)) missing.push(pair);
      }
    }
    expect(missing.join(', ')).toBe('');
  });

  it('registers all eight, spliceOnly and cast from the Companion', () => {
    for (const id of NEW_HYBRIDS) {
      const def = CARDS[id];
      expect(def, id).toBeDefined();
      expect(def!.spliceOnly, id).toBe(true);
      expect(def!.source, id).toBe('companion');
      expect(def!.kind, `${id} must be a spell to reach a Grimoire`).toBe('spell');
      expect(def!.range, id).toBeGreaterThan(0);
      expect(isObtainable(def!), `${id} leaked into the loot pool`).toBe(false);
      expect(HYBRID_CARDS[id], `${id} is not in the hybrid bank`).toBeDefined();
    }
  });

  it('derives the intended pair for each, which is not what the card is filed under', () => {
    // `hybridSchools` reads the recipe, not `def.school`, and the two deliberately differ.
    // This is the assertion that catches a recipe wired to the wrong base card: Soulfire
    // filed under dusk but pressed from a Pyre core is still a pyre+dusk fusion.
    const expected: Record<string, string> = {
      soulfire: 'dusk+pyre',
      superconductor: 'frost+surge',
      black_ice: 'dusk+frost',
      permafrost: 'bloom+frost',
      kinetic_arc: 'bulwark+surge',
      bone_bastion: 'bulwark+dusk',
      iron_briar: 'bloom+bulwark',
      blight_siphon: 'bloom+dusk',
    };
    for (const [id, pair] of Object.entries(expected)) {
      expect(hybridSchools(id).slice().sort().join('+'), id).toBe(pair);
    }
  });

  it('bottles one Core per school and spends all six', () => {
    expect(REAGENTS).toHaveLength(SCHOOLS.length);
    for (const school of SCHOOLS) {
      expect(REAGENTS.map((r) => r.school), `${school} unbottled`).toContain(school);
    }
    for (const r of REAGENTS) {
      expect(SPLICE_RECIPES.some((x) => x.catalystId === r.id), `${r.id} presses nothing`).toBe(
        true,
      );
    }
  });

  it('actually presses each of the eight new rows', () => {
    const press = (base: string, core: string) => {
      const prereqs = recipeFor(base, core)?.requiredUnlockedCards ?? [];
      const overworld = newRun(1);
      overworld.economy.reagents = { [core]: 1 };
      const global: GlobalGameState = { overworld, combat: null };
      return spliceCard(global, { unlocked: [base, ...prereqs] }, base, core);
    };

    expect(press('shadow_siphon', 'core_pyre')?.resultId).toBe('soulfire');
    expect(press('glacial_spike', 'core_surge')?.resultId).toBe('superconductor');
    expect(press('grave_call', 'core_frost')?.resultId).toBe('black_ice');
    expect(press('spore_cloud', 'core_frost')?.resultId).toBe('permafrost');
    expect(press('avalanche_slam', 'core_surge')?.resultId).toBe('kinetic_arc');
    expect(press('shadow_siphon', 'core_bulwark')?.resultId).toBe('bone_bastion');
    expect(press('tectonic_plate', 'core_bloom')?.resultId).toBe('iron_briar');
    expect(press('noxious_cloud', 'core_dusk')?.resultId).toBe('blight_siphon');
  });

  it('gives the four starved bloodlines something to roll', () => {
    // The reason the expansion picked these pairings first. Each of these species rolls a
    // 35% hybrid chance per Grimoire slot and had an empty pool to roll against.
    for (const id of ['mantis', 'gargoyle', 'dynamo', 'sovereign']) {
      const source = companionById(id)!.grimoire;
      expect(hybridPool(source).length, `${id} has no fusion to draw`).toBeGreaterThan(0);
    }
  });
});

// ------------------------------------------------------------------- the cards, cast

describe('Pyre', () => {
  it('Stoke pays double on a fire already lit, and merely lights one that is not', () => {
    const cast = (alight: boolean) => {
      const state = board(['stoke']);
      const foe = addUnit(state, { def: 'grave_sentinel', side: 'enemy', at: { x: 2, y: 3 } });
      if (alight) foe.statuses.burn = 1;
      const res = run(state, play(handCard(state, 'player', 'stoke'), atUnit(foe.id)));
      return {
        hit: damageTo(res.events, foe.id),
        burn: res.state.units[foe.id]?.statuses.burn ?? 0,
      };
    };

    expect(cast(true).hit, 'already burning').toBe(30);
    expect(cast(false).hit, 'not burning: no damage at all').toBe(0);
    expect(cast(false).burn, 'just the stack').toBe(1);
  });

  it('the Ember Hound leaves burning ground on the tile it walks off', () => {
    const state = board();
    const hound = addUnit(state, { def: 'ember_hound', side: 'player', at: { x: 2, y: 6 } });
    const res = run(state, { type: 'moveUnit', unit: hound.id, to: { x: 2, y: 4 } });

    expect(res.state.units[hound.id]?.anchor, 'it moved').toEqual({ x: 2, y: 4 });
    // The tile it left, not the tile it arrived on — burying its own feet would be both
    // wrong and a way to immobilise it.
    expect(res.state.hazards['2,6']?.kind, 'the tile it left').toBe('burning');
    expect(res.state.hazards['2,4'], 'not the tile it stands on').toBeUndefined();
  });

  it('the Slag Cairn bursts for fire on whoever breaks it', () => {
    const state = board(['slag_cairn']);
    run(state, play(handCard(state, 'player', 'slag_cairn'), atTile(3, 4)));
    // Raised, and its own definition carries the burst rather than the spawning op.
    expect(CARDS.slag_cairn!.obstacleDeath).toEqual({ status: 'burn', stacks: 1, damage: 30 });
    expect(CARDS.slag_cairn!.obstacleHp).toBe(40);
  });
});

describe('Frost', () => {
  it('the Rime Lance chills everything down its line', () => {
    const state = board(['rime_lance']);
    const near = addUnit(state, { def: 'grave_sentinel', side: 'enemy', at: { x: 2, y: 5 } });
    const far = addUnit(state, { def: 'grave_sentinel', side: 'enemy', at: { x: 2, y: 4 } });
    const res = run(
      state,
      play(handCard(state, 'player', 'rime_lance'), alongLine({ x: 2, y: 6 }, { x: 0, y: -1 })),
    );

    expect(damageTo(res.events, near.id)).toBe(30);
    expect(damageTo(res.events, far.id)).toBe(30);
    expect(res.state.units[near.id]?.statuses.chill).toBe(1);
    expect(res.state.units[far.id]?.statuses.chill).toBe(1);
  });

  it('Deep Winter chills nine tiles and deals nothing at all', () => {
    // Tile-targeted, so the tile itself must be empty; an odd `square` centres on it, and
    // the neighbour at (3,3) is inside the 3x3.
    const state = board(['deep_winter']);
    const foe = addUnit(state, { def: 'grave_sentinel', side: 'enemy', at: { x: 3, y: 3 } });
    const res = run(state, play(handCard(state, 'player', 'deep_winter'), atTile(3, 4)));

    expect(res.state.units[foe.id]?.statuses.chill, 'two stacks').toBe(2);
    expect(damageTo(res.events, foe.id), 'and no damage').toBe(0);
  });

  it('Whiteout fogs the block it lands on', () => {
    const state = board(['whiteout']);
    const res = run(state, play(handCard(state, 'player', 'whiteout'), atTile(2, 4)));
    expect(res.state.hazards['2,4']?.kind).toBe('steam_fog');
  });
});

describe('Surge', () => {
  it('Discharge pays out only against a Charged body', () => {
    const cast = (charged: boolean) => {
      const state = board(['discharge']);
      const foe = addUnit(state, { def: 'grave_sentinel', side: 'enemy', at: { x: 2, y: 3 } });
      const bystander = addUnit(state, {
        def: 'grave_sentinel',
        side: 'enemy',
        at: { x: 3, y: 3 },
      });
      if (charged) foe.statuses.charged = 1;
      const res = run(state, play(handCard(state, 'player', 'discharge'), atUnit(foe.id)));
      return { hit: damageTo(res.events, foe.id), spill: damageTo(res.events, bystander.id) };
    };

    expect(cast(true).hit, 'charged').toBe(40);
    expect(cast(true).spill, 'and the spill').toBe(20);
    expect(cast(false).hit, 'uncharged').toBe(20);
    expect(cast(false).spill, 'no spill at all').toBe(0);
  });

  it('the Paralytic Arc cannot even be aimed at an uncharged body', () => {
    // `requiresStatus` is a targeting gate rather than a conditional, so the engine refuses
    // the command outright — the UI never offers the target in the first place.
    const state = board(['paralytic_arc']);
    const foe = addUnit(state, { def: 'grave_sentinel', side: 'enemy', at: { x: 2, y: 3 } });
    const card = handCard(state, 'player', 'paralytic_arc');
    expect(() => run(state, play(card, atUnit(foe.id)))).toThrow(/illegal target/);

    const armed = board(['paralytic_arc']);
    const target = addUnit(armed, { def: 'grave_sentinel', side: 'enemy', at: { x: 2, y: 3 } });
    target.statuses.charged = 1;
    const res = run(armed, play(handCard(armed, 'player', 'paralytic_arc'), atUnit(target.id)));
    expect(res.state.units[target.id]?.statuses.stun, 'and stunned when charged').toBe(1);
  });

  it('the Tesla Pylon charges without ever dealing damage', () => {
    expect(CARDS.tesla_pylon!.obstacleTurnStart).toEqual({ status: 'charged', stacks: 1 });
    expect(CARDS.tesla_pylon!.obstacleDeath, 'and bursts for nothing').toBeUndefined();
    const state = board(['tesla_pylon']);
    const res = run(state, play(handCard(state, 'player', 'tesla_pylon'), atTile(3, 4)));
    expect(Object.keys(res.state.obstacles).length).toBe(1);
  });

  it('the Storm Rod arms the cluster that killed it', () => {
    expect(CARDS.storm_rod!.unit?.deathburst).toEqual({ status: 'charged', stacks: 1 });
    expect(CARDS.storm_rod!.unit?.mov, 'and cannot walk itself into position').toBe(0);
  });
});

describe('Bulwark', () => {
  it('Phalanx Step drags the ring inward, where the Slam threw it out', () => {
    const state = board(['phalanx_step']);
    const foe = addUnit(state, { def: 'grave_sentinel', side: 'enemy', at: { x: 3, y: 3 } });
    const res = run(state, play(handCard(state, 'player', 'phalanx_step'), atTile(3, 4)));

    // One tile toward the origin: y 3 -> 4, onto the tile that was aimed at.
    expect(res.state.units[foe.id]?.anchor).toEqual({ x: 3, y: 4 });
  });

  it('Siege Break brings down a construct, including your own', () => {
    const state = board(['iron_gate', 'siege_break']);
    const raised = run(state, play(handCard(state, 'player', 'iron_gate'), atTile(3, 4)));
    const gateId = Object.keys(raised.state.obstacles)[0]!;
    expect(raised.state.obstacles[gateId]?.hp).toBe(80);

    const res = run(raised.state, {
      type: 'playCard',
      card: handCard(raised.state, 'player', 'siege_break'),
      target: { kind: 'entity', ref: { kind: 'obstacle', id: gateId } },
    });
    expect(res.state.obstacles[gateId]?.hp, 'fifty off an eighty-point gate').toBe(30);
  });

  it('Hammer Fall demands the Marrow no bank of Pips will cover', () => {
    // Eight Pips and no Marrow. Marrow is a strict requirement: Pips substitute for it at
    // no price, so the card is simply unaffordable.
    const broke = scenario({ width: 6, height: 8, hand: ['hammer_fall'], pips: 8, marrow: 0 });
    const foe = addUnit(broke, { def: 'grave_sentinel', side: 'enemy', at: { x: 2, y: 3 } });
    const card = handCard(broke, 'player', 'hammer_fall');
    expect(() => run(broke, play(card, atUnit(foe.id)))).toThrow(/cannot afford/);

    const paid = board(['hammer_fall']);
    const target = addUnit(paid, { def: 'grave_sentinel', side: 'enemy', at: { x: 2, y: 3 } });
    const res = run(paid, play(handCard(paid, 'player', 'hammer_fall'), atUnit(target.id)));
    expect(res.state.units[target.id]?.statuses.stun).toBe(1);
    expect(damageTo(res.events, target.id)).toBe(30);
  });

  it('the Battlement blocks sight without blocking the tile', () => {
    expect(CARDS.battlement!.obstacleCover).toBe(true);
    expect(CARDS.iron_gate!.obstacleCover, 'and the Gate does the opposite').toBeUndefined();
  });
});

describe('Bloom', () => {
  it('Spore Burst cashes two stacks of rot for damage through armor', () => {
    const cast = (toxin: number) => {
      const state = board(['spore_burst']);
      const foe = addUnit(state, {
        def: 'grave_sentinel',
        side: 'enemy',
        at: { x: 2, y: 3 },
        armor: 40,
      });
      if (toxin) foe.statuses.toxin = toxin;
      const res = run(state, play(handCard(state, 'player', 'spore_burst'), atUnit(foe.id)));
      return res.state.units[foe.id]!;
    };

    // 40 true damage ignores the plate entirely: armour untouched, health down.
    const rotted = cast(2);
    expect(rotted.armor, 'true damage walks past plate').toBe(40);
    expect(rotted.hp).toBe(CARDS.grave_sentinel!.unit!.hp - 40);

    const clean = cast(0);
    expect(clean.armor, 'the consolation branch is eaten by armour').toBe(30);
    expect(clean.hp).toBe(CARDS.grave_sentinel!.unit!.hp);
  });

  it('the Briar Rampart poisons the row it stands in', () => {
    expect(CARDS.briar_rampart!.obstacleTurnStart).toEqual({ status: 'toxin', stacks: 1 });
    const state = board(['briar_rampart']);
    const res = run(state, play(handCard(state, 'player', 'briar_rampart'), atTile(3, 4)));
    const id = Object.keys(res.state.obstacles)[0]!;
    expect(res.state.obstacles[id]?.hp).toBe(50);
  });

  it('Sap Draught heals the Pact and nothing on the board', () => {
    // `scenario` sets maxHp to whatever hp it is given, so the Pact has to be wounded by
    // hand — a heal on a full Pact clamps and would prove nothing.
    const state = board(['sap_draught']);
    state.players.player.hp = 100;
    const res = run(state, play(handCard(state, 'player', 'sap_draught')));
    expect(res.state.players.player.hp).toBe(130);
  });

  it('the Sporeback Boar poisons whatever killed it', () => {
    expect(CARDS.sporeback_boar!.unit?.deathburst).toEqual({ status: 'toxin', stacks: 2 });
  });
});

describe('Dusk — the decay shelf', () => {
  it('the Charnel Pillar is the first Construct Dusk can actually draft', () => {
    // Dusk did own an obstacle before this — `smoke_bank` — but it is `setupOnly`, so it
    // scored nothing in any pool and no player could ever raise one.
    expect(CARDS.smoke_bank!.setupOnly, 'the old one is engine-dealt').toBe(true);
    expect(CARDS.charnel_pillar!.setupOnly, 'and this one is not').toBeUndefined();
    expect(isObtainable(CARDS.charnel_pillar!)).toBe(true);
    expect(spellPool('dusk').map((c) => c.id)).toContain('charnel_pillar');

    // `spawnObstacle` refuses any def without `obstacleHp`, so this is load-bearing.
    expect(CARDS.charnel_pillar!.obstacleHp).toBe(50);
    expect(CARDS.charnel_pillar!.obstacleTurnStart).toEqual({ status: 'brittle', stacks: 1 });

    const state = board(['charnel_pillar']);
    const res = run(state, play(handCard(state, 'player', 'charnel_pillar'), atTile(3, 4)));
    const raised = Object.values(res.state.obstacles)[0];
    expect(raised?.hp, 'and it stands').toBe(50);
  });

  it('Wither pays through armor on a Brittle target, and only softens one that is not', () => {
    const cast = (brittle: boolean) => {
      const state = board(['wither']);
      const foe = addUnit(state, {
        def: 'grave_sentinel',
        side: 'enemy',
        at: { x: 2, y: 3 },
        armor: 40,
      });
      if (brittle) foe.statuses.brittle = 1;
      const res = run(state, play(handCard(state, 'player', 'wither'), atUnit(foe.id)));
      return res.state.units[foe.id]!;
    };

    // Brittle adds +20 to the hit as well, so 30 true lands as 50 straight through the plate.
    const rotted = cast(true);
    expect(rotted.armor, 'true damage walks past plate').toBe(40);
    expect(rotted.hp).toBeLessThan(CARDS.grave_sentinel!.unit!.hp);

    const clean = cast(false);
    expect(clean.hp, 'no damage at all on the unpaid branch').toBe(CARDS.grave_sentinel!.unit!.hp);
    expect(clean.statuses.brittle, 'just the stack').toBe(1);
  });

  it('Creeping Decay is the first Dusk card to touch more than one body', () => {
    const state = board(['creeping_decay']);
    const near = addUnit(state, { def: 'grave_sentinel', side: 'enemy', at: { x: 3, y: 3 } });
    const beside = addUnit(state, { def: 'grave_sentinel', side: 'enemy', at: { x: 2, y: 4 } });
    const diagonal = addUnit(state, { def: 'grave_sentinel', side: 'enemy', at: { x: 2, y: 3 } });

    const res = run(state, play(handCard(state, 'player', 'creeping_decay'), atTile(3, 4)));

    expect(damageTo(res.events, near.id), 'orthogonal').toBe(20);
    expect(damageTo(res.events, beside.id), 'orthogonal').toBe(20);
    expect(damageTo(res.events, diagonal.id), 'the diagonals are the restraint').toBe(0);
    expect(res.state.units[near.id]?.statuses.brittle).toBe(1);
    expect(res.state.units[beside.id]?.statuses.brittle).toBe(1);
  });

  it('gives Dusk a status pillar beside its Marrow one', () => {
    // The design claim, asserted so it cannot quietly become untrue: Dusk now writes a
    // status of its own, and `brittle` is the borrow it writes.
    const writesBrittle = spellPool('dusk').filter((c) =>
      JSON.stringify(c.effect).includes('"brittle"') ||
      c.obstacleTurnStart?.status === 'brittle',
    );
    expect(writesBrittle.map((c) => c.id).sort()).toEqual([
      'charnel_pillar',
      'creeping_decay',
      'wither',
    ]);
  });
});

// --------------------------------------------------------------------- the pressings

describe('the eight fusions, cast', () => {
  it('Soulfire consumes the fire before it detonates', () => {
    const state = board(['soulfire']);
    const foe = addUnit(state, { def: 'grave_sentinel', side: 'enemy', at: { x: 2, y: 3 } });
    const neighbour = addUnit(state, { def: 'grave_sentinel', side: 'enemy', at: { x: 3, y: 3 } });
    foe.statuses.burn = 2;

    const res = run(state, play(handCard(state, 'player', 'soulfire'), atUnit(foe.id)));
    expect(damageTo(res.events, foe.id), 'the detonation').toBe(50);
    expect(damageTo(res.events, neighbour.id), 'and the spill').toBe(20);
    expect(res.state.units[foe.id]?.statuses.burn ?? 0, 'the fire was spent').toBe(0);
  });

  it('Superconductor strips armor off a Charged body, through the reaction', () => {
    const state = board(['superconductor']);
    const foe = addUnit(state, {
      def: 'grave_sentinel',
      side: 'enemy',
      at: { x: 2, y: 3 },
      armor: 30,
    });
    foe.statuses.charged = 1;

    const res = run(state, play(handCard(state, 'player', 'superconductor'), atUnit(foe.id)));
    // The card deals frost damage; Superconduct is the engine's answer to frost-on-charged.
    expect(eventsOf(res.events, 'reactionTriggered').length, 'the reaction fired').toBeGreaterThan(
      0,
    );
    expect(res.state.units[foe.id]?.armor, 'all of it').toBe(0);
    expect(res.state.units[foe.id]?.statuses.brittle ?? 0).toBeGreaterThan(0);
  });

  it('Black Ice is unplayable except into a Freeze, and then ignores armor', () => {
    const unfrozen = board(['black_ice']);
    const a = addUnit(unfrozen, { def: 'grave_sentinel', side: 'enemy', at: { x: 2, y: 3 } });
    const card = handCard(unfrozen, 'player', 'black_ice');
    expect(() => run(unfrozen, play(card, atUnit(a.id)))).toThrow(/illegal target/);

    const state = board(['black_ice']);
    const foe = addUnit(state, {
      def: 'grave_sentinel',
      side: 'enemy',
      at: { x: 2, y: 3 },
      armor: 40,
    });
    foe.statuses.freeze = 1;
    const res = run(state, play(handCard(state, 'player', 'black_ice'), atUnit(foe.id)));
    expect(res.state.units[foe.id]?.armor, 'plate untouched').toBe(40);
    expect(res.state.units[foe.id]?.hp).toBe(CARDS.grave_sentinel!.unit!.hp - 40);
  });

  it('Permafrost roots what the cold was already holding', () => {
    const state = board(['permafrost']);
    const foe = addUnit(state, { def: 'grave_sentinel', side: 'enemy', at: { x: 2, y: 3 } });
    foe.statuses.chill = 1;

    const res = run(state, play(handCard(state, 'player', 'permafrost'), atUnit(foe.id)));
    const after = res.state.units[foe.id]!;
    expect(after.statuses.entangle).toBe(1);
    expect(after.statuses.toxin).toBe(2);
    expect(damageTo(res.events, foe.id)).toBe(20);
  });

  it('the Kinetic Arc discharges only when the shove lands on something', () => {
    // Into open ground: pushed, and nothing else happens.
    const open = board(['kinetic_arc']);
    const a = addUnit(open, { def: 'grave_sentinel', side: 'enemy', at: { x: 2, y: 4 } });
    const bystanderOpen = addUnit(open, {
      def: 'grave_sentinel',
      side: 'enemy',
      at: { x: 3, y: 1 },
    });
    const missed = run(open, play(handCard(open, 'player', 'kinetic_arc'), atUnit(a.id)));
    expect(damageTo(missed.events, bystanderOpen.id), 'no collision, no blast').toBe(0);

    // Into the back wall: it collides, and the blast goes off around it.
    const wall = board(['kinetic_arc']);
    const b = addUnit(wall, { def: 'grave_sentinel', side: 'enemy', at: { x: 2, y: 0 } });
    const neighbour = addUnit(wall, { def: 'grave_sentinel', side: 'enemy', at: { x: 3, y: 0 } });
    const hit = run(wall, play(handCard(wall, 'player', 'kinetic_arc'), atUnit(b.id)));
    expect(damageTo(hit.events, neighbour.id), 'the discharge').toBe(30);
    // Exactly one stack, and it comes from `dealDamage` rather than from the card. Two would
    // mean the card had grown a rider for what the engine already does.
    expect(hit.state.units[neighbour.id]?.statuses.charged, 'and it is armed, once').toBe(1);
  });

  it('Bone Bastion wears the wound as plate on the Pact', () => {
    // Starting on zero Marrow on purpose: the default fixture opens at the cap, where the
    // Marrow the tithe pays would clamp and the assertion would prove nothing.
    const state = scenario({ width: 6, height: 8, hand: ['bone_bastion'], pips: 8, marrow: 0 });
    const body = addUnit(state, { def: 'grave_sentinel', side: 'player', at: { x: 2, y: 6 } });
    const before = state.players.player.marrow;

    const res = run(state, play(handCard(state, 'player', 'bone_bastion'), atUnit(body.id)));
    expect(res.state.units[body.id]?.hp, 'bled for thirty').toBe(
      CARDS.grave_sentinel!.unit!.hp - 30,
    );
    expect(res.state.players.player.armor, 'and the Pact wears it').toBe(30);
    expect(res.state.players.player.marrow, 'plus the Marrow').toBe(before + 1);
  });

  it('Iron Briar raises the Rampart and roots what is beside it', () => {
    const state = board(['iron_briar']);
    const foe = addUnit(state, { def: 'grave_sentinel', side: 'enemy', at: { x: 3, y: 3 } });
    const res = run(state, play(handCard(state, 'player', 'iron_briar'), atTile(3, 4)));

    const raised = Object.values(res.state.obstacles)[0];
    expect(raised?.hp, 'the thicket').toBe(50);
    expect(res.state.units[foe.id]?.statuses.entangle, 'and the roots').toBe(1);
    expect(res.state.units[foe.id]?.statuses.toxin).toBe(1);
  });

  it('the Blight Siphon drinks the rot, and drips without it', () => {
    const cast = (toxin: number) => {
      const state = board(['blight_siphon']);
      state.players.player.hp = 100;
      const foe = addUnit(state, { def: 'grave_sentinel', side: 'enemy', at: { x: 2, y: 3 } });
      if (toxin) foe.statuses.toxin = toxin;
      const res = run(state, play(handCard(state, 'player', 'blight_siphon'), atUnit(foe.id)));
      return { hit: damageTo(res.events, foe.id), hp: res.state.players.player.hp };
    };

    expect(cast(2).hit, 'rotted').toBe(50);
    expect(cast(2).hp, 'and the Pact drinks').toBe(130);
    expect(cast(0).hit, 'clean').toBe(20);
    expect(cast(0).hp, 'and nothing comes back').toBe(100);
  });
});
