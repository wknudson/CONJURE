/**
 * Creature art — which bodies on the board wear a drawing instead of a silhouette, and whose
 * drawing it is.
 *
 * Every minion used to be procedural: a hooded figure off `makeMinionTexture`, seeded by card
 * id and washed in its school's colour. That was the right call while no minion art existed,
 * and it stops being the right call the day a hound can look like a hound. This file is where
 * that day is written down, one card at a time.
 *
 * ## Why a registry rather than a field on the card
 *
 * Because most of what an entry says is not about the card. A drawing has an author, a
 * licence and a place it came from, and every one of those must travel with the file for as
 * long as the file ships — CC-BY is a promise to credit, and a promise kept on a card
 * definition is one a card rename quietly breaks. Here the licence sits beside the filename,
 * `CREDITS.md` is generated from it (`npm run art:credits`), and a test refuses a PNG on disk
 * that nobody has claimed.
 *
 * ## What may be listed
 *
 * **CC0 and attribution-only licences, nothing else.** No share-alike and no GPL: those
 * would make the asset — and any edit made to it — copyleft, which is a licensing decision
 * for the whole game and not one to take by the back door of a wolf sprite. No NonCommercial
 * and no NoDerivatives, which cannot be met by a game that crops and tints. `ArtLicence` is
 * the whole list on purpose; adding to it is the decision, and it should look like one.
 *
 * Companion and Commander art is the game's own and is not listed here — see
 * `render/sprites.ts`. This registry is for the third-party drawings.
 */

import { isAscendedId } from './cards/index.js';

/** The licences a bundled drawing may carry. See the module note for why the list is short. */
export type ArtLicence = 'CC0-1.0' | 'CC-BY-3.0' | 'CC-BY-4.0' | 'OGA-BY-3.0';

export interface LicenceTerms {
  name: string;
  url: string;
  /** Whether the licence obliges us to credit the author. CC0 does not; we credit anyway. */
  attribution: boolean;
}

export const LICENCES: Readonly<Record<ArtLicence, LicenceTerms>> = {
  'CC0-1.0': {
    name: 'CC0 1.0 Universal (public domain dedication)',
    url: 'https://creativecommons.org/publicdomain/zero/1.0/',
    attribution: false,
  },
  'CC-BY-3.0': {
    name: 'Creative Commons Attribution 3.0',
    url: 'https://creativecommons.org/licenses/by/3.0/',
    attribution: true,
  },
  'CC-BY-4.0': {
    name: 'Creative Commons Attribution 4.0',
    url: 'https://creativecommons.org/licenses/by/4.0/',
    attribution: true,
  },
  'OGA-BY-3.0': {
    name: 'OpenGameArt Attribution 3.0',
    url: 'https://static.opengameart.org/OGA-BY-3.0.txt',
    attribution: true,
  },
};

export type ArtFacing = 'front' | 'back' | 'side';

export interface CreatureArt {
  /**
   * The file stem under `public/assets/sprites/minions/`. One PNG per facing it has, named
   * `${file}-${facing}.png`.
   */
  file: string;
  /**
   * The views actually drawn. Almost every open pack draws one — a profile, or a front-on
   * battle pose — and the loader stands the missing facings in from the ones that exist.
   */
  facings: readonly ArtFacing[];
  /**
   * How the drawing should be filtered.
   *
   * `pixel` is hard-edged art at a few dozen pixels, which linear filtering smears into a
   * blur at board scale; it is sampled nearest. `painted` is soft art at full size, which is
   * the reverse: nearest would stair-step the gradients the artist drew.
   */
  style: 'pixel' | 'painted';
  /** The work's own title, as its author published it. */
  title: string;
  /** As the author asks to be credited. */
  author: string;
  /** The page the file was taken from. */
  source: string;
  licence: ArtLicence;
}

/**
 * Every card with a drawing, keyed by base card id.
 *
 * Empty until the first art drop. A card absent here is a card that wears the procedural
 * silhouette, which is not a failure state — it is what every body wore before this file.
 */
export const CREATURE_ART: Readonly<Record<string, CreatureArt>> = {};

/**
 * The drawing a card wears, if it has one.
 *
 * A Rank 2 printing is the same creature with better numbers, so it wears its base card's
 * drawing rather than needing an entry of its own.
 */
export function creatureArtFor(
  cardId: string,
  registry: Readonly<Record<string, CreatureArt>> = CREATURE_ART,
): CreatureArt | undefined {
  const base = isAscendedId(cardId) ? cardId.slice(0, -'_r2'.length) : cardId;
  return registry[base];
}

/**
 * Which drawn view answers a facing, and whether it has to be flipped to do it.
 *
 * The standing-in rules, in the order a body needs them:
 *
 *  - A missing **side** is drawn from the front, never mirrored — a front-on pose flipped is
 *    the same pose with its weapon in the other hand.
 *  - A missing **front** is drawn from the side, which is how a profile-only animal faces the
 *    camera: side-on, the way a dog does when it is looking at you.
 *  - A missing **back** is drawn from the front, and from the side if there is no front.
 *
 * `mirrorSide` says whether the side view may be flipped for the other bearing. True only
 * when the side view is a genuine profile, which is the rule `ActorArt.mirrorSide` states.
 */
export function facingPlan(art: CreatureArt): {
  front: ArtFacing;
  back: ArtFacing;
  side: ArtFacing;
  mirrorSide: boolean;
} {
  const has = (f: ArtFacing): boolean => art.facings.includes(f);
  const first = art.facings[0] ?? 'front';
  const front: ArtFacing = has('front') ? 'front' : has('side') ? 'side' : first;
  const side: ArtFacing = has('side') ? 'side' : front;
  const back: ArtFacing = has('back') ? 'back' : front;
  return { front, back, side, mirrorSide: has('side') };
}

/** Where one drawn view lives, relative to the public root. */
export function creatureArtPath(art: CreatureArt, facing: ArtFacing): string {
  return `assets/sprites/minions/${art.file}-${facing}.png`;
}
