/**
 * The ward as geometry and light.
 *
 * Everything built here is owned by one `DistrictWorld` instance and released by its
 * `dispose`. That matters more than it usually would: the hub is torn down and rebuilt
 * every single time a shop door closes, so anything not released is leaked once per
 * errand, and a browser will only hand out so many WebGL contexts before it starts taking
 * the oldest one back.
 */

import * as THREE from 'three';
import { LOOK, ambientFor, type AmbientDef } from './look.js';
import { SWAYS } from './dressing.js';
import { SKIES, SkyField, skyStrengthAt, type SkyId } from './skies.js';
import { hashText } from '../core/util/rng.js';
import { gateOpen, NOTHING_HAPPENED, type Chronicle } from './chronicle.js';
import { ambientAt, lampsAt, NIGHT_ANCHOR, type Lit } from './daylight.js';
import type { ColliderSet } from './collision.js';
import { DRESSING } from './dressing.js';
import {
  TILE,
  extractRects,
  groundRowsOf,
  splitRun,
  waterRowsOf,
  xOfCol,
  zOfRow,
  type AreaDef,
  type DressingSpec,
} from './map.js';
import {
  bakeGround,
  makeBoardTexture,
  makeCrateTexture,
  DRESSING_ART,
  makeGateTexture,
  makeWaystoneTexture,
  makeOutskirtsTexture,
  makeGraffitiTexture,
  makeSignTexture,
  makeTreeTexture,
  makeWallTexture,
  makeWaterTexture,
  mulberry32,
  configurePixelTexture,
} from './textures.js';
import { BillboardSprite, applySway } from './sprites3d.js';

/**
 * A building, plus everything that has to disappear along with it.
 *
 * `mats` is deliberately not just the box: a parapet, a chimney and a door plaque all sit
 * on the same wall, and fading the wall while they stayed put would leave a sign hanging
 * in mid-air over the Commander's head.
 */
interface Structure {
  hit: THREE.Mesh;
  mats: (THREE.Material & { opacity: number; transparent: boolean; depthWrite: boolean })[];
}

interface Lamp {
  /**
   * How hard this one is burning, 0 to 1.
   *
   * Per lamp rather than per ward, which is the change that lets somebody walk the row. It was a
   * single multiplier applied to all of them, and a whole street dimming together is the right
   * picture drawn by the wrong cause -- nothing dims a gas lamp.
   */
  lit: number;
  light: THREE.PointLight;
  head: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  phase: number;
}

/** One expanding ring on the canal. See `updateRises`. */
interface Rise {
  mesh: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  life: number;
  max: number;
  /** How wide this one gets. Varied per rise, so they are not one animation played repeatedly. */
  reach: number;
}

interface ImpactLight {
  light: THREE.PointLight;
  life: number;
  max: number;
  peak: number;
}

/**
 * The ground plane's span, computed per area rather than at import.
 *
 * These were module constants derived from a single global grid. Left that way they would
 * have described Ashfall's ground while the collision grid and the baked texture described
 * somebody else's — the exact "four answers that disagreed" failure `map.ts` exists to end,
 * and silent, because nothing compares them.
 */
function groundSpan(area: AreaDef): { w: number; d: number; cz: number } {
  const row0 = waterRowsOf(area);
  const d = groundRowsOf(area) * TILE;
  return { w: area.cols * TILE, d, cz: zOfRow(area, row0) - TILE / 2 + d / 2 };
}

export class DistrictWorld {
  readonly scene = new THREE.Scene();
  readonly sun: THREE.DirectionalLight;
  readonly hemi: THREE.HemisphereLight;
  /** Everything billboarded, turned to face the camera once per frame. */
  readonly billboards: BillboardSprite[] = [];

  private readonly structures: Structure[] = [];
  private readonly hitboxes: THREE.Mesh[] = [];
  private readonly lamps: Lamp[] = [];
  /** One picture per kind of furniture, for the life of this world. See the build loop. */
  private readonly dressTex = new Map<string, THREE.Texture>();
  private readonly signs: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>[] = [];
  private readonly impacts: ImpactLight[] = [];
  /** Absent in an area with no canal. `dispose` and `scrollWater` both allow for it. */
  private readonly waterTexture: THREE.Texture | null = null;
  /**
   * Where the canal is, for putting a rise on it. Null wherever there is no canal.
   *
   * Kept rather than recomputed because the arithmetic that placed the water plane is a dozen
   * lines up and involves `waterRowsOf`, `zOfRow` and a half-tile — a second copy of it here
   * would be a second chance to put the fish in the road.
   */
  private readonly waterRect: { w: number; z0: number; z1: number } | null = null;
  /** Expanding rings on that water. See `updateRises`. */
  private readonly rises: Rise[] = [];
  private riseTimer = 1.5;
  /** This area's falling air, or null where it declares none. */
  private readonly sky: SkyField | null = null;
  /** Kept for the daily roll, which is per place as well as per day. */
  private readonly areaId: string;
  private readonly skyId: SkyId;
  private readonly colliderHelpers = new THREE.Group();
  /**
   * This area's ambience.
   *
   * Held rather than looked up per call so the tuning panel and the scene are editing one
   * object: `AMBIENT[id]` is mutable and the GUI binds straight to it, which is what makes a
   * nudged fog value show up without a reload — and what stops the ward and the road from
   * sharing one set of numbers the way they would if this still read `LOOK`.
   */
  private readonly amb: AmbientDef;
  /**
   * The same place, at the hour it currently is.
   *
   * Held apart from `amb` and not derived on the fly, because the two have different owners:
   * `amb` is `AMBIENT[id]`, which the tuning panel binds to and mutates live, and this is what
   * the scene is actually wearing. Pushing the panel's edits straight at the lights would mean
   * a nudged fog value snapped the world to midnight, and deriving `amb` from the hour would
   * mean the panel edited a value that was overwritten on the next frame.
   *
   * `applyFog`, `applySun` and `applyAmbient` all read this; `setHour` recomputes it from `amb`,
   * so a panel edit still reaches the screen through the same three calls it always did.
   */
  private lit: Lit;
  /** What the clock says. See `daylight.ts`; the authored values are one in the morning. */
  private hour = NIGHT_ANCHOR;

  private readonly occRay = new THREE.Raycaster();
  private readonly occDir = new THREE.Vector3();
  private readonly occTarget = new THREE.Vector3();
  private readonly occHit = new Set<THREE.Object3D>();

  constructor(
    area: AreaDef,
    private readonly colliders: ColliderSet,
    maxAnisotropy: number,
    /**
     * What the street knows. Only the graffiti reads it, and only to decide what is painted.
     *
     * Defaulted so every existing caller and every test that builds a world for its geometry
     * keeps working unchanged -- and so the answer to "what does a ward look like to somebody
     * who has done nothing" is the one you get by not asking.
     */
    chron: Chronicle = NOTHING_HAPPENED,
    /**
     * What time it is, in hours.
     *
     * Defaulted to the hour the whole `AMBIENT` table was authored and measured at, so every
     * existing caller — and every test that builds a world for its geometry — gets exactly the
     * lighting those measurements describe, and "what does this ward look like" has the same
     * answer it had before there was a clock.
     */
    hour: number = NIGHT_ANCHOR,
  ) {
    // The ambience is the area's; the camera and the film are the game's. See `AMBIENT`.
    const amb = ambientFor(area.id);
    this.amb = amb;
    this.hour = hour;
    // Everything below builds from the *lit* values, so a ward entered at noon is built at noon
    // rather than built at night and corrected on the first frame -- which would have been one
    // visible flash of midnight on every crossing.
    const lit = ambientAt(amb, hour);
    this.lit = lit;
    this.scene.fog = new THREE.FogExp2(lit.fogColor, lit.fogDensity);
    this.scene.background = new THREE.Color(lit.fogColor);

    /* --- ground, outskirts, canal --- */
    const span = groundSpan(area);
    const waterRows = waterRowsOf(area);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(span.w, span.d),
      new THREE.MeshLambertMaterial({ map: bakeGround(area, maxAnisotropy) }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, 0, span.cz);
    ground.receiveShadow = true;
    this.scene.add(ground);

    // A big dull plane under everything, so the ward never terminates in visible void.
    // It has to sit below the canal surface or it would cover the water.
    const outskirts = new THREE.Mesh(
      new THREE.PlaneGeometry(260, 260),
      new THREE.MeshLambertMaterial({ map: makeOutskirtsTexture() }),
    );
    outskirts.rotation.x = -Math.PI / 2;
    outskirts.position.y = -0.9;
    this.scene.add(outskirts);

    // Only where there is a canal to draw. An area with no water gets neither surface nor
    // quay, and `waterTexture` stays null — which `dispose` and `scrollWater` both allow for.
    if (waterRows > 0) {
      const depth = waterRows * TILE + 2;
      this.waterTexture = makeWaterTexture();
      // Unlit on purpose: no lamp reaches the canal, and a Lambert surface out there renders
      // as pure black. Basic material lets the water carry its own moonlight, and it still
      // takes fog so it fades into the smog like everything else.
      const water = new THREE.Mesh(
        new THREE.PlaneGeometry(span.w, depth),
        new THREE.MeshBasicMaterial({ map: this.waterTexture }),
      );
      water.rotation.x = -Math.PI / 2;
      const waterZ = zOfRow(area, 0) - TILE / 2 + depth / 2 - 1;
      water.position.set(0, -0.5, waterZ);
      this.scene.add(water);
      // Inset from the plane's own edges, so nothing ever rises half-under the quay.
      this.waterRect = { w: span.w - 6, z0: waterZ - depth / 2 + 2, z1: waterZ + depth / 2 - 2 };

      const quay = new THREE.Mesh(
        new THREE.BoxGeometry(span.w, 0.7, 0.7),
        new THREE.MeshLambertMaterial({ color: 0x2a2b30 }),
      );
      quay.position.set(0, -0.15, zOfRow(area, waterRows) - TILE / 2 - 0.35);
      quay.castShadow = true;
      quay.receiveShadow = true;
      this.scene.add(quay);
    }

    /* --- solid ground, read straight out of the map ---
       Every character whose legend entry carries a `solid` profile, rather than the two
       hardcoded 'B' and 'V' branches this used to be. The heights, the insets and the
       chimneys live on the tile now, so an area's rock face and a ward's terrace come out of
       one loop and neither character is magic here. */
    const wallTexture = makeWallTexture();
    const buildRng = mulberry32(4242);
    for (const [char, def] of Object.entries(area.legend)) {
      const solid = def.solid;
      if (!solid) continue;
      for (const rect of extractRects(area, char)) {
        const runs = solid.split ? splitRun(rect.w) : ([[0, rect.w]] as [number, number][]);
        for (const [off, w] of runs) {
          const cz = zOfRow(area, rect.row) - TILE / 2 + (rect.d * TILE) / 2;
          // Capped well under the camera's sight line to the player, so the occlusion fade
          // is a safety net for the awkward angles rather than a thing that runs constantly.
          const h = solid.minHeight + buildRng() * (solid.maxHeight - solid.minHeight);
          const chimney = buildRng() < solid.chimneyChance ? 1.6 + buildRng() * 1.8 : 0;
          // A gate is an opening before it is a picture: cut its span out of any run that
          // crosses it, or the drawing below hangs inside the masonry. That was the shipped
          // state -- the plane stood at the wall's own z, entombed, and only the top metre
          // cleared the coping. Verifiable from the street, and from nowhere else: every
          // texture test passed while no player could ever have seen the thing tested.
          const x0 = xOfCol(area, rect.col + off) - TILE / 2;
          let spans: [number, number][] = [[x0, x0 + w * TILE]];
          for (const exit of area.exits) {
            const g = exit.gate;
            if (!g || Math.abs(g.z - cz) > (rect.d * TILE) / 2) continue;
            spans = spans.flatMap(([a, b]) => {
              const cut: [number, number][] = [];
              if (g.x - 4 > a) cut.push([a, Math.min(b, g.x - 4)]);
              if (g.x + 4 < b) cut.push([Math.max(a, g.x + 4), b]);
              return cut;
            });
          }
          const widest = spans.reduce((m, s) => (s[1] - s[0] > m ? s[1] - s[0] : m), 0);
          for (const [a, b] of spans) {
            this.addStructure(
              wallTexture,
              (a + b) / 2,
              cz,
              b - a - solid.inset,
              h,
              rect.d * TILE - solid.depthInset,
              // One chimney per run, kept to the widest piece, so cutting a gate out of a
              // wall does not mint a second chimney out of thin air.
              { chimney: b - a === widest ? chimney : 0 },
            );
          }
        }
      }
    }
    wallTexture.dispose();

    /* --- the horizon, pure silhouette in the smog ---
       A city ring for the ward; low broken humps for open country. Either way it exists so
       the world does not visibly end. */
    const horizon = area.props.horizon ?? 'none';
    if (horizon !== 'none') {
      const skyRng = mulberry32(88);
      const city = horizon === 'city';
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2 + skyRng() * 0.2;
        const r = 52 + skyRng() * 22;
        const h = city ? 12 + skyRng() * 22 : 7 + skyRng() * 6;
        const block = new THREE.Mesh(
          new THREE.BoxGeometry(6 + skyRng() * 8, h, 6 + skyRng() * 8),
          new THREE.MeshLambertMaterial({ color: city ? 0x171419 : 0x14180f }),
        );
        block.position.set(Math.cos(a) * r, h / 2, Math.sin(a) * r);
        this.scene.add(block);
      }
    }

    /* --- the air ---
       Built before the furniture so it is early in the scene graph and therefore early in the
       traversal `dispose` does; it is added to the scene like everything else, so it is cleaned
       up by that traversal and needs no line of its own down there. */
    const skyId = area.props.sky ?? 'none';
    this.areaId = area.id;
    this.skyId = skyId;
    if (skyId !== 'none') {
      // Seeded off the area id, so a place's weather is the same weather every time you walk
      // into it rather than a fresh scatter on every shop door.
      this.sky = new SkyField(SKIES[skyId], mulberry32(hashText(area.id) >>> 0));
      // Lit before it is added, so a ward entered at noon has daylight ash from its first frame
      // rather than a frame of midnight ash corrected afterwards.
      this.sky.relight(lit, hour);
      this.sky.setStrength(skyStrengthAt(area.id, skyId, hour));
      this.scene.add(this.sky.points);
    }

    /* --- dressing --- */
    const trees = area.props.trees ?? [];
    if (trees.length > 0) {
      const treeTexture = makeTreeTexture();
      // Trees are not `dressing` -- `props.trees` predates the registry -- so the sway that the
      // plants get from `SWAYS` is applied here directly. A quarter of a plant's amplitude:
      // a tree is a trunk with a canopy on it, and bracken-sized movement makes it rubber.
      for (const t of trees) this.addBillboard(treeTexture, 3, 4, t.x, t.z).setSway(0.05);
    }

    const crates = area.props.crates ?? [];
    if (crates.length > 0) {
      const crateTexture = makeCrateTexture();
      for (const c of crates) this.addCrate(crateTexture, c.x, c.z, c.size ?? 1.1);
    }

    /* --- the furniture ---
       One texture per *kind* standing in this area, not per instance — the rule the trees and
       crates above already follow, and the reason a ward with twelve barrels uploads one
       barrel. Cached on the build rather than at module scope: `dispose()` traverses the scene
       disposing every map it finds and the screen is torn down on every shop door, so a
       module-level texture would be dead on the second visit.

       Waystones are the exception and cannot share, because the picture is the line carved
       into it. */
    for (const spec of area.props.dressing ?? []) {
      let texture = this.dressTex.get(spec.kind);
      if (spec.kind === 'waystone') {
        texture = makeWaystoneTexture(spec.text ?? '');
      } else if (!texture) {
        texture = DRESSING_ART[spec.kind]();
        this.dressTex.set(spec.kind, texture);
      }
      this.addDressing(spec, texture);
    }

    /* --- door plaques --- */
    for (const door of area.props.doors ?? []) {
      const sign = new THREE.Mesh(
        new THREE.PlaneGeometry(2.0, 1.2),
        new THREE.MeshBasicMaterial({
          map: makeSignTexture(door.key),
          color: new THREE.Color(LOOK.signColor),
          transparent: false,
          alphaTest: 0.1,
          side: THREE.DoubleSide,
        }),
      );
      // Facing whichever way the street is: north-side doors look south, and vice versa.
      const facesSouth = door.signZ < door.z;
      sign.position.set(door.signX, 3.1, door.signZ + (facesSouth ? 0.08 : -0.08));
      if (!facesSouth) sign.rotation.y = Math.PI;
      this.scene.add(sign);
      this.signs.push(sign);
      this.attachToStructure(door.signX, door.signZ, sign.material);
    }

    /* --- graffiti ---
       The clue layer, hung on the same walls the plaques are, a few strides from each
       door and at reading height rather than signage height. Unlit basic material like
       the plaques, so the words hold in the dark the way chalk does.

       Anchored to a wall position on the area rather than to a door's index in this file's
       own list, which is what it was: a `door: number` reaching into `DOORS`, silently
       skipped when the index missed. Reordering the doors would have erased the words. */
    for (const g of area.props.graffiti ?? []) {
      // A line that has not been earned yet, or has been overtaken, is simply not painted.
      // Cheaper than fading it and more honest: a wall either says this or it does not.
      if (!gateOpen(g.gate, chron)) continue;
      const tex = makeGraffitiTexture(g.text);
      const img = tex.image as HTMLCanvasElement;
      const scrawl = new THREE.Mesh(
        // Sized off the text so long lines do not squash: ~0.045 world units per pixel.
        new THREE.PlaneGeometry(img.width * 0.045, img.height * 0.045),
        new THREE.MeshBasicMaterial({
          map: tex,
          color: new THREE.Color(g.tint),
          transparent: true,
          opacity: 0.85,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );
      scrawl.position.set(g.wallX + g.dx, 1.15, g.wallZ + (g.facesSouth ? 0.09 : -0.09));
      if (!g.facesSouth) scrawl.rotation.y = Math.PI;
      scrawl.rotation.z = 0.03 * (g.dx > 0 ? -1 : 1); // hand-drawn, not hung level
      this.scene.add(scrawl);
      this.attachToStructure(g.wallX, g.wallZ, scrawl.material);
    }

    /* --- the bounty board --- */
    const boardAt = area.props.board;
    if (boardAt) {
      const boardPost = new THREE.Mesh(
        new THREE.BoxGeometry(0.24, 1.6, 0.24),
        new THREE.MeshLambertMaterial({ color: 0x2a2118 }),
      );
      boardPost.position.set(boardAt.x, 0.8, boardAt.z);
      boardPost.castShadow = true;
      this.scene.add(boardPost);
      const board = this.addBillboard(makeBoardTexture(), 2.4, 2.0, boardAt.x, boardAt.z);
      board.position.y = 1.4;
      this.colliders.add(boardAt.x, boardAt.z, 0.9, 0.5, 'board');
    }

    /* --- the gates ---
       One per exit that asks for one. The collider spans the whole opening, so this is not
       scenery: you do not walk through a gate, you walk up to it and the hotspot in front of it
       opens it. Which is why the drawing is a *closed, latched* gate rather than a sealed one or
       an open one -- see `makeGateTexture`, where the reasoning lives. */
    for (const exit of area.exits) {
      const at = exit.gate;
      if (!at) continue;
      const gate = new THREE.Mesh(
        new THREE.PlaneGeometry(8, 4.6),
        new THREE.MeshLambertMaterial({
          map: makeGateTexture(),
          transparent: false,
          alphaTest: 0.5,
          side: THREE.DoubleSide,
        }),
      );
      gate.geometry.translate(0, 2.3, 0);
      gate.position.set(at.x, 0, at.z);
      gate.castShadow = true;
      this.scene.add(gate);
      this.colliders.add(at.x, at.z, 8, 1.2, 'gate');
    }

    /* --- lighting rig --- */
    this.hemi = new THREE.HemisphereLight(lit.skyColor, lit.groundBounce, lit.ambientIntensity);
    this.scene.add(this.hemi);

    this.sun = new THREE.DirectionalLight(lit.sunColor, lit.sunIntensity);
    this.sun.position.set(-12, 18, 10);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.left = -30;
    this.sun.shadow.camera.right = 30;
    this.sun.shadow.camera.top = 30;
    this.sun.shadow.camera.bottom = -30;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 60;
    this.sun.shadow.bias = -0.0008;
    this.sun.shadow.normalBias = 0.02;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);

    for (const l of area.props.lamps ?? []) this.addLamp(l.x, l.z);

    /* --- collider wireframes, off by default --- */
    this.colliderHelpers.visible = false;
    this.scene.add(this.colliderHelpers);
    for (const c of this.colliders.boxes) {
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(c.maxX - c.minX, 3, c.maxZ - c.minZ),
        new THREE.MeshBasicMaterial({ color: 0xff3355, wireframe: true }),
      );
      box.position.set((c.minX + c.maxX) / 2, 1.5, (c.minZ + c.maxZ) / 2);
      this.colliderHelpers.add(box);
    }
  }

  /* ============================================================
     Construction helpers
     ============================================================ */

  /** `w` is ignored now: the sprite takes its width from the picture's own proportions. */
  addBillboard(texture: THREE.Texture, _w: number, h: number, x: number, z: number): BillboardSprite {
    const b = new BillboardSprite(texture, h);
    b.position.set(x, 0, z);
    this.scene.add(b);
    this.billboards.push(b);
    return b;
  }

  /**
   * One piece of furniture, built the way its kind says to build it.
   *
   * Four forms, because the two that existed do not cover the world. A fence is not a
   * billboard — it would swing to face the camera and stop enclosing anything the moment the
   * player orbits with Q/E — and a scorch mark is not a box.
   */
  private addDressing(spec: DressingSpec, texture: THREE.Texture): void {
    const kind = DRESSING[spec.kind];
    const size = spec.size ?? kind.size;
    const img = texture.image as { width?: number; height?: number } | null | undefined;
    const aspect = img?.width && img.height ? img.width / img.height : 1;
    const yaw = spec.yaw ?? 0;

    if (kind.form === 'billboard') {
      // Through the same helper the trees use, so it lands in `world.billboards` and is turned
      // to camera each frame with everything else. `yaw` is meaningless here and a test says so
      // rather than letting it be silently discarded.
      const b = this.addBillboard(texture, size * aspect, size, spec.x, spec.z);
      // Scaled by the prop's own height, so a tall reed leans further than a mushroom does
      // while both bend by the same angle. A flat amplitude makes the small things wobble.
      if (SWAYS.has(spec.kind)) b.setSway(0.035 * size);
    } else if (kind.form === 'panel') {
      // Deliberately not a `BillboardSprite`, and deliberately not pushed into `billboards`:
      // holding the yaw it was given is the entire reason this form exists.
      const geo = new THREE.PlaneGeometry(size * aspect, size);
      // Lifted so `position.y = 0` means standing on the floor, the same trick the gate uses.
      geo.translate(0, size / 2, 0);
      const panel = new THREE.Mesh(
        geo,
        new THREE.MeshLambertMaterial({
          map: texture,
          transparent: false,
          alphaTest: 0.35,
          side: THREE.DoubleSide,
        }),
      );
      panel.position.set(spec.x, 0, spec.z);
      panel.rotation.y = yaw;
      panel.castShadow = true;
      // Washing on a line and an awning over a stall are the two pieces of furniture that are
      // cloth, and cloth moves. The sway axis is local x, which for a fixed panel is the way it
      // hangs -- so a line billows along its own length instead of flapping edge-on.
      // The height is handed over because a panel's geometry is built at full size rather
      // than scaled from a unit plane -- see `applySway`, where getting this wrong made an
      // awning swing through most of a metre.
      if (SWAYS.has(spec.kind)) applySway(panel.material, 0.03 * size, size);
      this.scene.add(panel);
    } else if (kind.form === 'ground') {
      // Lambert, not Basic: the ground plane it lies on is Lambert, and an unlit decal would
      // glow on a dark street instead of taking the ward's light with everything else.
      const decal = new THREE.Mesh(
        new THREE.PlaneGeometry(size, size),
        new THREE.MeshLambertMaterial({
          map: texture,
          transparent: true,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );
      decal.rotation.x = -Math.PI / 2;
      decal.rotation.z = yaw;
      // A hair off the floor, so it does not fight the baked ground for depth.
      decal.position.set(spec.x, 0.03, spec.z);
      decal.renderOrder = 1;
      this.scene.add(decal);
    } else {
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(size * aspect, size, size),
        // `alphaTest` rather than a bare map: these textures do not fill their canvas — a
        // barrel is round and a trough is low — and an untested alpha renders those pixels as
        // solid black faces rather than as nothing. The crate got away without it only because
        // its art is a filled square.
        new THREE.MeshLambertMaterial({ map: texture, transparent: false, alphaTest: 0.5 }),
      );
      box.position.set(spec.x, size / 2, spec.z);
      box.rotation.y = yaw;
      box.castShadow = true;
      box.receiveShadow = true;
      this.scene.add(box);
      // Into `structures` so a fight fades it, exactly as a building is faded — a barrel left
      // standing opaque in the middle of an arena is the same complaint as a wall would be.
      // Only this form: `inArena` reads `BoxGeometry.parameters`, so handing it a plane would
      // give it `depth: undefined` and a NaN comparison that silently answers false.
      //
      // Not into `hitboxes`, though. That list is raycast every frame for occlusion, and
      // waist-high furniture never stands between a camera 22 units out and the player.
      this.structures.push({ hit: box, mats: [box.material] });
    }

    // A brazier is a fire, so it lights what is around it. Same warm point light the gas lamps
    // carry, at a shorter reach and with no pole: a fire in a basket is not a street lamp.
    if (spec.kind === 'brazier') {
      const light = new THREE.PointLight(new THREE.Color('#e08040'), LOOK.lampIntensity * 0.8, LOOK.lampDistance * 0.6, 2);
      light.position.set(spec.x, size * 0.9, spec.z);
      this.scene.add(light);
    }

    if (kind.collides) {
      // The footprint of the *rotated* box, because `ColliderSet` is axis-aligned only. Without
      // this a fence turned forty-five degrees would collide as though it still ran east-west,
      // and the art would be lying about where the wall is.
      const w = size * aspect;
      const cos = Math.abs(Math.cos(yaw));
      const sin = Math.abs(Math.sin(yaw));
      this.colliders.add(spec.x, spec.z, w * cos + size * sin, w * sin + size * cos, spec.kind);
    }
  }

  private addCrate(texture: THREE.Texture, x: number, z: number, s: number): void {
    const crate = new THREE.Mesh(
      new THREE.BoxGeometry(s, s, s),
      new THREE.MeshLambertMaterial({ map: texture }),
    );
    crate.position.set(x, s / 2, z);
    crate.castShadow = true;
    crate.receiveShadow = true;
    this.scene.add(crate);
    this.colliders.add(x, z, s, s, 'crate');
  }

  private addStructure(
    wallTexture: THREE.Texture,
    x: number,
    z: number,
    w: number,
    h: number,
    d: number,
    opts: { chimney?: number },
  ): void {
    const tex = wallTexture.clone();
    configurePixelTexture(tex);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(Math.max(1, Math.round(w / 2)), Math.max(1, Math.round(h / 2)));
    tex.needsUpdate = true;

    const box = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshLambertMaterial({ map: tex }),
    );
    box.position.set(x, h / 2, z);
    box.castShadow = true;
    box.receiveShadow = true;
    this.scene.add(box);

    // Flat industrial roofs with a parapet. No fairytale cones in this ward.
    const parapet = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.35, 0.4, d + 0.35),
      new THREE.MeshLambertMaterial({ color: 0x2b2622 }),
    );
    parapet.position.set(x, h + 0.2, z);
    parapet.castShadow = true;
    this.scene.add(parapet);

    const parts: THREE.Mesh<THREE.BufferGeometry, THREE.MeshLambertMaterial>[] = [
      box as THREE.Mesh<THREE.BufferGeometry, THREE.MeshLambertMaterial>,
      parapet as THREE.Mesh<THREE.BufferGeometry, THREE.MeshLambertMaterial>,
    ];

    if (opts.chimney) {
      const stack = new THREE.Mesh(
        new THREE.CylinderGeometry(0.45, 0.55, opts.chimney, 6),
        new THREE.MeshLambertMaterial({ color: 0x241f1c }),
      );
      stack.position.set(x + w * 0.28, h + opts.chimney / 2, z - d * 0.24);
      stack.castShadow = true;
      this.scene.add(stack);
      parts.push(stack as THREE.Mesh<THREE.BufferGeometry, THREE.MeshLambertMaterial>);
    }

    this.structures.push({ hit: box, mats: parts.map((p) => p.material) });
    this.hitboxes.push(box);
    this.colliders.add(x, z, w, d, 'structure');
  }

  /**
   * Hands a loose material to whichever building it is mounted on, so the two fade as one.
   *
   * Matched by position against the footprints already extracted from the map, rather than
   * by a list kept beside them: a sign is on the wall it is standing in front of, and that
   * is a fact the geometry already knows.
   */
  private attachToStructure(x: number, z: number, mat: THREE.Material): void {
    for (const s of this.structures) {
      const geo = s.hit.geometry as THREE.BoxGeometry;
      const { width, depth } = geo.parameters;
      const p = s.hit.position;
      if (
        x > p.x - width / 2 - 0.6 &&
        x < p.x + width / 2 + 0.6 &&
        z > p.z - depth / 2 - 0.6 &&
        z < p.z + depth / 2 + 0.6
      ) {
        s.mats.push(mat as Structure['mats'][number]);
        return;
      }
    }
  }

  private addLamp(x: number, z: number): void {
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.13, 3.4, 6),
      new THREE.MeshLambertMaterial({ color: 0x17181d }),
    );
    pole.position.set(x, 1.7, z);
    pole.castShadow = true;
    this.scene.add(pole);

    // An unlit material reads as emissive and gives the bloom something to grab.
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.5, 0.42),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(LOOK.lampColor) }),
    );
    head.position.set(x, 3.6, z);
    this.scene.add(head);

    // No shadow map on these. One shadow-casting light is the budget, and the sun has it.
    const light = new THREE.PointLight(
      new THREE.Color(LOOK.lampColor),
      LOOK.lampIntensity,
      LOOK.lampDistance,
      2,
    );
    light.position.set(x, 3.6, z);
    this.scene.add(light);

    this.colliders.add(x, z, 0.5, 0.5, 'lamp');
    this.lamps.push({ light, head, phase: this.lamps.length * 1.7, lit: lampsAt(this.hour) });
  }

  /* ============================================================
     Per-frame
     ============================================================ */

  /**
   * The gas lamps, flickering — and going out.
   *
   * The lamps are the payoff of having a clock at all. Azo has forty-one of them on the Lamprow
   * High Street alone and a lamplighter whose whole job is walking that row; until now they
   * burned at the same intensity at every hour of a day that did not exist. `lampsAt` lags the
   * sun by an hour at each end, so they are lit before the light has entirely gone and are still
   * up for the first of the morning — which is the only thing in the world that shows somebody
   * is doing a job on a schedule.
   *
   * The flicker is unchanged and still runs at noon. A dead lamp does not flicker, but it also
   * does not cost anything to compute, and gating the maths would put a branch in the one loop
   * here that runs per lamp per frame.
   */
  /** Where a lamp stands, for whoever is walking the row. */
  lampPosition(i: number): { x: number; z: number } | null {
    const l = this.lamps[i];
    return l ? { x: l.light.position.x, z: l.light.position.z } : null;
  }

  get lampCount(): number {
    return this.lamps.length;
  }

  /**
   * How brightly one lamp burns, 0 to 1.
   *
   * Set per lamp so a row can be lit one at a time by somebody walking it. Every lamp is reset to
   * the hour's own curve by `setHour`, so a ward with nobody to light it behaves exactly as it
   * did — which is eighteen of the nineteen.
   */
  setLampLit(i: number, k: number): void {
    const l = this.lamps[i];
    if (l) l.lit = k;
  }

  updateLamps(t: number): void {
    for (const l of this.lamps) {
      // Two summed sines read as a gas flame and allocate nothing.
      const n =
        0.5 +
        0.5 * (Math.sin(t * 6.3 + l.phase) * 0.6 + Math.sin(t * 11.7 + l.phase * 2.1) * 0.4);
      l.light.intensity =
        LOOK.lampIntensity * (1 - LOOK.lampFlicker + LOOK.lampFlicker * n * 2) * l.lit;
    }
  }

  /** Keeps the key light's shadow frustum centred on whoever the camera is following. */
  trackSun(x: number, y: number, z: number): void {
    this.sun.position.set(x - 12, 18, z + 10);
    this.sun.target.position.set(x, y, z);
  }

  scrollWater(dt: number): void {
    // No canal, nothing to scroll. Called every frame from the loop, which does not know
    // or care which area it is drawing.
    if (!this.waterTexture) return;
    this.waterTexture.offset.x += 0.03 * dt;
  }

  /**
   * Something rising in the canal.
   *
   * A ring that expands and fades, on a timer, somewhere in the water. There is no fish: the
   * ring *is* the fish, the same way a footprint is a person, and at the range the camera keeps
   * from the quay a drawn body would be four pixels of guesswork. What the player reads is that
   * the water is not a scrolling texture — which, until this, is exactly what it was.
   *
   * Pooled and reused rather than allocated, on the `ImpactLight` pattern. Absent wherever
   * `waterRows` is, like the water itself.
   */
  updateRises(dt: number, rng: () => number): void {
    if (!this.waterRect) return;

    this.riseTimer -= dt;
    if (this.riseTimer <= 0) {
      // Irregular on purpose. A rise every three seconds exactly is a machine.
      this.riseTimer = 1.8 + rng() * 5.5;
      this.spawnRise(
        (rng() - 0.5) * this.waterRect.w,
        this.waterRect.z0 + rng() * (this.waterRect.z1 - this.waterRect.z0),
      );
    }

    for (let i = this.rises.length - 1; i >= 0; i--) {
      const r = this.rises[i]!;
      r.life -= dt;
      if (r.life <= 0) {
        this.scene.remove(r.mesh);
        r.mesh.geometry.dispose();
        r.mesh.material.dispose();
        this.rises.splice(i, 1);
        continue;
      }
      const k = 1 - r.life / r.max;
      // Expands fast and then slows, which is what a ring on water does; a linear expansion
      // reads as a circle being scaled, because that is all it is.
      const spread = Math.sqrt(k);
      r.mesh.scale.setScalar(0.4 + spread * r.reach);
      r.mesh.material.opacity = (1 - k) * 0.5;
    }
  }

  private spawnRise(x: number, z: number): void {
    const mesh = new THREE.Mesh(
      new THREE.RingGeometry(0.72, 1, 20),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color('#cfe3ea'),
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      }),
    );
    mesh.rotation.x = -Math.PI / 2;
    // Just proud of the water plane at -0.5. Any lower and it z-fights the surface it is on.
    mesh.position.set(x, -0.46, z);
    mesh.renderOrder = 2;
    this.scene.add(mesh);
    this.rises.push({ mesh, life: 2.6, max: 2.6, reach: 1.6 + Math.random() * 1.4 });
  }

  /**
   * One frame of falling air, centred on whoever the camera is watching.
   *
   * The anchor is the whole design: see `weather.ts`. A field big enough to cover the Ashwood
   * would be tens of thousands of points, all but a few dozen of them behind the player or
   * beyond the fog.
   */
  updateSky(dt: number, anchor: THREE.Vector3): void {
    this.sky?.update(dt, anchor);
  }

  /**
   * Fades whatever stands between the camera and the player.
   *
   * Courtyards and the shopfront side of the cross-street are simply unplayable without
   * this: the camera sits low enough that a terrace behind the player becomes a wall
   * across the middle of the screen.
   */
  updateOccluders(dt: number, camera: THREE.Camera, target: THREE.Vector3): void {
    // Aimed at the head rather than the feet — a ray along the ground grazes every wall it
    // passes and would fade the whole street.
    this.occTarget.set(target.x, target.y + 1.2, target.z);
    this.occDir.subVectors(this.occTarget, camera.position);
    const dist = this.occDir.length();
    this.occRay.set(camera.position, this.occDir.normalize());
    this.occRay.far = dist;

    this.occHit.clear();
    for (const h of this.occRay.intersectObjects(this.hitboxes, false)) this.occHit.add(h.object);

    const k = Math.min(1, dt * 9);
    for (const s of this.structures) {
      // Nearly all the way out, not merely dim. These walls are dark brick against a dark
      // street, so a tenth of one still reads as a wall — the two south-facing doors put
      // the camera directly behind their own building, and at 0.16 the Commander was a
      // silhouette behind a grey pane rather than someone standing in a doorway.
      //
      // The arena is folded into the same `want` rather than faded by a second pass. It has
      // to be: this loop runs every frame and writes `1` to everything it does not consider
      // occluded, so an arena fade applied from outside would be undone on the next frame.
      // One place decides how visible a building is.
      const want = this.occHit.has(s.hit) || this.inArena(s.hit) ? 0.04 : 1;
      for (const mat of s.mats) {
        if (Math.abs(mat.opacity - want) < 0.005) {
          mat.opacity = want;
          continue;
        }
        mat.opacity += (want - mat.opacity) * k;
        const clear = mat.opacity < 0.995;
        if (mat.transparent !== clear) {
          mat.transparent = clear;
          mat.needsUpdate = true;
        }
        mat.depthWrite = !clear;
      }
    }
  }

  /* ============================================================
     The combat arena
     ============================================================ */

  /**
   * A patch of ground that must be clear to fight on.
   *
   * Set while a board is standing on the street, so anything built inside its footprint
   * fades out of the way. In a dense ward the placement search cannot always find a window
   * with nothing in it — Ashfall's worst case clips the corner of one terrace — and the
   * honest answer is to move the terrace out of the shot rather than to draw the grid
   * through it.
   *
   * Consumed by `updateOccluders`, which is the one place that decides a building's opacity.
   * Null clears it and the street comes back on its own over the next few frames.
   */
  private arena: { x0: number; z0: number; x1: number; z1: number } | null = null;

  setArena(rect: { x0: number; z0: number; x1: number; z1: number } | null): void {
    this.arena = rect;
  }

  private inArena(hit: THREE.Mesh): boolean {
    const a = this.arena;
    if (!a) return false;
    const geo = hit.geometry as THREE.BoxGeometry;
    const { width, depth } = geo.parameters;
    const p = hit.position;
    return (
      p.x - width / 2 < a.x1 &&
      p.x + width / 2 > a.x0 &&
      p.z - depth / 2 < a.z1 &&
      p.z + depth / 2 > a.z0
    );
  }

  /**
   * Thins the fog while a fight is on, and puts it back afterwards.
   *
   * Not a nicety. The walk camera sits twenty-two units out; framing a whole arena needs
   * roughly twice that, and at Lamprow's authored density of 0.036 an exponential fog has
   * eaten most of the board's contrast by the time it is all in shot. The area's own look is
   * still the look — this scales it for the one situation the area was not tuned for.
   *
   * A multiplier rather than an absolute, so each area keeps its own character: the Chalk
   * Road stays the clearest place in the game and Lamprow stays the thickest.
   */
  setFogScale(scale: number): void {
    (this.scene.fog as THREE.FogExp2).density = this.lit.fogDensity * scale;
  }

  /* ============================================================
     VFX
     ============================================================ */

  spawnImpactLight(position: THREE.Vector3, colorOverride?: string, scale = 1): void {
    const light = new THREE.PointLight(
      new THREE.Color(colorOverride ?? LOOK.impactColor),
      LOOK.impactIntensity * scale,
      LOOK.impactDistance,
      2,
    );
    light.position.copy(position).add(new THREE.Vector3(0, 1.1, 0));
    light.castShadow = true;
    light.shadow.mapSize.set(512, 512);
    this.scene.add(light);
    this.impacts.push({
      light,
      life: LOOK.impactDecayTime,
      max: LOOK.impactDecayTime,
      peak: LOOK.impactIntensity * scale,
    });
  }

  updateImpactLights(dt: number): void {
    for (let i = this.impacts.length - 1; i >= 0; i--) {
      const fx = this.impacts[i]!;
      fx.life -= dt;
      if (fx.life <= 0) {
        this.scene.remove(fx.light);
        fx.light.dispose();
        this.impacts.splice(i, 1);
      } else {
        const t = fx.life / fx.max;
        fx.light.intensity = fx.peak * t * t;
      }
    }
  }

  /**
   * Compiles the shader variants the ward will need, before it needs them.
   *
   * three bakes the number of shadow-casting point lights into every lit material, so the
   * first impact light otherwise recompiles the whole scene mid-frame. Paying for it at
   * load costs a few frames nobody is looking at.
   */
  warmupShaders(render: () => void, maxConcurrent = 3): void {
    // The occluder fade's transparent variant, first.
    const restore: THREE.Material[] = [];
    for (const s of this.structures) {
      for (const mat of s.mats) {
        if (!mat.transparent) {
          mat.transparent = true;
          mat.needsUpdate = true;
          restore.push(mat);
        }
      }
    }
    render();
    for (const mat of restore) {
      mat.transparent = false;
      mat.needsUpdate = true;
    }
    render();

    const temp: THREE.PointLight[] = [];
    for (let i = 0; i < maxConcurrent; i++) {
      const l = new THREE.PointLight(0xffffff, 0.0001, 1, 2);
      l.position.set(0, -60 - i, 0);
      l.castShadow = true;
      l.shadow.mapSize.set(512, 512);
      this.scene.add(l);
      temp.push(l);
      render();
    }
    for (const l of temp) {
      this.scene.remove(l);
      l.dispose();
    }
  }

  setCollidersVisible(on: boolean): void {
    this.colliderHelpers.visible = on;
  }

  /* ============================================================
     Look changes from the panel
     ============================================================ */

  /**
   * Moves the clock, and the light with it.
   *
   * Recomputes from `amb` every time rather than stepping the current value, so the hour is the
   * single input and nothing drifts: setting it back to `NIGHT_ANCHOR` returns the exact street
   * the lighting passes measured, whatever it has been through since.
   */
  setHour(hour: number): void {
    this.hour = hour;
    this.lit = ambientAt(this.amb, hour);
    this.applyFog();
    this.applySun();
    this.applyAmbient();
    // The air too. A mote is lit by the same light as the street it is falling on, so this
    // reads the ambience that was just computed rather than the hour a second time.
    this.sky?.relight(this.lit, hour);
    this.sky?.setStrength(skyStrengthAt(this.areaId, this.skyId, hour));
    // The default, which is the whole ward fading together on one curve. A lamplighter overrides
    // it lamp by lamp immediately afterwards; everywhere else this is the behaviour, unchanged.
    const burning = lampsAt(hour);
    for (const l of this.lamps) l.lit = burning;
  }

  applyFog(): void {
    // Re-derived here as well as in `setHour`, because the tuning panel calls this directly
    // after editing `amb` and would otherwise be writing last hour's values.
    this.lit = ambientAt(this.amb, this.hour);
    (this.scene.fog as THREE.FogExp2).color.set(this.lit.fogColor);
    (this.scene.fog as THREE.FogExp2).density = this.lit.fogDensity;
    (this.scene.background as THREE.Color).set(this.lit.fogColor);
  }

  applySun(): void {
    this.lit = ambientAt(this.amb, this.hour);
    this.sun.intensity = this.lit.sunIntensity;
    this.sun.color.set(this.lit.sunColor);
  }

  applyAmbient(): void {
    this.lit = ambientAt(this.amb, this.hour);
    this.hemi.intensity = this.lit.ambientIntensity;
    this.hemi.color.set(this.lit.skyColor);
    this.hemi.groundColor.set(this.lit.groundBounce);
  }

  applyLamps(): void {
    for (const l of this.lamps) {
      l.light.color.set(LOOK.lampColor);
      l.light.distance = LOOK.lampDistance;
      l.head.material.color.set(LOOK.lampColor);
    }
  }

  applySigns(): void {
    for (const s of this.signs) s.material.color.set(LOOK.signColor);
  }

  /* ============================================================
     Teardown
     ============================================================ */

  /**
   * Releases every GPU resource the ward holds.
   *
   * Walks the graph rather than tracking a list, because the list is the thing that goes
   * stale: anything added later and forgotten here would leak silently, once per errand,
   * until the browser started reclaiming contexts.
   */
  dispose(): void {
    for (const fx of this.impacts) {
      this.scene.remove(fx.light);
      fx.light.dispose();
    }
    this.impacts.length = 0;

    this.scene.traverse((obj) => {
      const mesh = obj as Partial<THREE.Mesh>;
      mesh.geometry?.dispose();
      const mat = mesh.material;
      const list = Array.isArray(mat) ? mat : mat ? [mat] : [];
      for (const m of list) {
        const withMap = m as THREE.Material & { map?: THREE.Texture | null };
        withMap.map?.dispose();
        m.dispose();
      }
      if ((obj as THREE.Light).isLight) (obj as THREE.PointLight).dispose?.();
    });

    for (const r of this.rises) {
      this.scene.remove(r.mesh);
      r.mesh.geometry.dispose();
      r.mesh.material.dispose();
    }
    this.rises.length = 0;

    this.sun.shadow.dispose();
    // Optional-chained because an area without a canal never made one. Unguarded this is a
    // crash on leaving the wilds, not a leak.
    this.waterTexture?.dispose();
    this.scene.clear();
    this.billboards.length = 0;
    this.structures.length = 0;
    this.hitboxes.length = 0;
    this.lamps.length = 0;
    this.signs.length = 0;
  }
}
