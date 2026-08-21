import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_NICKNAME,
  FACE_PRESETS,
  HAIR_PRESETS,
  NICKNAME_MAX,
  clampPreset,
  defaultLook,
  faceOf,
  hairOf,
  isStarterSpecies,
  normalizeLook,
  starterSpecies,
  type CharacterLook,
} from '../core/data/characterLook.js';
import { PLAYABLE_SCHOOLS, speciesForSchool } from '../core/data/pools.js';
import { companionById, GRIMOIRE_SIZE } from '../core/data/companions.js';
import { CARDS, STARTER_DECK } from '../core/data/cards/index.js';
import { HERO_SCHOOLS, fusedDeckSize, validateDeck } from '../core/data/deckRules.js';
import { validateRoster } from '../core/data/roster.js';
import { RELIC_SLOT_ORDER } from '../core/overworld/state.js';
import {
  emptySave,
  initializeNewProfile,
  loadSave,
  newProfile,
  writeSave,
  type SaveFile,
} from '../app/save.js';
import { drawCommander, drawCompanion } from '../render/sprites.js';

/**
 * Character creation: the desk, and what walks away from it.
 *
 * The sprite tests are the unusual ones. There is no DOM here and no canvas, so they hand
 * the drawing code a context that writes down what it was asked to do — which turns out to
 * be a better assertion than a pixel diff anyway: "a topknot draws a different shape than a
 * crop" is the actual claim, and it survives somebody nudging a colour.
 */

function installStorage(): void {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  });
}

describe('the look', () => {
  it('opens on something, not on a random roll', () => {
    // The first thing a player sees has to be the thing their first click changes. A
    // randomised opening state makes "next hair" read as "reroll".
    expect(defaultLook()).toEqual(defaultLook());
    expect(defaultLook().nickname).toBe(DEFAULT_NICKNAME);
  });

  it('carries no gear, by construction', () => {
    // The brief's one prohibition, and the schema is where it has to hold: optics,
    // vestment, trinket, treads and will are earned, and a creator that could set them
    // would be spending the reward before the first contract.
    const keys = Object.keys(defaultLook());
    for (const slot of RELIC_SLOT_ORDER) expect(keys, slot).not.toContain(slot);
    expect(keys.sort()).toEqual(
      ['facePreset', 'gender', 'hairPreset', 'nickname', 'starterCompanion'].sort(),
    );
  });

  it('trims and caps a nickname, and never accepts a blank one', () => {
    expect(normalizeLook({ nickname: '  Vessa Kade  ' }).nickname).toBe('Vessa Kade');
    expect(normalizeLook({ nickname: 'x'.repeat(80) }).nickname).toHaveLength(NICKNAME_MAX);
    expect(normalizeLook({ nickname: '   ' }).nickname).toBe(DEFAULT_NICKNAME);
    expect(normalizeLook({ nickname: 42 }).nickname).toBe(DEFAULT_NICKNAME);
  });

  it('takes only the two bearings it offers', () => {
    expect(normalizeLook({ gender: 'male' }).gender).toBe('male');
    expect(normalizeLook({ gender: 'wyvern' }).gender).toBe(defaultLook().gender);
  });

  it('wraps a preset index rather than rejecting it', () => {
    // Cycling is modular everywhere in the creator, and an out-of-range index is the same
    // arithmetic — so a hand-edited `hairPreset: 900` lands on a real haircut.
    expect(clampPreset(0, 6)).toBe(0);
    expect(clampPreset(7, 6)).toBe(1);
    expect(clampPreset(-1, 6)).toBe(5);
    expect(clampPreset('3', 6), 'the string form the schema permits').toBe(3);
    expect(clampPreset('nonsense', 6)).toBe(0);
    expect(clampPreset(undefined, 6)).toBe(0);
    expect(clampPreset(3, 0), 'no presets, no crash').toBe(0);
  });

  it('always resolves to a preset that exists', () => {
    for (const raw of [900, -900, '2', null, undefined, {}, Number.NaN]) {
      const look = normalizeLook({ hairPreset: raw, facePreset: raw });
      expect(HAIR_PRESETS[look.hairPreset as number], String(raw)).toBeDefined();
      expect(FACE_PRESETS[look.facePreset as number], String(raw)).toBeDefined();
      expect(hairOf(look).name).toBeTruthy();
      expect(faceOf(look).name).toBeTruthy();
    }
  });

  it('survives being handed nonsense entirely', () => {
    for (const raw of [null, undefined, 7, 'look', []]) {
      expect(normalizeLook(raw), String(raw)).toEqual(defaultLook());
    }
  });
});

describe('who may be vowed to', () => {
  it('offers exactly the six founders, in discipline order', () => {
    expect(starterSpecies()).toEqual(PLAYABLE_SCHOOLS.map((s) => speciesForSchool(s)));
    expect(starterSpecies()).toHaveLength(6);
  });

  it('does not offer Lexis', () => {
    // The bug the browser caught. "Speaks exactly one school" reads like the founder rule
    // and is not: Lexis speaks one school too, and that school is **arcane** — the Hero
    // Deck's own colour, and not a discipline anybody enrols in. Picking it would have
    // produced a warband with no bodies of its own and a Grimoire in the same colour as
    // the half it exists to complement.
    expect(companionById('lexis')!.grimoire.schools, 'still mono, still not a discipline')
      .toHaveLength(1);
    expect(starterSpecies()).not.toContain('lexis');
    expect(isStarterSpecies('lexis')).toBe(false);
  });

  it('does not offer a hybrid', () => {
    expect(isStarterSpecies('chimera')).toBe(false);
    expect(starterSpecies().every((id) => companionById(id)!.grimoire.schools.length === 1)).toBe(
      true,
    );
  });

  it('corrects a save that names one anyway', () => {
    expect(normalizeLook({ starterCompanion: 'lexis' }).starterCompanion).toBe(
      defaultLook().starterCompanion,
    );
    expect(normalizeLook({ starterCompanion: 'chimera' }).starterCompanion).toBe(
      defaultLook().starterCompanion,
    );
    expect(normalizeLook({ starterCompanion: 'boreas' }).starterCompanion).toBe('boreas');
  });
});

describe('initializeNewProfile', () => {
  beforeEach(() => installStorage());

  const look = (over: Partial<CharacterLook> = {}): CharacterLook => ({
    ...defaultLook(),
    ...over,
  });

  it('writes the look down, normalised', () => {
    const p = initializeNewProfile('slot-1', look({
      nickname: '  Vessa Kade ',
      gender: 'male',
      hairPreset: 99,
      starterCompanion: 'sylva',
    }));
    expect(p.characterLook.nickname).toBe('Vessa Kade');
    expect(p.characterLook.gender).toBe('male');
    expect(p.characterLook.hairPreset).toBe(clampPreset(99, HAIR_PRESETS.length));
    expect(p.characterLook.starterCompanion).toBe('sylva');
  });

  it('files the commission under the nickname', () => {
    expect(initializeNewProfile('slot-1', look({ nickname: 'Vessa Kade' })).name).toBe('Vessa Kade');
  });

  it('starts broke', () => {
    const p = initializeNewProfile('slot-1', look());
    expect(p.state.overworld.economy.ducats).toBe(0);
    expect(p.state.overworld.economy.marrowShards).toBe(0);
  });

  it('starts with every gear slot bare, and the coat in the footlocker', () => {
    // The brief is explicit that equipped slots begin empty. The coat is still *owned*, so
    // the loadout screen is not an empty grid with nothing to teach — the player equips it
    // themselves, which is a better first lesson than finding it already on.
    const p = initializeNewProfile('slot-1', look());
    for (const slot of RELIC_SLOT_ORDER) {
      expect(p.state.overworld.equippedRelics[slot], slot).toBeNull();
    }
    expect(p.state.overworld.relics, 'owned, not worn').toContain('relic_coat');
  });

  it('tames the vowed bloodline and stands beside it', () => {
    for (const school of PLAYABLE_SCHOOLS) {
      const baseId = speciesForSchool(school)!;
      const p = initializeNewProfile('slot-1', look({ starterCompanion: baseId }));
      expect(p.companions, school).toHaveLength(1);
      expect(p.companions[0]!.baseId, school).toBe(baseId);
      expect(p.activeCompanionId, school).toBe(p.companions[0]!.instanceId);
    }
  });

  it('rolls that beast rather than issuing a fixture', () => {
    const seen = new Set(
      Array.from({ length: 25 }, () => {
        const b = initializeNewProfile('slot-1', look({ starterCompanion: 'boreas' })).companions[0]!;
        return `${b.baseHpRoll}|${b.traitId}|${b.grimoire.slice().sort().join(',')}`;
      }),
    );
    expect(seen.size, 'twenty-five desks, mostly distinct beasts').toBeGreaterThan(10);
  });

  it('grants the universal bodies and the vowed school, and nobody else’s', () => {
    const p = initializeNewProfile('slot-1', look({ starterCompanion: 'sylva' }));
    expect(p.rosterUnlocks, 'universal').toContain('vanguard_footman');
    expect(p.rosterUnlocks, 'its own').toContain('briar_wolf');
    expect(p.rosterUnlocks, 'not Frost').not.toContain('glacial_stalker');
    expect(validateRoster(p.roster, p.rosterUnlocks), 'and the line is legal').toEqual([]);
  });

  it('builds the fifteen: seven of theirs, eight of the beast’s', () => {
    for (const school of PLAYABLE_SCHOOLS) {
      const baseId = speciesForSchool(school)!;
      const p = initializeNewProfile('slot-1', look({ starterCompanion: baseId }));
      const hero = p.decks[baseId]!.cards;

      expect(hero, `${school} hero half`).toHaveLength(7);
      expect(p.companions[0]!.grimoire, `${school} grimoire`).toHaveLength(GRIMOIRE_SIZE);
      expect(fusedDeckSize(hero.length), `${school} fused`).toBe(15);
      expect(validateDeck(hero, p.collection), `${school} legality`).toEqual([]);

      // The Hero half stays colourless; the elemental colour is the beast's to bring.
      for (const id of hero) expect(HERO_SCHOOLS, `${school}: ${id}`).toContain(CARDS[id]!.school);
    }
    expect(STARTER_DECK, 'and that is where the seven come from').toHaveLength(7);
  });
});

describe('an older save at the desk', () => {
  beforeEach(() => installStorage());

  it('is handed a look synthesised from what it already knew', () => {
    const p = newProfile('slot-1', 'Old Hand', 'frost');
    const raw = JSON.parse(JSON.stringify({ ...emptySave(), profiles: { 'slot-1': p } }));
    // A v17 save has no such key at all.
    delete raw.profiles['slot-1'].characterLook;
    raw.version = 17;
    localStorage.setItem('conjure.save', JSON.stringify(raw));

    const back = loadSave().save.profiles['slot-1']!;
    expect(back.characterLook.nickname, 'their name').toBe('Old Hand');
    expect(back.characterLook.starterCompanion, 'the beast beside them').toBe('boreas');
    expect(back.characterLook.gender, 'and the default silhouette').toBe(defaultLook().gender);
  });

  it('round-trips a look it does have', () => {
    const p = initializeNewProfile('slot-1', {
      ...defaultLook(),
      nickname: 'Vessa Kade',
      gender: 'male',
      hairPreset: 3,
      facePreset: 2,
      starterCompanion: 'mortis',
    });
    const file: SaveFile = { ...emptySave(), profiles: { 'slot-1': p } };
    writeSave(file);

    expect(loadSave().save.profiles['slot-1']!.characterLook).toEqual(p.characterLook);
  });

  it('repairs a hand-edited look on the way in', () => {
    const p = initializeNewProfile('slot-1', defaultLook());
    const raw = JSON.parse(JSON.stringify({ ...emptySave(), profiles: { 'slot-1': p } }));
    raw.profiles['slot-1'].characterLook = { nickname: '', hairPreset: 900, starterCompanion: 'lexis' };
    localStorage.setItem('conjure.save', JSON.stringify(raw));

    const look = loadSave().save.profiles['slot-1']!.characterLook;
    expect(look.nickname).toBe(DEFAULT_NICKNAME);
    expect(HAIR_PRESETS[look.hairPreset as number]).toBeDefined();
    expect(look.starterCompanion, 'not a discipline').not.toBe('lexis');
  });
});

/**
 * A canvas context that writes down what it was told to do.
 *
 * Enough of the 2D API for the sprite code to run, and nothing else. The transcript it
 * builds is what the assertions compare — which is a better test than a pixel diff, because
 * it fails when the *shape* changes and not when somebody adjusts a hair colour.
 */
function recordingContext(): { ctx: CanvasRenderingContext2D; log: string[] } {
  const log: string[] = [];
  const round = (n: unknown): string => (typeof n === 'number' ? n.toFixed(2) : String(n));
  const note =
    (name: string) =>
    (...args: unknown[]): void => {
      log.push(`${name}(${args.map(round).join(',')})`);
    };

  const ctx = {
    beginPath: note('beginPath'),
    closePath: note('closePath'),
    moveTo: note('moveTo'),
    lineTo: note('lineTo'),
    quadraticCurveTo: note('quadraticCurveTo'),
    arc: note('arc'),
    ellipse: note('ellipse'),
    fill: note('fill'),
    stroke: note('stroke'),
    fillRect: note('fillRect'),
    save: note('save'),
    restore: note('restore'),
    translate: note('translate'),
    scale: note('scale'),
    set fillStyle(v: string) {
      log.push(`fillStyle=${v}`);
    },
    set strokeStyle(v: string) {
      log.push(`strokeStyle=${v}`);
    },
    set lineWidth(v: number) {
      log.push(`lineWidth=${round(v)}`);
    },
    set globalCompositeOperation(v: string) {
      log.push(`gco=${v}`);
    },
  } as unknown as CanvasRenderingContext2D;

  return { ctx, log };
}

function transcript(look: CharacterLook): string {
  const { ctx, log } = recordingContext();
  drawCommander(ctx, 80, look);
  return log.join('|');
}

/**
 * The same transcript with every colour stripped out — geometry only.
 *
 * Needed because the full transcript is too easy to satisfy. Hair tone and skin tone are
 * indexed by the same preset, so six haircuts could collapse to *one shape in six colours*
 * and the colours alone would keep the transcripts distinct. A mutation that pinned every
 * head to `crop` proved exactly that and went unnoticed. This asks the question that
 * actually matters: does the silhouette change?
 */
function shapeOf(look: CharacterLook): string {
  const { ctx, log } = recordingContext();
  drawCommander(ctx, 80, look);
  return log.filter((line) => !/^(fillStyle|strokeStyle|lineWidth)=/.test(line)).join('|');
}

describe('the sprite on the stage', () => {
  it('draws a different silhouette for every hair', () => {
    // The claim Step 1 is built on: the figure on the diorama *is* the character, so
    // cycling a preset has to change what is drawn. Two presets that rendered identically
    // would be a choice the player cannot see themselves making.
    //
    // Asserted on geometry, not on the full transcript — see `shapeOf`. Six haircuts in
    // six colours that are all the same shape is the failure worth catching.
    const shapes = HAIR_PRESETS.map((_, i) => shapeOf({ ...defaultLook(), hairPreset: i }));
    expect(new Set(shapes).size, 'six distinct heads').toBe(HAIR_PRESETS.length);
  });

  it('draws a different face for every face', () => {
    const shapes = FACE_PRESETS.map((_, i) => shapeOf({ ...defaultLook(), facePreset: i }));
    expect(new Set(shapes).size, 'four distinct faces').toBe(FACE_PRESETS.length);
  });

  it('gives each preset its own colour as well as its own shape', () => {
    // Both halves matter, and they are separate claims: the shape is what reads across the
    // room, the tone is what makes two silhouettes feel like different people.
    const hairTones = HAIR_PRESETS.map((_, i) => transcript({ ...defaultLook(), hairPreset: i }));
    expect(new Set(hairTones).size).toBe(HAIR_PRESETS.length);
    const skinTones = FACE_PRESETS.map((_, i) => transcript({ ...defaultLook(), facePreset: i }));
    expect(new Set(skinTones).size).toBe(FACE_PRESETS.length);
  });

  it('draws the two bearings differently', () => {
    expect(shapeOf({ ...defaultLook(), gender: 'male' }), 'a silhouette, not a palette').not.toBe(
      shapeOf({ ...defaultLook(), gender: 'female' }),
    );
  });

  it('draws the same look the same way twice', () => {
    // No randomness in the sprite. A figure that shimmered between frames would read as a
    // bug rather than as a character.
    expect(transcript(defaultLook())).toBe(transcript(defaultLook()));
  });

  it('draws something for a look that has been tampered with', () => {
    const wild = { ...defaultLook(), hairPreset: 900, facePreset: -7 } as CharacterLook;
    expect(transcript(wild).length, 'no crash, and not an empty canvas').toBeGreaterThan(50);
  });

  it('gives each school its own beast colour', () => {
    const drawn = PLAYABLE_SCHOOLS.map((school) => {
      const { ctx, log } = recordingContext();
      drawCompanion(ctx, 80, school);
      return log.join('|');
    });
    expect(new Set(drawn).size, 'six distinct beasts').toBe(PLAYABLE_SCHOOLS.length);
  });
});
