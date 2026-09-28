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
 * The first art drop: every body a board can hold, drawn from three open packs. Almost all are
 * Dungeon Crawl Stone Soup tiles (CC0); the frost, fire, storm and sap elementals come from
 * JosephSeraph's elemental sheet and two soldiers from Redshrike's RPG enemies (both CC-BY 3.0,
 * credited in `CREDITS.md`). Each is one front-on 32-pixel-ish tile, so it is drawn pixel-sampled
 * and stands in for every facing; the sheets were cut into single cells with their backgrounds
 * keyed out.
 *
 * A card absent here wears the procedural silhouette, which is not a failure state — it is what
 * every body wore before this file, and it is what a body added later wears until it is drawn.
 */
export const CREATURE_ART: Readonly<Record<string, CreatureArt>> = {
  aether_archer: {
    file: 'aether_archer',
    facings: ['front'],
    style: 'pixel',
    title: 'Dungeon Crawl 32x32 Tiles',
    author: 'The Dungeon Crawl Stone Soup developers and the RLTiles artists',
    source: 'https://opengameart.org/content/dungeon-crawl-32x32-tiles',
    licence: 'CC0-1.0',
  },
  anvil_lord: {
    file: 'anvil_lord',
    facings: ['front'],
    style: 'pixel',
    title: 'Dungeon Crawl 32x32 Tiles',
    author: 'The Dungeon Crawl Stone Soup developers and the RLTiles artists',
    source: 'https://opengameart.org/content/dungeon-crawl-32x32-tiles',
    licence: 'CC0-1.0',
  },
  arc_dynamo: {
    file: 'arc_dynamo',
    facings: ['front'],
    style: 'pixel',
    title: 'Dungeon Crawl 32x32 Tiles',
    author: 'The Dungeon Crawl Stone Soup developers and the RLTiles artists',
    source: 'https://opengameart.org/content/dungeon-crawl-32x32-tiles',
    licence: 'CC0-1.0',
  },
  arc_turret: {
    file: 'arc_turret',
    facings: ['front'],
    style: 'pixel',
    title: 'Dungeon Crawl 32x32 Tiles',
    author: 'The Dungeon Crawl Stone Soup developers and the RLTiles artists',
    source: 'https://opengameart.org/content/dungeon-crawl-32x32-tiles',
    licence: 'CC0-1.0',
  },
  arcane_familiar: {
    file: 'arcane_familiar',
    facings: ['front'],
    style: 'pixel',
    title: 'Dungeon Crawl 32x32 Tiles',
    author: 'The Dungeon Crawl Stone Soup developers and the RLTiles artists',
    source: 'https://opengameart.org/content/dungeon-crawl-32x32-tiles',
    licence: 'CC0-1.0',
  },
  ash_ghoul: {
    file: 'ash_ghoul',
    facings: ['front'],
    style: 'pixel',
    title: 'Dungeon Crawl 32x32 Tiles',
    author: 'The Dungeon Crawl Stone Soup developers and the RLTiles artists',
    source: 'https://opengameart.org/content/dungeon-crawl-32x32-tiles',
    licence: 'CC0-1.0',
  },
  barrow_wight: {
    file: 'barrow_wight',
    facings: ['front'],
    style: 'pixel',
    title: 'Dungeon Crawl 32x32 Tiles',
    author: 'The Dungeon Crawl Stone Soup developers and the RLTiles artists',
    source: 'https://opengameart.org/content/dungeon-crawl-32x32-tiles',
    licence: 'CC0-1.0',
  },
  bastion_golem: {
    file: 'bastion_golem',
    facings: ['front'],
    style: 'pixel',
    title: 'Dungeon Crawl 32x32 Tiles',
    author: 'The Dungeon Crawl Stone Soup developers and the RLTiles artists',
    source: 'https://opengameart.org/content/dungeon-crawl-32x32-tiles',
    licence: 'CC0-1.0',
  },
  battering_ram: {
    file: 'battering_ram',
    facings: ['front'],
    style: 'pixel',
    title: 'Dungeon Crawl 32x32 Tiles',
    author: 'The Dungeon Crawl Stone Soup developers and the RLTiles artists',
    source: 'https://opengameart.org/content/dungeon-crawl-32x32-tiles',
    licence: 'CC0-1.0',
  },
  bear_cub: {
    file: 'bear_cub',
    facings: ['front'],
    style: 'pixel',
    title: 'Dungeon Crawl 32x32 Tiles',
    author: 'The Dungeon Crawl Stone Soup developers and the RLTiles artists',
    source: 'https://opengameart.org/content/dungeon-crawl-32x32-tiles',
    licence: 'CC0-1.0',
  },
  bone_colossus: {
    file: 'bone_colossus',
    facings: ['front'],
    style: 'pixel',
    title: 'Dungeon Crawl 32x32 Tiles',
    author: 'The Dungeon Crawl Stone Soup developers and the RLTiles artists',
    source: 'https://opengameart.org/content/dungeon-crawl-32x32-tiles',
    licence: 'CC0-1.0',
  },
  bone_rattler: {
    file: 'bone_rattler',
    facings: ['front'],
    style: 'pixel',
    title: '10 Basic RPG Enemies',
    author: "Stephen 'Redshrike' Challener, hosted by OpenGameArt.org",
    source: 'https://opengameart.org/content/10-basic-rpg-enemies',
    licence: 'CC-BY-3.0',
  },
  boulder_slinger: {
    file: 'boulder_slinger',
    facings: ['front'],
    style: 'pixel',
    title: 'Dungeon Crawl 32x32 Tiles',
    author: 'The Dungeon Crawl Stone Soup developers and the RLTiles artists',
    source: 'https://opengameart.org/content/dungeon-crawl-32x32-tiles',
    licence: 'CC0-1.0',
  },
  bramble_sentinel: {
    file: 'bramble_sentinel',
    facings: ['front'],
    style: 'pixel',
    title: 'Dungeon Crawl 32x32 Tiles',
    author: 'The Dungeon Crawl Stone Soup developers and the RLTiles artists',
    source: 'https://opengameart.org/content/dungeon-crawl-32x32-tiles',
    licence: 'CC0-1.0',
  },
  briar_wolf: {
    file: 'briar_wolf',
    facings: ['front'],
    style: 'pixel',
    title: 'Dungeon Crawl 32x32 Tiles',
    author: 'The Dungeon Crawl Stone Soup developers and the RLTiles artists',
    source: 'https://opengameart.org/content/dungeon-crawl-32x32-tiles',
    licence: 'CC0-1.0',
  },
  brood_drake: {
    file: 'brood_drake',
    facings: ['front'],
    style: 'pixel',
    title: 'Dungeon Crawl 32x32 Tiles',
    author: 'The Dungeon Crawl Stone Soup developers and the RLTiles artists',
    source: 'https://opengameart.org/content/dungeon-crawl-32x32-tiles',
    licence: 'CC0-1.0',
  },
  carrion_crow: {
    file: 'carrion_crow',
    facings: ['front'],
    style: 'pixel',
    title: 'Dungeon Crawl 32x32 Tiles',
    author: 'The Dungeon Crawl Stone Soup developers and the RLTiles artists',
    source: 'https://opengameart.org/content/dungeon-crawl-32x32-tiles',
    licence: 'CC0-1.0',
  },
  cinder_adder: {
    file: 'cinder_adder',
    facings: ['front'],
    style: 'pixel',
    title: 'Dungeon Crawl 32x32 Tiles',
    author: 'The Dungeon Crawl Stone Soup developers and the RLTiles artists',
    source: 'https://opengameart.org/content/dungeon-crawl-32x32-tiles',
    licence: 'CC0-1.0',
  },
  cinder_lobber: {
    file: 'cinder_lobber',
    facings: ['front'],
    style: 'pixel',
    title: 'JS Monster Set - Elementals',
    author: 'JosephSeraph',
    source: 'https://opengameart.org/content/js-monster-set-elementals',
    licence: 'CC-BY-3.0',
  },
  clockwork_bombardier: {
    file: 'clockwork_bombardier',
    facings: ['front'],
    style: 'pixel',
    title: 'Dungeon Crawl 32x32 Tiles',
    author: 'The Dungeon Crawl Stone Soup developers and the RLTiles artists',
    source: 'https://opengameart.org/content/dungeon-crawl-32x32-tiles',
    licence: 'CC0-1.0',
  },
  coil_lancer: {
    file: 'coil_lancer',
    facings: ['front'],
    style: 'pixel',
    title: 'Dungeon Crawl 32x32 Tiles',
    author: 'The Dungeon Crawl Stone Soup developers and the RLTiles artists',
    source: 'https://opengameart.org/content/dungeon-crawl-32x32-tiles',
    licence: 'CC0-1.0',
  },
  concussive_blow: {
    file: 'concussive_blow',
    facings: ['front'],
    style: 'pixel',
    title: 'Dungeon Crawl 32x32 Tiles',
    author: 'The Dungeon Crawl Stone Soup developers and the RLTiles artists',
    source: 'https://opengameart.org/content/dungeon-crawl-32x32-tiles',
    licence: 'CC0-1.0',
  },
  creeping_briar: {
    file: 'creeping_briar',
    facings: ['front'],
    style: 'pixel',
    title: 'Dungeon Crawl 32x32 Tiles',
    author: 'The Dungeon Crawl Stone Soup developers and the RLTiles artists',
    source: 'https://opengameart.org/content/dungeon-crawl-32x32-tiles',
    licence: 'CC0-1.0',
  },
  crossbowman: {
    file: 'crossbowman',
    facings: ['front'],
    style: 'pixel',
    title: 'Dungeon Crawl 32x32 Tiles',
    author: 'The Dungeon Crawl Stone Soup developers and the RLTiles artists',
    source: 'https://opengameart.org/content/dungeon-crawl-32x32-tiles',
    licence: 'CC0-1.0',
  },
  den_bear: {
    file: 'den_bear',
    facings: ['front'],
    style: 'pixel',
    title: 'Dungeon Crawl 32x32 Tiles',
    author: 'The Dungeon Crawl Stone Soup developers and the RLTiles artists',
    source: 'https://opengameart.org/content/dungeon-crawl-32x32-tiles',
    licence: 'CC0-1.0',
  },
  drake_hatchling: {
    file: 'drake_hatchling',
    facings: ['front'],
    style: 'pixel',
    title: 'Dungeon Crawl 32x32 Tiles',
    author: 'The Dungeon Crawl Stone Soup developers and the RLTiles artists',
    source: 'https://opengameart.org/content/dungeon-crawl-32x32-tiles',
    licence: 'CC0-1.0',
  },
  ember_hound: {
    file: 'ember_hound',
    facings: ['front'],
    style: 'pixel',
    title: 'Dungeon Crawl 32x32 Tiles',
    author: 'The Dungeon Crawl Stone Soup developers and the RLTiles artists',
    source: 'https://opengameart.org/content/dungeon-crawl-32x32-tiles',
    licence: 'CC0-1.0',
  },
  ember_moth: {
    file: 'ember_moth',
    facings: ['front'],
    style: 'pixel',
    title: 'Dungeon Crawl 32x32 Tiles',
    author: 'The Dungeon Crawl Stone Soup developers and the RLTiles artists',
    source: 'https://opengameart.org/content/dungeon-crawl-32x32-tiles',
    licence: 'CC0-1.0',
  },
  flame_archer: {
    file: 'flame_archer',
    facings: ['front'],
    style: 'pixel',
    title: 'Dungeon Crawl 32x32 Tiles',
    author: 'The Dungeon Crawl Stone Soup developers and the RLTiles artists',
    source: 'https://opengameart.org/content/dungeon-crawl-32x32-tiles',
    licence: 'CC0-1.0',
  },
  frost_ballista: {
    file: 'frost_ballista',
    facings: ['front'],
    style: 'pixel',
    title: 'Dungeon Crawl 32x32 Tiles',
    author: 'The Dungeon Crawl Stone Soup developers and the RLTiles artists',
    source: 'https://opengameart.org/content/dungeon-crawl-32x32-tiles',
    licence: 'CC0-1.0',
  },
  frost_colossus: {
    file: 'frost_colossus',
    facings: ['front'],
    style: 'pixel',
    title: 'Dungeon Crawl 32x32 Tiles',
    author: 'The Dungeon Crawl Stone Soup developers and the RLTiles artists',
    source: 'https://opengameart.org/content/dungeon-crawl-32x32-tiles',
    licence: 'CC0-1.0',
  },
  frost_wisp: {
    file: 'frost_wisp',
    facings: ['front'],
    style: 'pixel',
    title: 'JS Monster Set - Elementals',
    author: 'JosephSeraph',
    source: 'https://opengameart.org/content/js-monster-set-elementals',
    licence: 'CC-BY-3.0',
  },
  furnace_titan: {
    file: 'furnace_titan',
    facings: ['front'],
    style: 'pixel',
    title: 'Dungeon Crawl 32x32 Tiles',
    author: 'The Dungeon Crawl Stone Soup developers and the RLTiles artists',
    source: 'https://opengameart.org/content/dungeon-crawl-32x32-tiles',
    licence: 'CC0-1.0',
  },
  galvanic_brute: {
    file: 'galvanic_brute',
    facings: ['front'],
    style: 'pixel',
    title: 'Dungeon Crawl 32x32 Tiles',
    author: 'The Dungeon Crawl Stone Soup developers and the RLTiles artists',
    source: 'https://opengameart.org/content/dungeon-crawl-32x32-tiles',
    licence: 'CC0-1.0',
  },
  galvanic_revenant: {
    file: 'galvanic_revenant',
    facings: ['front'],
    style: 'pixel',
    title: 'Dungeon Crawl 32x32 Tiles',
    author: 'The Dungeon Crawl Stone Soup developers and the RLTiles artists',
    source: 'https://opengameart.org/content/dungeon-crawl-32x32-tiles',
    licence: 'CC0-1.0',
  },
  gilded_scavenger: {
    file: 'gilded_scavenger',
    facings: ['front'],
    style: 'pixel',
    title: 'Dungeon Crawl 32x32 Tiles',
    author: 'The Dungeon Crawl Stone Soup developers and the RLTiles artists',
    source: 'https://opengameart.org/content/dungeon-crawl-32x32-tiles',
    licence: 'CC0-1.0',
  },
  glacial_stalker: {
    file: 'glacial_stalker',
    facings: ['front'],
    style: 'pixel',
    title: 'Dungeon Crawl 32x32 Tiles',
    author: 'The Dungeon Crawl Stone Soup developers and the RLTiles artists',
    source: 'https://opengameart.org/content/dungeon-crawl-32x32-tiles',
    licence: 'CC0-1.0',
  },
  glacier_warden: {
    file: 'glacier_warden',
    facings: ['front'],
    style: 'pixel',
    title: 'Dungeon Crawl 32x32 Tiles',
    author: 'The Dungeon Crawl Stone Soup developers and the RLTiles artists',
    source: 'https://opengameart.org/content/dungeon-crawl-32x32-tiles',
    licence: 'CC0-1.0',
  },
  glass_arbalest: {
    file: 'glass_arbalest',
    facings: ['front'],
    style: 'pixel',
    title: 'Dungeon Crawl 32x32 Tiles',
    author: 'The Dungeon Crawl Stone Soup developers and the RLTiles artists',
    source: 'https://opengameart.org/content/dungeon-crawl-32x32-tiles',
    licence: 'CC0-1.0',
  },
  glyph_turret: {
    file: 'glyph_turret',
    facings: ['front'],
    style: 'pixel',
    title: 'Dungeon Crawl 32x32 Tiles',
    author: 'The Dungeon Crawl Stone Soup developers and the RLTiles artists',
    source: 'https://opengameart.org/content/dungeon-crawl-32x32-tiles',
    licence: 'CC0-1.0',
  },
  grave_knight: {
    file: 'grave_knight',
    facings: ['front'],
    style: 'pixel',
    title: 'Dungeon Crawl 32x32 Tiles',
    author: 'The Dungeon Crawl Stone Soup developers and the RLTiles artists',
    source: 'https://opengameart.org/content/dungeon-crawl-32x32-tiles',
    licence: 'CC0-1.0',
  },
  grave_sentinel: {
    file: 'grave_sentinel',
    facings: ['front'],
    style: 'pixel',
    title: 'Dungeon Crawl 32x32 Tiles',
    author: 'The Dungeon Crawl Stone Soup developers and the RLTiles artists',
    source: 'https://opengameart.org/content/dungeon-crawl-32x32-tiles',
    licence: 'CC0-1.0',
  },
  hawk_fledgling: {
    file: 'hawk_fledgling',
    facings: ['front'],
    style: 'pixel',
    title: 'Dungeon Crawl 32x32 Tiles',
    author: 'The Dungeon Crawl Stone Soup developers and the RLTiles artists',
    source: 'https://opengameart.org/content/dungeon-crawl-32x32-tiles',
    licence: 'CC0-1.0',
  },
  hedge_slinger: {
    file: 'hedge_slinger',
    facings: ['front'],
    style: 'pixel',
    title: 'Dungeon Crawl 32x32 Tiles',
    author: 'The Dungeon Crawl Stone Soup developers and the RLTiles artists',
    source: 'https://opengameart.org/content/dungeon-crawl-32x32-tiles',
    licence: 'CC0-1.0',
  },
  hoarhound: {
    file: 'hoarhound',
    facings: ['front'],
    style: 'pixel',
    title: 'Dungeon Crawl 32x32 Tiles',
    author: 'The Dungeon Crawl Stone Soup developers and the RLTiles artists',
    source: 'https://opengameart.org/content/dungeon-crawl-32x32-tiles',
    licence: 'CC0-1.0',
  },
  hollow_wraith: {
    file: 'hollow_wraith',
    facings: ['front'],
    style: 'pixel',
    title: 'Dungeon Crawl 32x32 Tiles',
    author: 'The Dungeon Crawl Stone Soup developers and the RLTiles artists',
    source: 'https://opengameart.org/content/dungeon-crawl-32x32-tiles',
    licence: 'CC0-1.0',
  },
  hollowed_husk: {
    file: 'hollowed_husk',
    facings: ['front'],
    style: 'pixel',
    title: 'Dungeon Crawl 32x32 Tiles',
    author: 'The Dungeon Crawl Stone Soup developers and the RLTiles artists',
    source: 'https://opengameart.org/content/dungeon-crawl-32x32-tiles',
    licence: 'CC0-1.0',
  },
  iron_juggernaut: {
    file: 'iron_juggernaut',
    facings: ['front'],
    style: 'pixel',
    title: 'Dungeon Crawl 32x32 Tiles',
    author: 'The Dungeon Crawl Stone Soup developers and the RLTiles artists',
    source: 'https://opengameart.org/content/dungeon-crawl-32x32-tiles',
    licence: 'CC0-1.0',
  },
  kiln_guard: {
    file: 'kiln_guard',
    facings: ['front'],
    style: 'pixel',
    title: 'Dungeon Crawl 32x32 Tiles',
    author: 'The Dungeon Crawl Stone Soup developers and the RLTiles artists',
    source: 'https://opengameart.org/content/dungeon-crawl-32x32-tiles',
    licence: 'CC0-1.0',
  },
  longshot_stalker: {
    file: 'longshot_stalker',
    facings: ['front'],
    style: 'pixel',
    title: 'Dungeon Crawl 32x32 Tiles',
    author: 'The Dungeon Crawl Stone Soup developers and the RLTiles artists',
    source: 'https://opengameart.org/content/dungeon-crawl-32x32-tiles',
    licence: 'CC0-1.0',
  },
  magma_brute: {
    file: 'magma_brute',
    facings: ['front'],
    style: 'pixel',
    title: 'Dungeon Crawl 32x32 Tiles',
    author: 'The Dungeon Crawl Stone Soup developers and the RLTiles artists',
    source: 'https://opengameart.org/content/dungeon-crawl-32x32-tiles',
    licence: 'CC0-1.0',
  },
  marrow_hound: {
    file: 'marrow_hound',
    facings: ['front'],
    style: 'pixel',
    title: 'Dungeon Crawl 32x32 Tiles',
    author: 'The Dungeon Crawl Stone Soup developers and the RLTiles artists',
    source: 'https://opengameart.org/content/dungeon-crawl-32x32-tiles',
    licence: 'CC0-1.0',
  },
  marrow_wisp: {
    file: 'marrow_wisp',
    facings: ['front'],
    style: 'pixel',
    title: 'Dungeon Crawl 32x32 Tiles',
    author: 'The Dungeon Crawl Stone Soup developers and the RLTiles artists',
    source: 'https://opengameart.org/content/dungeon-crawl-32x32-tiles',
    licence: 'CC0-1.0',
  },
  militia_pikeman: {
    file: 'militia_pikeman',
    facings: ['front'],
    style: 'pixel',
    title: 'Dungeon Crawl 32x32 Tiles',
    author: 'The Dungeon Crawl Stone Soup developers and the RLTiles artists',
    source: 'https://opengameart.org/content/dungeon-crawl-32x32-tiles',
    licence: 'CC0-1.0',
  },
  mire_toad: {
    file: 'mire_toad',
    facings: ['front'],
    style: 'pixel',
    title: 'Dungeon Crawl 32x32 Tiles',
    author: 'The Dungeon Crawl Stone Soup developers and the RLTiles artists',
    source: 'https://opengameart.org/content/dungeon-crawl-32x32-tiles',
    licence: 'CC0-1.0',
  },
  mossback_colossus: {
    file: 'mossback_colossus',
    facings: ['front'],
    style: 'pixel',
    title: 'Dungeon Crawl 32x32 Tiles',
    author: 'The Dungeon Crawl Stone Soup developers and the RLTiles artists',
    source: 'https://opengameart.org/content/dungeon-crawl-32x32-tiles',
    licence: 'CC0-1.0',
  },
  oakheart_guardian: {
    file: 'oakheart_guardian',
    facings: ['front'],
    style: 'pixel',
    title: 'Dungeon Crawl 32x32 Tiles',
    author: 'The Dungeon Crawl Stone Soup developers and the RLTiles artists',
    source: 'https://opengameart.org/content/dungeon-crawl-32x32-tiles',
    licence: 'CC0-1.0',
  },
  permafrost_troll: {
    file: 'permafrost_troll',
    facings: ['front'],
    style: 'pixel',
    title: 'Dungeon Crawl 32x32 Tiles',
    author: 'The Dungeon Crawl Stone Soup developers and the RLTiles artists',
    source: 'https://opengameart.org/content/dungeon-crawl-32x32-tiles',
    licence: 'CC0-1.0',
  },
  plague_bearer: {
    file: 'plague_bearer',
    facings: ['front'],
    style: 'pixel',
    title: 'Dungeon Crawl 32x32 Tiles',
    author: 'The Dungeon Crawl Stone Soup developers and the RLTiles artists',
    source: 'https://opengameart.org/content/dungeon-crawl-32x32-tiles',
    licence: 'CC0-1.0',
  },
  quarry_hand: {
    file: 'quarry_hand',
    facings: ['front'],
    style: 'pixel',
    title: 'Dungeon Crawl 32x32 Tiles',
    author: 'The Dungeon Crawl Stone Soup developers and the RLTiles artists',
    source: 'https://opengameart.org/content/dungeon-crawl-32x32-tiles',
    licence: 'CC0-1.0',
  },
  ramming_goat: {
    file: 'ramming_goat',
    facings: ['front'],
    style: 'pixel',
    title: 'Dungeon Crawl 32x32 Tiles',
    author: 'The Dungeon Crawl Stone Soup developers and the RLTiles artists',
    source: 'https://opengameart.org/content/dungeon-crawl-32x32-tiles',
    licence: 'CC0-1.0',
  },
  rampart_mason: {
    file: 'rampart_mason',
    facings: ['front'],
    style: 'pixel',
    title: 'Dungeon Crawl 32x32 Tiles',
    author: 'The Dungeon Crawl Stone Soup developers and the RLTiles artists',
    source: 'https://opengameart.org/content/dungeon-crawl-32x32-tiles',
    licence: 'CC0-1.0',
  },
  restless_geist: {
    file: 'restless_geist',
    facings: ['front'],
    style: 'pixel',
    title: 'Dungeon Crawl 32x32 Tiles',
    author: 'The Dungeon Crawl Stone Soup developers and the RLTiles artists',
    source: 'https://opengameart.org/content/dungeon-crawl-32x32-tiles',
    licence: 'CC0-1.0',
  },
  ridge_wolf: {
    file: 'ridge_wolf',
    facings: ['front'],
    style: 'pixel',
    title: 'Dungeon Crawl 32x32 Tiles',
    author: 'The Dungeon Crawl Stone Soup developers and the RLTiles artists',
    source: 'https://opengameart.org/content/dungeon-crawl-32x32-tiles',
    licence: 'CC0-1.0',
  },
  rime_archer: {
    file: 'rime_archer',
    facings: ['front'],
    style: 'pixel',
    title: 'Dungeon Crawl 32x32 Tiles',
    author: 'The Dungeon Crawl Stone Soup developers and the RLTiles artists',
    source: 'https://opengameart.org/content/dungeon-crawl-32x32-tiles',
    licence: 'CC0-1.0',
  },
  rime_fox: {
    file: 'rime_fox',
    facings: ['front'],
    style: 'pixel',
    title: 'Dungeon Crawl 32x32 Tiles',
    author: 'The Dungeon Crawl Stone Soup developers and the RLTiles artists',
    source: 'https://opengameart.org/content/dungeon-crawl-32x32-tiles',
    licence: 'CC0-1.0',
  },
  rimeguard: {
    file: 'rimeguard',
    facings: ['front'],
    style: 'pixel',
    title: 'Dungeon Crawl 32x32 Tiles',
    author: 'The Dungeon Crawl Stone Soup developers and the RLTiles artists',
    source: 'https://opengameart.org/content/dungeon-crawl-32x32-tiles',
    licence: 'CC0-1.0',
  },
  ring_elder: {
    file: 'ring_elder',
    facings: ['front'],
    style: 'pixel',
    title: 'Dungeon Crawl 32x32 Tiles',
    author: 'The Dungeon Crawl Stone Soup developers and the RLTiles artists',
    source: 'https://opengameart.org/content/dungeon-crawl-32x32-tiles',
    licence: 'CC0-1.0',
  },
  road_scout: {
    file: 'road_scout',
    facings: ['front'],
    style: 'pixel',
    title: 'Dungeon Crawl 32x32 Tiles',
    author: 'The Dungeon Crawl Stone Soup developers and the RLTiles artists',
    source: 'https://opengameart.org/content/dungeon-crawl-32x32-tiles',
    licence: 'CC0-1.0',
  },
  rune_golem: {
    file: 'rune_golem',
    facings: ['front'],
    style: 'pixel',
    title: 'Dungeon Crawl 32x32 Tiles',
    author: 'The Dungeon Crawl Stone Soup developers and the RLTiles artists',
    source: 'https://opengameart.org/content/dungeon-crawl-32x32-tiles',
    licence: 'CC0-1.0',
  },
  salamander_whelp: {
    file: 'salamander_whelp',
    facings: ['front'],
    style: 'pixel',
    title: 'Dungeon Crawl 32x32 Tiles',
    author: 'The Dungeon Crawl Stone Soup developers and the RLTiles artists',
    source: 'https://opengameart.org/content/dungeon-crawl-32x32-tiles',
    licence: 'CC0-1.0',
  },
  sap_wisp: {
    file: 'sap_wisp',
    facings: ['front'],
    style: 'pixel',
    title: 'JS Monster Set - Elementals',
    author: 'JosephSeraph',
    source: 'https://opengameart.org/content/js-monster-set-elementals',
    licence: 'CC-BY-3.0',
  },
  scout_imp: {
    file: 'scout_imp',
    facings: ['front'],
    style: 'pixel',
    title: 'Dungeon Crawl 32x32 Tiles',
    author: 'The Dungeon Crawl Stone Soup developers and the RLTiles artists',
    source: 'https://opengameart.org/content/dungeon-crawl-32x32-tiles',
    licence: 'CC0-1.0',
  },
  scrap_metal_mortar: {
    file: 'scrap_metal_mortar',
    facings: ['front'],
    style: 'pixel',
    title: 'Dungeon Crawl 32x32 Tiles',
    author: 'The Dungeon Crawl Stone Soup developers and the RLTiles artists',
    source: 'https://opengameart.org/content/dungeon-crawl-32x32-tiles',
    licence: 'CC0-1.0',
  },
  scrap_phalanx: {
    file: 'scrap_phalanx',
    facings: ['front'],
    style: 'pixel',
    title: 'Dungeon Crawl 32x32 Tiles',
    author: 'The Dungeon Crawl Stone Soup developers and the RLTiles artists',
    source: 'https://opengameart.org/content/dungeon-crawl-32x32-tiles',
    licence: 'CC0-1.0',
  },
  scrap_titan: {
    file: 'scrap_titan',
    facings: ['front'],
    style: 'pixel',
    title: 'Dungeon Crawl 32x32 Tiles',
    author: 'The Dungeon Crawl Stone Soup developers and the RLTiles artists',
    source: 'https://opengameart.org/content/dungeon-crawl-32x32-tiles',
    licence: 'CC0-1.0',
  },
  sergeant_at_arms: {
    file: 'sergeant_at_arms',
    facings: ['front'],
    style: 'pixel',
    title: 'Dungeon Crawl 32x32 Tiles',
    author: 'The Dungeon Crawl Stone Soup developers and the RLTiles artists',
    source: 'https://opengameart.org/content/dungeon-crawl-32x32-tiles',
    licence: 'CC0-1.0',
  },
  shieldbearer: {
    file: 'shieldbearer',
    facings: ['front'],
    style: 'pixel',
    title: 'Dungeon Crawl 32x32 Tiles',
    author: 'The Dungeon Crawl Stone Soup developers and the RLTiles artists',
    source: 'https://opengameart.org/content/dungeon-crawl-32x32-tiles',
    licence: 'CC0-1.0',
  },
  siege_ox: {
    file: 'siege_ox',
    facings: ['front'],
    style: 'pixel',
    title: 'Dungeon Crawl 32x32 Tiles',
    author: 'The Dungeon Crawl Stone Soup developers and the RLTiles artists',
    source: 'https://opengameart.org/content/dungeon-crawl-32x32-tiles',
    licence: 'CC0-1.0',
  },
  slag_iron_golem: {
    file: 'slag_iron_golem',
    facings: ['front'],
    style: 'pixel',
    title: 'Dungeon Crawl 32x32 Tiles',
    author: 'The Dungeon Crawl Stone Soup developers and the RLTiles artists',
    source: 'https://opengameart.org/content/dungeon-crawl-32x32-tiles',
    licence: 'CC0-1.0',
  },
  soot_sprite: {
    file: 'soot_sprite',
    facings: ['front'],
    style: 'pixel',
    title: 'Dungeon Crawl 32x32 Tiles',
    author: 'The Dungeon Crawl Stone Soup developers and the RLTiles artists',
    source: 'https://opengameart.org/content/dungeon-crawl-32x32-tiles',
    licence: 'CC0-1.0',
  },
  spark_imp: {
    file: 'spark_imp',
    facings: ['front'],
    style: 'pixel',
    title: 'Dungeon Crawl 32x32 Tiles',
    author: 'The Dungeon Crawl Stone Soup developers and the RLTiles artists',
    source: 'https://opengameart.org/content/dungeon-crawl-32x32-tiles',
    licence: 'CC0-1.0',
  },
  spellblade: {
    file: 'spellblade',
    facings: ['front'],
    style: 'pixel',
    title: '10 Basic RPG Enemies',
    author: "Stephen 'Redshrike' Challener, hosted by OpenGameArt.org",
    source: 'https://opengameart.org/content/10-basic-rpg-enemies',
    licence: 'CC-BY-3.0',
  },
  spore_archer: {
    file: 'spore_archer',
    facings: ['front'],
    style: 'pixel',
    title: 'Dungeon Crawl 32x32 Tiles',
    author: 'The Dungeon Crawl Stone Soup developers and the RLTiles artists',
    source: 'https://opengameart.org/content/dungeon-crawl-32x32-tiles',
    licence: 'CC0-1.0',
  },
  spore_thrall: {
    file: 'spore_thrall',
    facings: ['front'],
    style: 'pixel',
    title: 'Dungeon Crawl 32x32 Tiles',
    author: 'The Dungeon Crawl Stone Soup developers and the RLTiles artists',
    source: 'https://opengameart.org/content/dungeon-crawl-32x32-tiles',
    licence: 'CC0-1.0',
  },
  sporeback_boar: {
    file: 'sporeback_boar',
    facings: ['front'],
    style: 'pixel',
    title: 'Dungeon Crawl 32x32 Tiles',
    author: 'The Dungeon Crawl Stone Soup developers and the RLTiles artists',
    source: 'https://opengameart.org/content/dungeon-crawl-32x32-tiles',
    licence: 'CC0-1.0',
  },
  static_hare: {
    file: 'static_hare',
    facings: ['front'],
    style: 'pixel',
    title: 'Dungeon Crawl 32x32 Tiles',
    author: 'The Dungeon Crawl Stone Soup developers and the RLTiles artists',
    source: 'https://opengameart.org/content/dungeon-crawl-32x32-tiles',
    licence: 'CC0-1.0',
  },
  stone_heart_golem: {
    file: 'stone_heart_golem',
    facings: ['front'],
    style: 'pixel',
    title: 'Dungeon Crawl 32x32 Tiles',
    author: 'The Dungeon Crawl Stone Soup developers and the RLTiles artists',
    source: 'https://opengameart.org/content/dungeon-crawl-32x32-tiles',
    licence: 'CC0-1.0',
  },
  storm_roc: {
    file: 'storm_roc',
    facings: ['front'],
    style: 'pixel',
    title: 'Dungeon Crawl 32x32 Tiles',
    author: 'The Dungeon Crawl Stone Soup developers and the RLTiles artists',
    source: 'https://opengameart.org/content/dungeon-crawl-32x32-tiles',
    licence: 'CC0-1.0',
  },
  storm_rod: {
    file: 'storm_rod',
    facings: ['front'],
    style: 'pixel',
    title: 'JS Monster Set - Elementals',
    author: 'JosephSeraph',
    source: 'https://opengameart.org/content/js-monster-set-elementals',
    licence: 'CC-BY-3.0',
  },
  storm_wisp: {
    file: 'storm_wisp',
    facings: ['front'],
    style: 'pixel',
    title: 'Dungeon Crawl 32x32 Tiles',
    author: 'The Dungeon Crawl Stone Soup developers and the RLTiles artists',
    source: 'https://opengameart.org/content/dungeon-crawl-32x32-tiles',
    licence: 'CC0-1.0',
  },
  tempest_engine: {
    file: 'tempest_engine',
    facings: ['front'],
    style: 'pixel',
    title: 'Dungeon Crawl 32x32 Tiles',
    author: 'The Dungeon Crawl Stone Soup developers and the RLTiles artists',
    source: 'https://opengameart.org/content/dungeon-crawl-32x32-tiles',
    licence: 'CC0-1.0',
  },
  thorn_lobber: {
    file: 'thorn_lobber',
    facings: ['front'],
    style: 'pixel',
    title: 'Dungeon Crawl 32x32 Tiles',
    author: 'The Dungeon Crawl Stone Soup developers and the RLTiles artists',
    source: 'https://opengameart.org/content/dungeon-crawl-32x32-tiles',
    licence: 'CC0-1.0',
  },
  thorn_sprout: {
    file: 'thorn_sprout',
    facings: ['front'],
    style: 'pixel',
    title: 'Dungeon Crawl 32x32 Tiles',
    author: 'The Dungeon Crawl Stone Soup developers and the RLTiles artists',
    source: 'https://opengameart.org/content/dungeon-crawl-32x32-tiles',
    licence: 'CC0-1.0',
  },
  vanguard_footman: {
    file: 'vanguard_footman',
    facings: ['front'],
    style: 'pixel',
    title: 'Dungeon Crawl 32x32 Tiles',
    author: 'The Dungeon Crawl Stone Soup developers and the RLTiles artists',
    source: 'https://opengameart.org/content/dungeon-crawl-32x32-tiles',
    licence: 'CC0-1.0',
  },
  verdant_colossus: {
    file: 'verdant_colossus',
    facings: ['front'],
    style: 'pixel',
    title: 'Dungeon Crawl 32x32 Tiles',
    author: 'The Dungeon Crawl Stone Soup developers and the RLTiles artists',
    source: 'https://opengameart.org/content/dungeon-crawl-32x32-tiles',
    licence: 'CC0-1.0',
  },
  voltaic_coil: {
    file: 'voltaic_coil',
    facings: ['front'],
    style: 'pixel',
    title: 'Dungeon Crawl 32x32 Tiles',
    author: 'The Dungeon Crawl Stone Soup developers and the RLTiles artists',
    source: 'https://opengameart.org/content/dungeon-crawl-32x32-tiles',
    licence: 'CC0-1.0',
  },
  voltaic_hound: {
    file: 'voltaic_hound',
    facings: ['front'],
    style: 'pixel',
    title: 'Dungeon Crawl 32x32 Tiles',
    author: 'The Dungeon Crawl Stone Soup developers and the RLTiles artists',
    source: 'https://opengameart.org/content/dungeon-crawl-32x32-tiles',
    licence: 'CC0-1.0',
  },
  wailing_geist: {
    file: 'wailing_geist',
    facings: ['front'],
    style: 'pixel',
    title: 'Dungeon Crawl 32x32 Tiles',
    author: 'The Dungeon Crawl Stone Soup developers and the RLTiles artists',
    source: 'https://opengameart.org/content/dungeon-crawl-32x32-tiles',
    licence: 'CC0-1.0',
  },
  war_dog: {
    file: 'war_dog',
    facings: ['front'],
    style: 'pixel',
    title: 'Dungeon Crawl 32x32 Tiles',
    author: 'The Dungeon Crawl Stone Soup developers and the RLTiles artists',
    source: 'https://opengameart.org/content/dungeon-crawl-32x32-tiles',
    licence: 'CC0-1.0',
  },
  warden_construct: {
    file: 'warden_construct',
    facings: ['front'],
    style: 'pixel',
    title: 'Dungeon Crawl 32x32 Tiles',
    author: 'The Dungeon Crawl Stone Soup developers and the RLTiles artists',
    source: 'https://opengameart.org/content/dungeon-crawl-32x32-tiles',
    licence: 'CC0-1.0',
  },
  wight_archer: {
    file: 'wight_archer',
    facings: ['front'],
    style: 'pixel',
    title: 'Dungeon Crawl 32x32 Tiles',
    author: 'The Dungeon Crawl Stone Soup developers and the RLTiles artists',
    source: 'https://opengameart.org/content/dungeon-crawl-32x32-tiles',
    licence: 'CC0-1.0',
  },
  wight_lord: {
    file: 'wight_lord',
    facings: ['front'],
    style: 'pixel',
    title: 'Dungeon Crawl 32x32 Tiles',
    author: 'The Dungeon Crawl Stone Soup developers and the RLTiles artists',
    source: 'https://opengameart.org/content/dungeon-crawl-32x32-tiles',
    licence: 'CC0-1.0',
  },
};

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
