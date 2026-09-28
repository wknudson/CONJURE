/**
 * What the bodies of a fight look like -- on the board, and now on the road before it.
 *
 * A pack on the street used to be three copies of one hooded figure seeded off the pack's own
 * id, and the moment the fight opened its squad stood up as different figures seeded off each
 * card: the thing you walked into was not the thing you fought. Both now come from here. A body
 * is drawn from its card id, in the shape its card says it is, and washed in its school's colour
 * -- the board has done the wash all along; the road does it now too.
 */

import * as THREE from 'three';
import { CARDS } from '../core/data/cards/index.js';
import { packByEncounter } from '../core/data/packs.js';
import { hashText } from '../core/util/rng.js';
import { schoolOf } from '../render/palette.js';
import { actorArtFromTextures, type ActorArt } from './sprites3d.js';
import { configurePixelTexture, makeCreatureTexture, spriteTexture, type CreatureShape } from './textures.js';
import { creatureImagesIfLoaded } from '../render/minionArt.js';

/**
 * The shape of every body a pack can field that is not a person.
 *
 * Written out rather than guessed from the name: "stalker" is an archer in one card and a frost
 * beast in another, and a sentinel of bramble is a construct where a grave sentinel might have
 * been a ghost. Anything absent is drawn as a person, which is what every body was before.
 */
const SHAPES: Readonly<Record<string, CreatureShape>> = {
  ember_hound: 'beast',
  rime_fox: 'beast',
  hoarhound: 'beast',
  voltaic_hound: 'beast',
  static_hare: 'beast',
  briar_wolf: 'beast',
  sporeback_boar: 'beast',
  siege_ox: 'beast',
  glacial_stalker: 'beast',
  ember_moth: 'flyer',
  carrion_crow: 'flyer',
  marrow_wisp: 'wisp',
  soot_sprite: 'wisp',
  storm_wisp: 'wisp',
  sap_wisp: 'wisp',
  cinder_adder: 'crawler',
  mire_toad: 'crawler',
  creeping_briar: 'crawler',
  grave_sentinel: 'construct',
  scrap_phalanx: 'construct',
  arc_turret: 'construct',
  clockwork_bombardier: 'construct',
  voltaic_coil: 'construct',
  storm_rod: 'construct',
  arc_dynamo: 'construct',
  bramble_sentinel: 'construct',
  verdant_colossus: 'construct',
  slag_iron_golem: 'construct',
  stone_heart_golem: 'construct',
  bastion_golem: 'construct',
  scrap_metal_mortar: 'construct',
  magma_brute: 'construct',
};

/** A body's shape, by card id. A person for anything the table does not name. */
export function shapeOf(defId: string): CreatureShape {
  return SHAPES[defId] ?? 'humanoid';
}

/**
 * The three views of one body, cut fresh. The caller owns them and disposes them.
 *
 * The card's own drawing when it has one and it has loaded (`core/data/art.ts`); the drawn
 * silhouette otherwise, which is also what a body wears while its file is still on the way.
 * The district preloads every pack's drawings before it builds the packs, so on the road the
 * silhouette is only ever seen for a body nobody has drawn.
 */
export function memberArt(defId: string): ActorArt {
  const drawn = drawnMemberArt(defId);
  if (drawn) return drawn;
  const seed = hashText(defId);
  const shape = shapeOf(defId);
  return actorArtFromTextures(
    makeCreatureTexture('front', seed, shape),
    makeCreatureTexture('back', seed, shape),
    makeCreatureTexture('side', seed, shape),
  );
}

/**
 * A body's drawing, as fresh textures, or null if it has none loaded.
 *
 * Pixel art is sampled nearest and painted art linearly, the rule `CreatureArt.style` states;
 * a view standing in for a missing one reuses the same texture rather than uploading twice.
 */
function drawnMemberArt(defId: string): ActorArt | null {
  const images = creatureImagesIfLoaded(defId);
  if (!images) return null;
  const made = new Map<HTMLImageElement, THREE.Texture>();
  const tex = (img: HTMLImageElement): THREE.Texture => {
    const hit = made.get(img);
    if (hit) return hit;
    let t: THREE.Texture;
    if (images.style === 'pixel') {
      t = configurePixelTexture(new THREE.Texture(img));
      t.needsUpdate = true;
    } else {
      t = spriteTexture(img);
    }
    made.set(img, t);
    return t;
  };
  return {
    front: tex(images.front),
    back: tex(images.back),
    side: tex(images.side),
    sideWalk: [],
    walkGaitCycles: 1,
    mirrorSide: images.mirrorSide,
  };
}

/**
 * Its school's colour, for the wash over the drawing. Null for an id that is not a card, and
 * null for a body wearing its own drawing: a wash is how a silhouette says its school, and
 * tinting a real drawing only makes it look broken.
 */
export function memberTint(defId: string): number | null {
  if (creatureImagesIfLoaded(defId)) return null;
  const card = CARDS[defId];
  return card ? new THREE.Color(schoolOf(card.school).main).getHex() : null;
}

/**
 * Which of a pack's members walk the road for it, leader first.
 *
 * Every different kind of body it has, in the order it lists them, up to four -- so a pack of
 * two hounds, a sprite, a fox and a hare shows all four kinds -- and at least as many as three
 * where it has the bodies for it, so a pack of five footmen is still a group and not one man.
 * Empty for an encounter that is not a pack, which leaves the caller to draw what it always drew.
 */
export function packBodies(encounterId: string): string[] {
  const def = packByEncounter(encounterId);
  if (!def) return [];
  const kinds = [...new Set(def.members)].slice(0, 4);
  const want = Math.min(Math.max(kinds.length, 3), def.members.length, 4);
  const out = [...kinds];
  for (let i = 0; out.length < want && i < def.members.length; i++) {
    const m = def.members[i]!;
    // Repeats in the order the pack lists its members, skipping the ones already out front.
    if (out.filter((o) => o === m).length < def.members.filter((x) => x === m).length) out.push(m);
  }
  return out;
}
