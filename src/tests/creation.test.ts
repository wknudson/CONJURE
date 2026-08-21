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
import {
  RAMP,
  SCHOOL_COLOR,
  drawCompanion,
  paintCommander,
} from '../render/sprites.js';
import { PALETTE } from '../render/palette.js';
import { FOCUS_FAR, FOCUS_NEAR, projectTile } from '../render/Diorama.js';
import {
  BEAST_AT,
  HERO_AT,
  SHOT_IDENTITY,
  SHOT_VOW,
} from '../app/CharacterCreationScreen.js';

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
    set globalAlpha(v: number) {
      log.push(`alpha=${round(v)}`);
    },
    set shadowColor(v: string) {
      log.push(`shadowColor=${v}`);
    },
    set shadowBlur(v: number) {
      log.push(`shadowBlur=${round(v)}`);
    },
  } as unknown as CanvasRenderingContext2D;

  return { ctx, log };
}

function transcript(look: CharacterLook): string {
  const { ctx, log } = recordingContext();
  paintCommander(ctx, 80, look);
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
  paintCommander(ctx, 80, look);
  return log
    .filter((line) => !/^(fillStyle|strokeStyle|lineWidth|alpha|shadow\w+)=/.test(line))
    .join('|');
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

  it('keeps the Commander off the colour of the ground', () => {
    // The legs were `#2A2F3A` — byte-identical to `PALETTE.tileA`, the floor they stand on.
    // At diorama distance the figure would have ended at the coat hem with two boots
    // floating under it. A sprite has to be pickable out of its own background first.
    const ground = [PALETTE.tileA, PALETTE.tileB, PALETTE.bg].map((c) => c.toLowerCase());
    for (const [name, hex] of Object.entries(RAMP)) {
      expect(ground, `${name} is the ground`).not.toContain(hex.toLowerCase());
    }
  });

  it('has a body: arms, hands, legs and boots', () => {
    // What the reference silhouettes have that this sprite did not. It was a trapezoid with
    // a head on it; arms are what make a shape a person, and they are two rects and two
    // squares. Measured on a real canvas at 90 units: 104px of leg, 314px of boot, 72px of
    // hand — all of it absent before.
    const t = transcript(defaultLook());
    expect(t, 'trousers').toContain(`fillStyle=${RAMP.trouser}`);
    expect(t, 'and their shadow side').toContain(`fillStyle=${RAMP.trouserDark}`);
    expect(t, 'boots').toContain(`fillStyle=${RAMP.boot}`);
    // Four limb rects plus two boots plus two hands. `fillRect` count is the cheap proxy,
    // and it is the one that goes to zero if somebody deletes the arms.
    expect((t.match(/fillRect\(/g) ?? []).length, 'limbs drawn').toBeGreaterThanOrEqual(8);
  });

  it('wears the Magistracy until a discipline is vowed to, then wears that', () => {
    // The cloak is the largest colour region on the figure — 502px against a 48x104 body —
    // so this is the most visible thing the Vow changes.
    const plain = transcript(defaultLook());
    expect(plain, 'indigo by default').toContain(`fillStyle=${RAMP.cloak}`);

    const { ctx, log } = recordingContext();
    paintCommander(ctx, 80, defaultLook(), SCHOOL_COLOR.frost!);
    const vowed = log.join('|');
    expect(vowed, 'and the school once there is one').toContain(`fillStyle=${SCHOOL_COLOR.frost}`);
    expect(vowed, 'the Magistracy indigo is gone').not.toContain(`fillStyle=${RAMP.cloak}`);
  });

  it('never erases, in any style', () => {
    // The bug this guards. `shorn` used to cut its shape with `destination-out`, which does
    // not remove "the hair" — it removes pixels, and the sprite is drawn straight onto a
    // diorama that already has sky and ground on it. A Shorn Commander arrived with a hole
    // bitten through their skull and the landscape behind it: 782 transparent pixels on a
    // 200x200 probe, against zero for every other preset.
    //
    // Asserted on the transcript rather than on pixels so it holds without a canvas, and so
    // it catches the *next* style that reaches for the same trick.
    for (const [i, preset] of HAIR_PRESETS.entries()) {
      const t = transcript({ ...defaultLook(), hairPreset: i });
      expect(t, `${preset.name} erases`).not.toContain('gco=destination-out');
    }
  });

  it('shades the coat rather than filling it flat', () => {
    // Two panels, two values, one break down the centre line. A single fill is a garment
    // with no body under it.
    const t = transcript(defaultLook());
    const fills = [...t.matchAll(/fillStyle=(#[0-9A-Fa-f]{6})/g)].map((m) => m[1]!);
    expect(new Set(fills).size, 'more than one tone on the figure').toBeGreaterThan(3);
    expect(t, 'a lit panel').toContain(`fillStyle=${RAMP.coatLight}`);
    expect(t, 'and a shadow panel').toContain(`fillStyle=${RAMP.coatDark}`);
  });

  it('keeps the value ramp in order', () => {
    // Read off `RAMP` itself, not off hex literals pasted in here — a test that compares two
    // strings it typed proves only that the test author can subtract, and this one was
    // exactly that until a mutation walked straight through it.
    //
    // The rule: the ink line must sit *below* the shadow panel, or an outline darker than
    // the form flattens the very break it is drawn around; and the shadow must sit below
    // the lit side, or there is no break at all.
    const value = (hex: string): number =>
      Number.parseInt(hex.slice(1, 3), 16) +
      Number.parseInt(hex.slice(3, 5), 16) +
      Number.parseInt(hex.slice(5, 7), 16);

    expect(value(RAMP.coatInk), 'ink under shadow').toBeLessThan(value(RAMP.coatDark));
    // And *not far* under it. "Below the shadow panel" alone permits pure black, which is
    // the failure the ink line was lightened to avoid: an outline that reads as a void
    // rather than as an edge flattens the form it surrounds. So the ink has to sit nearer
    // its own shadow panel than it does to black.
    expect(
      value(RAMP.coatDark) - value(RAMP.coatInk),
      'an edge, not a void',
    ).toBeLessThan(value(RAMP.coatInk));
    expect(value(RAMP.coatDark), 'shadow under lit').toBeLessThan(value(RAMP.coatLight));
    expect(value(RAMP.brass), 'brass under its own highlight').toBeLessThan(value(RAMP.brassLit));
    expect(value(RAMP.rim), 'and the key light is the brightest thing on the figure')
      .toBeGreaterThan(value(RAMP.coatLight));
  });

  it('highlights the brass rather than filling it flat', () => {
    // Both marks are `fillRect` now, not a triangle and a stroke. At 44 art-pixels the whole
    // chest is four pixels tall, and the old three-pixel triangle anti-aliased into mud —
    // measured at literally zero pixels within tolerance of the brass colour on a real
    // canvas. Anything meant to read at this resolution is axis-aligned and >= 2px thick.
    const t = transcript(defaultLook());
    expect(t, 'the metal').toContain(`fillStyle=${RAMP.brass}`);
    expect(t, 'and the catch of light along its top row').toContain(`fillStyle=${RAMP.brassLit}`);
  });

  it('catches a rim light down the lit side', () => {
    const t = transcript(defaultLook());
    expect(t, 'the key light').toContain(`fillStyle=${RAMP.rim}`);
    // Near-opaque, not 0.55. A translucent 1px stroke measured 28 pixels on the whole figure
    // — in the transcript and not on the screen. Still under 1, so it reads as light rather
    // than as a drawn outline.
    expect(t, 'as light, not as an outline').toContain('alpha=0.85');
  });

  it('lights the beast’s eye rather than dotting it', () => {
    const { ctx, log } = recordingContext();
    drawCompanion(ctx, 80, 'frost');
    const t = log.join('|');
    expect(t, 'a source').toContain('shadowColor=#6FB6D8');
    expect(t.match(/shadowBlur=/g), 'blurred once, and turned off again').toHaveLength(1);
    expect(t, 'and restored, so nothing downstream inherits it').toContain('restore()');
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

describe('the shot', () => {
  const W = 1280;
  const H = 720;

  it('keeps every actor inside the sharp band', () => {
    // The bug this exists for. The tilt-shift band was 0.34–0.62 — across the middle of the
    // frame, which is where such a band belongs in the abstract and is nowhere near where
    // anything in this scene stands. The Commander spans 0.68 to 0.81 and the beast lands
    // at 0.88, so every actor sat inside the blur: the subject of the shot was the one
    // thing out of focus, and it was erasing the finest marks on the sprite. The 2px brass
    // collar measured **zero** pixels on the live canvas against 48 in an unblurred probe.
    for (const [name, at, cam] of [
      ['Commander, step I', HERO_AT, SHOT_IDENTITY],
      ['Commander, step II', HERO_AT, SHOT_VOW],
      ['the beast', BEAST_AT, SHOT_VOW],
    ] as const) {
      const feet = projectTile(at.x, at.y, cam, W, H).y / H;
      // The head is up to a figure-height above the feet; both ends have to be sharp.
      const head = (projectTile(at.x, at.y, cam, W, H).y - (H / 9) * 1.15) / H;

      expect(feet, `${name}: feet below the band`).toBeLessThanOrEqual(FOCUS_FAR);
      expect(head, `${name}: head above the band`).toBeGreaterThanOrEqual(FOCUS_NEAR);
    }
  });

  it('still blurs something at both edges', () => {
    // A band covering the whole frame is not tilt-shift, it is a plain picture. There has to
    // be falloff at the top (the far ground and sky) and at the bottom (the nearest edge).
    expect(FOCUS_NEAR, 'sky and far ground blur').toBeGreaterThan(0.05);
    expect(FOCUS_FAR, 'the front edge blurs').toBeLessThan(0.99);
    expect(FOCUS_FAR - FOCUS_NEAR, 'and the band is a band').toBeLessThan(0.7);
  });
});
