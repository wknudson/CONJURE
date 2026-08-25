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
import type { ColliderSet } from './collision.js';
import {
  TILE,
  extractRects,
  groundRowsOf,
  splitRun,
  waterRowsOf,
  xOfCol,
  zOfRow,
  type AreaDef,
} from './map.js';
import {
  bakeGround,
  makeBoardTexture,
  makeCrateTexture,
  makeGateTexture,
  makeOutskirtsTexture,
  makeGraffitiTexture,
  makeSignTexture,
  makeTreeTexture,
  makeWallTexture,
  makeWaterTexture,
  mulberry32,
  configurePixelTexture,
} from './textures.js';
import { BillboardSprite } from './sprites3d.js';

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
  light: THREE.PointLight;
  head: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  phase: number;
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
  private readonly signs: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>[] = [];
  private readonly impacts: ImpactLight[] = [];
  /** Absent in an area with no canal. `dispose` and `scrollWater` both allow for it. */
  private readonly waterTexture: THREE.Texture | null = null;
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

  private readonly occRay = new THREE.Raycaster();
  private readonly occDir = new THREE.Vector3();
  private readonly occTarget = new THREE.Vector3();
  private readonly occHit = new Set<THREE.Object3D>();

  constructor(
    area: AreaDef,
    private readonly colliders: ColliderSet,
    maxAnisotropy: number,
  ) {
    // The ambience is the area's; the camera and the film are the game's. See `AMBIENT`.
    const amb = ambientFor(area.id);
    this.amb = amb;
    this.scene.fog = new THREE.FogExp2(amb.fogColor, amb.fogDensity);
    this.scene.background = new THREE.Color(amb.fogColor);

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
      water.position.set(0, -0.5, zOfRow(area, 0) - TILE / 2 + depth / 2 - 1);
      this.scene.add(water);

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
          const cx = xOfCol(area, rect.col + off) - TILE / 2 + (w * TILE) / 2;
          const cz = zOfRow(area, rect.row) - TILE / 2 + (rect.d * TILE) / 2;
          // Capped well under the camera's sight line to the player, so the occlusion fade
          // is a safety net for the awkward angles rather than a thing that runs constantly.
          const h = solid.minHeight + buildRng() * (solid.maxHeight - solid.minHeight);
          this.addStructure(
            wallTexture,
            cx,
            cz,
            w * TILE - solid.inset,
            h,
            rect.d * TILE - solid.depthInset,
            { chimney: buildRng() < solid.chimneyChance ? 1.6 + buildRng() * 1.8 : 0 },
          );
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

    /* --- dressing --- */
    const trees = area.props.trees ?? [];
    if (trees.length > 0) {
      const treeTexture = makeTreeTexture();
      for (const t of trees) this.addBillboard(treeTexture, 3, 4, t.x, t.z);
    }

    const crates = area.props.crates ?? [];
    if (crates.length > 0) {
      const crateTexture = makeCrateTexture();
      for (const c of crates) this.addCrate(crateTexture, c.x, c.z, c.size ?? 1.1);
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
       One per exit. It is scenery and a wall with a hole in it: the collider spans the
       opening so you cannot walk round the frame, and the hotspot in front of it is what
       actually takes you through. */
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
    this.hemi = new THREE.HemisphereLight(amb.skyColor, amb.groundBounce, amb.ambientIntensity);
    this.scene.add(this.hemi);

    this.sun = new THREE.DirectionalLight(amb.sunColor, amb.sunIntensity);
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
    this.lamps.push({ light, head, phase: this.lamps.length * 1.7 });
  }

  /* ============================================================
     Per-frame
     ============================================================ */

  updateLamps(t: number): void {
    for (const l of this.lamps) {
      // Two summed sines read as a gas flame and allocate nothing.
      const n =
        0.5 +
        0.5 * (Math.sin(t * 6.3 + l.phase) * 0.6 + Math.sin(t * 11.7 + l.phase * 2.1) * 0.4);
      l.light.intensity = LOOK.lampIntensity * (1 - LOOK.lampFlicker + LOOK.lampFlicker * n * 2);
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
      const want = this.occHit.has(s.hit) ? 0.04 : 1;
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

  applyFog(): void {
    (this.scene.fog as THREE.FogExp2).color.set(this.amb.fogColor);
    (this.scene.fog as THREE.FogExp2).density = this.amb.fogDensity;
    (this.scene.background as THREE.Color).set(this.amb.fogColor);
  }

  applySun(): void {
    this.sun.intensity = this.amb.sunIntensity;
    this.sun.color.set(this.amb.sunColor);
  }

  applyAmbient(): void {
    this.hemi.intensity = this.amb.ambientIntensity;
    this.hemi.color.set(this.amb.skyColor);
    this.hemi.groundColor.set(this.amb.groundBounce);
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
