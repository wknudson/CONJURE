/**
 * The people of Azo, and where each of them is on a sheet.
 *
 * Forty-eight townsfolk arrived as four PNGs, each a rough 3x4 grid named by its contents,
 * and the eleven wager duelists followed on a fifth cut the same way.
 * This is the one place that knows their names, which sheet each is on, how it must be
 * filtered, and how tall to stand it. The boxes themselves come from
 * `folkContent.generated.ts` — measured off the alpha channel rather than divided out of a
 * grid, because the grid is not regular; see `scripts/measure-folk-sheets.ts` for what went
 * wrong when it was assumed to be.
 *
 * Deliberately free of DOM and three.js. `district/map.ts` imports `FolkId` to type an area's
 * cast list, and a data module reaching into the renderer would be the wrong way round; the
 * tests also run this under node, where neither exists. The loading lives in `sprites.ts` and
 * the texture cutting in `district/textures.ts`.
 */

import { FOLK_BOXES } from './folkContent.generated.js';
import { assetUrl } from './assetUrl.js';

/** Which of the five sheets. */
export type FolkSheetId = 'painted' | 'trades' | 'crafts' | 'alts' | 'duelists';

/** Everyone drawn, by id. The keys of the generated table, so the two cannot drift. */
export type FolkId = keyof typeof FOLK_BOXES;

export interface FolkSheet {
  /** The file as it sits in `public/assets/sprites/`, verbatim. */
  readonly file: string;
  /**
   * Whether this art is pixel art, which decides how it is filtered.
   *
   * The codebase already draws this line deliberately (`district/textures.ts`): painted work
   * gets linear filtering and mipmaps, pixel art gets nearest and none. Running all four
   * sheets through one filter would either blur the pixel sheets' hard edges or stair-step
   * the painted one's gradients, and there is no setting that is right for both.
   */
  readonly pixelArt: boolean;
}

/**
 * The five sheets, under the names the artist filed them as.
 *
 * The filenames are the manifest — each one lists its own twelve in order — so they are kept
 * verbatim rather than tidied into `townsfolk-2.png`. Two of them contain spaces, which is
 * why `folkSheetSrc` encodes: a raw space survives the dev server on Windows and 404s behind
 * a stricter static host, which is exactly the class of failure that only shows up in
 * production.
 */
export const FOLK_SHEETS: Record<FolkSheetId, FolkSheet> = {
  painted: {
    file: 'Elder_Blacksmith_HealerPrincess_Shopkeeper_FarmerWife_FarmerDaughter_FemaleMercenary_ScribeScholar_MinerA_MinerB_Bard_TownGuard.png',
    pixelArt: false,
  },
  trades: {
    file: 'Blacksmith_Weaver_Potter_Glassblower_Innkeeper_Baker_Grocer_Scribe_TownCrier_Herbalist_BardB_NightWatchman.png',
    pixelArt: true,
  },
  crafts: {
    file: 'Butcher_Seamstress_Carpenter_Fisherman_Brewer_Cobbler_Alchemist_Apothecary_Jeweler_Cartographer_ChildBeggar_Noblewoman.png',
    pixelArt: true,
  },
  alts: {
    file: 'ButcherB_BrewerB_Fishmonger_Taylor_CobblerB_Town GuardB_Miller_Harold_CartographerB_Tax Collector_Tanner_Street Urchin.png',
    pixelArt: true,
  },
  // The wager duels' opponents, on the campaign's own ladder: four Novice wanderers, four
  // Adept journeymen, three Master duelists. Five of the eleven stand at the duel sites
  // (`district/sites.ts` names which); the other six are the bench the next duel is cast
  // from. Same pixel style as the trades sheets, so the same filtering rule.
  duelists: {
    file: 'NoviceWandererA_NoviceWandererB_NoviceWandererC_NoviceWanderD_AdeptJourneymanA_AdeptJourneymanB_AdeptJourneymanC_AdeptJourneymanD_MasterDuelistA_MasterDuelistB_MasterDuelistC.png',
    pixelArt: true,
  },
};

/** Where the browser fetches a sheet from. The only place these paths are built. */
export function folkSheetSrc(id: FolkSheetId): string {
  return encodeURI(assetUrl(`assets/sprites/${FOLK_SHEETS[id].file}`));
}

export const FOLK_IDS = Object.keys(FOLK_BOXES) as FolkId[];

export function isFolkId(id: string): id is FolkId {
  return Object.prototype.hasOwnProperty.call(FOLK_BOXES, id);
}

export function folkSheetOf(id: FolkId): FolkSheetId {
  return FOLK_BOXES[id].sheet as FolkSheetId;
}

/** The rectangle to cut out of that sheet, in sheet pixels. */
export function folkBox(id: FolkId): { x: number; y: number; w: number; h: number } {
  const b = FOLK_BOXES[id];
  return { x: b.x, y: b.y, w: b.w, h: b.h };
}

/**
 * How tall a townsperson stands, in world units.
 *
 * A little under the Commander's 2.1, which is the point: the player should read as the
 * tallest thing on a street of ordinary people without anyone looking like a child.
 */
export const FOLK_HEIGHT = 1.95;

/**
 * Per-figure height corrections, for art whose box is taller than its person.
 *
 * A box is only ever as tall as the tallest thing in the drawing, and a few of these people
 * hold something above their own head — a spear, a halberd, a banner, a raised bell. Drawn to
 * one `FOLK_HEIGHT` they would stand noticeably shorter than everybody else, because a
 * tenth of their box is pole. Scaling the box up puts the *body* back on the same eye line
 * and lets the weapon stick up where the artist drew it.
 *
 * Width needs no equivalent. Several of the pixel figures come with their furniture — an
 * anvil, a loom, a potter's wheel, a fishmonger's slab — which makes the box wide, not tall,
 * and `BillboardSprite` already takes width from the picture's own aspect. A market stall
 * that is wider than it is tall is a market stall.
 *
 * Eyeballed against the contact sheet rather than derived, because "how tall is the person
 * inside this drawing" is not a thing the alpha channel knows.
 */
export const FOLK_SCALE: Partial<Record<FolkId, number>> = {
  mercenary: 1.08, // spear, a head above her
  town_guard: 1.1, // halberd
  night_watchman: 1.12, // halberd and a raised lantern
  herald: 1.12, // the banner pole
  town_crier: 1.06, // bell held up
};

/** The world height to draw one at, corrections applied. */
export function folkHeight(id: FolkId): number {
  return FOLK_HEIGHT * (FOLK_SCALE[id] ?? 1);
}
