import { readdirSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_NICKNAME,
  NICKNAME_MAX,
  defaultLook,
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
  STARTING_DUCATS,
  initializeNewProfile,
  loadSave,
  newProfile,
  writeSave,
  type SaveFile,
} from '../app/save.js';
import { TIER_WAGER } from '../core/data/bounties.js';
import {
  COMMANDER_HEIGHT_TILES,
  COMPANION_HEIGHT_TILES,
  commanderSpriteSrc,
  companionSpriteSrc,
  drawCompanion,
} from '../render/sprites.js';
import { FOCUS_FAR, FOCUS_NEAR, focusBand, projectTile } from '../render/Diorama.js';
import {
  BEAST_AT,
  HERO_AT,
  SHOT_IDENTITY,
  SHOT_VOW,
} from '../app/CharacterCreationScreen.js';

/**
 * Character creation: the desk, and what walks away from it.
 *
 * The sprite half of this suite used to be its largest part — some twenty-eight tests
 * asserting that a procedural painter gave every haircut its own silhouette, put a catchlight
 * in both eyes, and shaded a coat in three discrete bands. That painter is gone; the Commander
 * and the beast are authored PNGs now, and there is no honest bitmap equivalent of those
 * claims. A `drawImage` transcript can only say that one image was blitted at one size, which
 * is not worth twenty-eight tests.
 *
 * What replaces them is the pair of questions that *can* go wrong now and could not before:
 * **is the file the loader asks for actually on disk**, and **is the figure it draws inside
 * the frame**. The second one already had a real bug in it.
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
    // randomised opening state makes a deliberate choice read as a reroll.
    expect(defaultLook()).toEqual(defaultLook());
    expect(defaultLook().nickname).toBe(DEFAULT_NICKNAME);
  });

  it('carries no gear, by construction', () => {
    // The brief's one prohibition, and the schema is where it has to hold: optics,
    // vestment, trinket, treads and will are earned, and a creator that could set them
    // would be spending the reward before the first contract.
    const keys = Object.keys(defaultLook());
    for (const slot of RELIC_SLOT_ORDER) expect(keys, slot).not.toContain(slot);
    expect(keys.sort()).toEqual(['gender', 'nickname', 'starterCompanion']);
  });

  it('drops the presets an older save still carries', () => {
    // Hair, face and skin were three cycler-driven indices and are now not fields at all.
    // The contract for a save still holding them is *ignore*, not migrate — there is no
    // sheet to pick a haircut out of by index, so the honest answer to `hairPreset: 3` is
    // that the question stopped existing rather than that it resolves to something.
    const look = normalizeLook({
      nickname: 'Vessa Kade',
      gender: 'male',
      hairPreset: 3,
      facePreset: 2,
      skinPreset: 5,
      starterCompanion: 'mortis',
    });
    expect(Object.keys(look).sort()).toEqual(['gender', 'nickname', 'starterCompanion']);
    expect(look.nickname, 'while keeping what does still exist').toBe('Vessa Kade');
    expect(look.gender).toBe('male');
    expect(look.starterCompanion).toBe('mortis');
  });

  it('trims and caps a nickname, and never accepts a blank one', () => {
    expect(normalizeLook({ nickname: '  Vessa Kade  ' }).nickname).toBe('Vessa Kade');
    expect(normalizeLook({ nickname: 'x'.repeat(80) }).nickname).toHaveLength(NICKNAME_MAX);
    expect(normalizeLook({ nickname: '   ' }).nickname).toBe(DEFAULT_NICKNAME);
    expect(normalizeLook({ nickname: 42 }).nickname).toBe(DEFAULT_NICKNAME);
  });

  it('takes only the two bearings it offers', () => {
    // Two, and exactly two, because there are two sprite sheets. This is the one look field
    // that still changes what is drawn, so an unknown value has to land on a real file.
    expect(normalizeLook({ gender: 'male' }).gender).toBe('male');
    expect(normalizeLook({ gender: 'wyvern' }).gender).toBe(defaultLook().gender);
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

/**
 * The art the screen asks for, against the art that exists.
 *
 * The whole class of failure the bitmap rewrite introduced and the procedural version could
 * not have: a path is a string, a filename is a fact, and nothing but a test compares them.
 * A miss here is a body that silently does not render — `drawCommander` treats a null image
 * as "skip this frame", so a typo'd path is an empty stage rather than an error.
 */
describe('the art on disk', () => {
  const PUBLIC = new URL('../../public/', import.meta.url);

  /**
   * Whether a path the loader will request exists, matching case **exactly**.
   *
   * Compared against a directory listing rather than asked with `existsSync`, because
   * `existsSync` answers case-insensitively on Windows and macOS. The art arrived as
   * capitalised exports and was renamed down; a leftover `Ignis-front.png` would pass on
   * every developer machine here and 404 the moment it is served from Linux.
   */
  function isShipped(src: string): boolean {
    const cut = src.lastIndexOf('/');
    const dir = new URL(src.slice(1, cut + 1), PUBLIC);
    return readdirSync(dir).includes(src.slice(cut + 1));
  }

  it('has a front sprite for every bloodline that may be vowed to', () => {
    for (const baseId of starterSpecies()) {
      expect(isShipped(companionSpriteSrc(baseId)), companionSpriteSrc(baseId)).toBe(true);
    }
  });

  it('has a front sprite for both bearings', () => {
    for (const gender of ['female', 'male'] as const) {
      expect(isShipped(commanderSpriteSrc(gender)), commanderSpriteSrc(gender)).toBe(true);
    }
  });

  it('ships no raw export alongside the sprites it actually uses', () => {
    // The background-removal exports are 250KB each and referenced by nothing, and
    // everything under `public/` is served. They live in `art-source/` at the repo root
    // instead — kept, versioned, and not downloaded by a player.
    const dirs = ['assets/sprites/', 'assets/sprites/companions/'];
    for (const dir of dirs) {
      const raw = readdirSync(new URL(dir, PUBLIC)).filter((f) => f.includes('removebg'));
      expect(raw, dir).toEqual([]);
    }
  });

  it('has every facing the street walks, for both bearings', () => {
    // The district turns the Commander as they walk, so all four frames are load-bearing
    // now rather than reserved. `side-alt` is the second step of the walk cycle; there is
    // deliberately no `left`, which is `side` mirrored by the caller.
    for (const gender of ['female', 'male'] as const) {
      for (const facing of ['front', 'back', 'side', 'side-alt'] as const) {
        const src = commanderSpriteSrc(gender, facing);
        expect(isShipped(src), src).toBe(true);
      }
    }
  });

  it('has every facing the follower walks, for every bloodline that may be vowed to', () => {
    for (const baseId of starterSpecies()) {
      for (const facing of ['front', 'side', 'back'] as const) {
        const src = companionSpriteSrc(baseId, facing);
        expect(isShipped(src), src).toBe(true);
      }
    }
  });
});

describe('the beast fallback', () => {
  /**
   * A canvas context that writes down what it was told to do.
   *
   * All that survives of the old sprite-transcript approach, and it is still the right tool
   * for the one thing left that draws shapes rather than blitting a file: `drawCompanion`,
   * the silhouette a species with no art yet falls back to.
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
      fill: note('fill'),
      stroke: note('stroke'),
      fillRect: note('fillRect'),
      save: note('save'),
      restore: note('restore'),
      set fillStyle(v: string) {
        log.push(`fillStyle=${v}`);
      },
      set strokeStyle(v: string) {
        log.push(`strokeStyle=${v}`);
      },
      set lineWidth(v: number) {
        log.push(`lineWidth=${round(v)}`);
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
      starterCompanion: 'sylva',
    }));
    expect(p.characterLook.nickname).toBe('Vessa Kade');
    expect(p.characterLook.gender).toBe('male');
    expect(p.characterLook.starterCompanion).toBe('sylva');
  });

  it('files the commission under the nickname', () => {
    expect(initializeNewProfile('slot-1', look({ nickname: 'Vessa Kade' })).name).toBe('Vessa Kade');
  });

  it('starts with the opening duel’s stake and nothing else', () => {
    // The Novice contract is the only posting that asks for a buy-in, so an empty purse
    // would leave a new Commander able to take every fight except the beginner's one.
    const p = initializeNewProfile('slot-1', look());
    expect(p.state.overworld.economy.ducats).toBe(STARTING_DUCATS);
    expect(p.state.overworld.economy.ducats).toBeGreaterThanOrEqual(TIER_WAGER.novice);
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
    expect(back.characterLook.gender, 'and the default bearing').toBe(defaultLook().gender);
  });

  it('round-trips a look it does have', () => {
    const p = initializeNewProfile('slot-1', {
      ...defaultLook(),
      nickname: 'Vessa Kade',
      gender: 'male',
      starterCompanion: 'mortis',
    });
    const file: SaveFile = { ...emptySave(), profiles: { 'slot-1': p } };
    writeSave(file);

    expect(loadSave().save.profiles['slot-1']!.characterLook).toEqual(p.characterLook);
  });

  it('loads a save still carrying the retired presets, without them', () => {
    // The migration that deliberately is not one. A save written before the bitmaps holds
    // three keys nothing reads; loading it must produce a clean three-field look rather
    // than either carrying the dead weight forward or failing on it.
    const p = initializeNewProfile('slot-1', defaultLook());
    const raw = JSON.parse(JSON.stringify({ ...emptySave(), profiles: { 'slot-1': p } }));
    raw.profiles['slot-1'].characterLook = {
      nickname: 'Old Hand',
      gender: 'male',
      hairPreset: 3,
      facePreset: 2,
      skinPreset: 5,
      starterCompanion: 'mortis',
    };
    localStorage.setItem('conjure.save', JSON.stringify(raw));

    const look = loadSave().save.profiles['slot-1']!.characterLook;
    expect(Object.keys(look).sort()).toEqual(['gender', 'nickname', 'starterCompanion']);
    expect(look.nickname).toBe('Old Hand');
    expect(look.starterCompanion).toBe('mortis');
  });

  it('repairs a hand-edited look on the way in', () => {
    const p = initializeNewProfile('slot-1', defaultLook());
    const raw = JSON.parse(JSON.stringify({ ...emptySave(), profiles: { 'slot-1': p } }));
    raw.profiles['slot-1'].characterLook = { nickname: '', starterCompanion: 'lexis' };
    localStorage.setItem('conjure.save', JSON.stringify(raw));

    const look = loadSave().save.profiles['slot-1']!.characterLook;
    expect(look.nickname).toBe(DEFAULT_NICKNAME);
    expect(look.starterCompanion, 'not a discipline').not.toBe('lexis');
    expect(look.gender, 'and a bearing that has a sprite').toBe(defaultLook().gender);
  });
});

describe('the shot', () => {
  const W = 1280;
  const H = 720;

  /**
   * The cast at each framing, with the heights the draw code actually uses.
   *
   * Imported rather than written as literals, and that is the point of exporting them: this
   * block used to say `height: 1.15` while `drawCommander` blitted `1.7`, so every assertion
   * below was checking a figure a fifth shorter than the one on screen — which is exactly how
   * a clipped head passed a test suite that contained a test for the head being in the band.
   */
  const framings = [
    ['step I', SHOT_IDENTITY, [{ ...HERO_AT, height: COMMANDER_HEIGHT_TILES }]],
    [
      'step II',
      SHOT_VOW,
      [
        { ...HERO_AT, height: COMMANDER_HEIGHT_TILES },
        { ...BEAST_AT, height: COMPANION_HEIGHT_TILES },
      ],
    ],
  ] as const;

  it('keeps every actor inside the sharp band, at either framing', () => {
    // The band is **derived** from the cast rather than written as constants. Constants were
    // correct until somebody moved the camera, and then silently wrong in a way that looks
    // like a blurry sprite rather than a misplaced focus. Asking the same function the
    // renderer asks means the subject is sharp by construction, at any framing.
    for (const [name, cam, cast] of framings) {
      const actors = cast.map((a) => ({ ...a, draw: () => {} }));
      const band = focusBand(actors, cam, W, H);

      for (const a of actors) {
        const at = projectTile(a.x, a.y, cam, W, H);
        const tall = ((H / 9) * at.scale * a.height) / H;
        expect(at.y / H, `${name}: feet below the band`).toBeLessThanOrEqual(band.far);
        expect(at.y / H - tall, `${name}: head above the band`).toBeGreaterThanOrEqual(band.near);
      }
    }
  });

  it('keeps every actor inside the frame, at either framing', () => {
    // The regression test for a bug that shipped. At the old `zoom: 1.8` the Commander's feet
    // landed at 0.410 of frame height and the sprite blitted 0.470 tall, putting the top of
    // their head 44 pixels *above* the frame — the figure was decapitated at every window
    // size, and nothing asked. Feet on screen is not the same claim as body on screen.
    for (const [name, cam, cast] of framings) {
      for (const a of cast) {
        const at = projectTile(a.x, a.y, cam, W, H);
        const tall = (H / 9) * at.scale * a.height;
        expect(at.y - tall, `${name}: crown inside the frame`).toBeGreaterThan(H * 0.02);
        expect(at.y, `${name}: feet inside the frame`).toBeLessThan(H * 0.98);
      }
    }
  });

  it('stands the Commander in the exact middle at Step I', () => {
    // Exact, not approximate, and it stays exact if the zoom is ever retuned: the camera
    // sits on the Commander's own tile, so `dx` is zero and the projection cannot drift.
    // The framing this replaced offset the camera to clear a panel and needed a hand-derived
    // constant (`HERO_AT.x + 0.5 / zoom`) recomputed on every zoom change to stay put.
    expect(SHOT_IDENTITY.x).toBe(HERO_AT.x);
    expect(projectTile(HERO_AT.x, HERO_AT.y, SHOT_IDENTITY, W, H).x).toBe(W / 2);

    // And the scale is the zoom, because the camera is exactly `EYE` from the subject.
    expect(projectTile(HERO_AT.x, HERO_AT.y, SHOT_IDENTITY, W, H).scale).toBeCloseTo(
      SHOT_IDENTITY.zoom,
      10,
    );
  });

  it('gives Step I a figure big enough to read, and room under it for the form', () => {
    const at = projectTile(HERO_AT.x, HERO_AT.y, SHOT_IDENTITY, W, H);
    const figure = (H / 9) * at.scale * COMMANDER_HEIGHT_TILES;
    expect(figure, 'over half the frame tall').toBeGreaterThan(H / 2);

    // The composition the stylesheet depends on: the feet land high enough that the docked
    // form bar has a strip of empty stage to sit in rather than covering the boots.
    expect(at.y / H, 'feet clear of the bottom quarter').toBeLessThan(0.78);

    // And Step II stays wider, because it has a second body to fit in.
    const wide = projectTile(HERO_AT.x, HERO_AT.y, SHOT_VOW, W, H);
    expect(at.scale, 'Step I is the closer shot').toBeGreaterThan(wide.scale);
  });

  it('leaves the middle of the frame to the cast at Step II', () => {
    // The rail goes left and the card goes right specifically so the pair are visible between
    // them. Both bodies have to land in that channel or the pan that reveals them is showing
    // the player a panel. These bounds are the channel the stylesheet actually leaves at this
    // width — they are what caps `SHOT_VOW.zoom`, so a wider panel should fail here.
    for (const at of [BEAST_AT, HERO_AT]) {
      const p = projectTile(at.x, at.y, SHOT_VOW, W, H);
      expect(p.x, 'right of the rail').toBeGreaterThan(W * 0.2);
      expect(p.x, 'left of the card').toBeLessThan(W * 0.68);
    }
  });

  it('draws the Step II pair big enough to be the subject', () => {
    // The point of the two-shot. At `zoom: 1` the Commander was 121px on a 720p frame and the
    // beast 73px — both on screen, neither worth looking at, staging the one irreversible
    // choice in the game as a wide establishing shot.
    const hero = projectTile(HERO_AT.x, HERO_AT.y, SHOT_VOW, W, H);
    const beast = projectTile(BEAST_AT.x, BEAST_AT.y, SHOT_VOW, W, H);
    const heroTall = (H / 9) * hero.scale * COMMANDER_HEIGHT_TILES;
    const beastTall = (H / 9) * beast.scale * COMPANION_HEIGHT_TILES;

    expect(heroTall, 'the Commander').toBeGreaterThan(H * 0.35);
    expect(beastTall, 'the beast').toBeGreaterThan(H * 0.2);

    // And they stand apart rather than overlapping. The gap has to survive the *widest* beast
    // art — Voltara is 276x211, so at a shared height it is nearly three times Sylva's width,
    // and a framing tuned on a narrow beast puts a wide one through the Commander.
    const gap =
      beast.x - (beastTall * (276 / 211)) / 2 - (hero.x + (heroTall * (125 / 288)) / 2);
    expect(gap, 'clear of each other, even at the widest').toBeGreaterThan(0);
  });

  it('still blurs something at both edges', () => {
    // A band covering the whole frame is not tilt-shift, it is a plain picture. There has to
    // be falloff at the top (the far ground and sky) and at the bottom (the nearest edge).
    expect(FOCUS_NEAR, 'sky and far ground blur').toBeGreaterThan(0.05);
    expect(FOCUS_FAR, 'the front edge blurs').toBeLessThan(0.99);
    expect(FOCUS_FAR - FOCUS_NEAR, 'and the band is a band').toBeLessThan(0.7);
  });
});
