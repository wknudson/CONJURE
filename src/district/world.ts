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
import { LOOK } from './look.js';
import type { ColliderSet } from './collision.js';
import {
  BOARD_POS,
  CRATES,
  DOORS,
  GATE_POS,
  GRID,
  LAMPS,
  TILE,
  TREES,
  extractRects,
  splitRun,
  xOfCol,
  zOfRow,
} from './map.js';
import {
  GROUND_ROW0,
  GROUND_ROWS,
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

const GROUND_W = GRID * TILE;
const GROUND_D = GROUND_ROWS * TILE;
const GROUND_CZ = zOfRow(GROUND_ROW0) - TILE / 2 + GROUND_D / 2;

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
  private readonly waterTexture: THREE.Texture;
  private readonly colliderHelpers = new THREE.Group();

  private readonly occRay = new THREE.Raycaster();
  private readonly occDir = new THREE.Vector3();
  private readonly occTarget = new THREE.Vector3();
  private readonly occHit = new Set<THREE.Object3D>();

  constructor(
    private readonly colliders: ColliderSet,
    maxAnisotropy: number,
  ) {
    this.scene.fog = new THREE.FogExp2(LOOK.fogColor, LOOK.fogDensity);
    this.scene.background = new THREE.Color(LOOK.fogColor);

    /* --- ground, outskirts, canal --- */
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(GROUND_W, GROUND_D),
      new THREE.MeshLambertMaterial({ map: bakeGround(maxAnisotropy) }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, 0, GROUND_CZ);
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

    this.waterTexture = makeWaterTexture();
    // Unlit on purpose: no lamp reaches the canal, and a Lambert surface out there renders
    // as pure black. Basic material lets the water carry its own moonlight, and it still
    // takes fog so it fades into the smog like everything else.
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(GROUND_W, GROUND_ROW0 * TILE + 2),
      new THREE.MeshBasicMaterial({ map: this.waterTexture }),
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, -0.5, zOfRow(0) - TILE / 2 + (GROUND_ROW0 * TILE + 2) / 2 - 1);
    this.scene.add(water);

    const quay = new THREE.Mesh(
      new THREE.BoxGeometry(GROUND_W, 0.7, 0.7),
      new THREE.MeshLambertMaterial({ color: 0x2a2b30 }),
    );
    quay.position.set(0, -0.15, zOfRow(GROUND_ROW0) - TILE / 2 - 0.35);
    quay.castShadow = true;
    quay.receiveShadow = true;
    this.scene.add(quay);

    /* --- buildings, read straight out of the map --- */
    const wallTexture = makeWallTexture();
    const buildRng = mulberry32(4242);
    for (const rect of extractRects('B')) {
      for (const [off, w] of splitRun(rect.w)) {
        const cx = xOfCol(rect.col + off) - TILE / 2 + (w * TILE) / 2;
        const cz = zOfRow(rect.row) - TILE / 2 + (rect.d * TILE) / 2;
        // Capped well under the camera's sight line to the player, so the occlusion fade
        // is a safety net for the awkward angles rather than a thing that runs constantly.
        const h = 4.8 + buildRng() * 2.2;
        this.addStructure(wallTexture, cx, cz, w * TILE - 0.3, h, rect.d * TILE - 0.3, {
          chimney: buildRng() < 0.4 ? 1.6 + buildRng() * 1.8 : 0,
        });
      }
    }
    for (const rect of extractRects('V')) {
      for (const [off, w] of splitRun(rect.w)) {
        const cx = xOfCol(rect.col + off) - TILE / 2 + (w * TILE) / 2;
        const cz = zOfRow(rect.row) - TILE / 2 + (rect.d * TILE) / 2;
        this.addStructure(wallTexture, cx, cz, w * TILE - 0.1, 3.2, rect.d * TILE - 1.6, {});
      }
    }
    wallTexture.dispose();

    /* --- the far city, pure silhouette in the smog --- */
    const skyRng = mulberry32(88);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + skyRng() * 0.2;
      const r = 52 + skyRng() * 22;
      const h = 12 + skyRng() * 22;
      const block = new THREE.Mesh(
        new THREE.BoxGeometry(6 + skyRng() * 8, h, 6 + skyRng() * 8),
        new THREE.MeshLambertMaterial({ color: 0x171419 }),
      );
      block.position.set(Math.cos(a) * r, h / 2, Math.sin(a) * r);
      this.scene.add(block);
    }

    /* --- dressing --- */
    const treeTexture = makeTreeTexture();
    for (const t of TREES) this.addBillboard(treeTexture, 3, 4, t.x, t.z);

    const crateTexture = makeCrateTexture();
    for (const c of CRATES) this.addCrate(crateTexture, c.x, c.z, c.size ?? 1.1);

    /* --- door plaques --- */
    for (const door of DOORS) {
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
       the plaques, so the words hold in the dark the way chalk does. */
    const GRAFFITI: { text: string; door: number; dx: number; tint: string }[] = [
      { text: 'THE ENGINES EAT OUR MARROW', door: 0, dx: 3.2, tint: '#b7ae9d' },
      { text: 'THE CENSUS COUNTS DOWN', door: 1, dx: -3.4, tint: '#a46a4a' },
      { text: "VANE'S LIGHT IS OUR DARK", door: 2, dx: 3.0, tint: '#b7ae9d' },
    ];
    for (const g of GRAFFITI) {
      const door = DOORS[g.door];
      if (!door) continue;
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
      const facesSouth = door.signZ < door.z;
      scrawl.position.set(door.signX + g.dx, 1.15, door.signZ + (facesSouth ? 0.09 : -0.09));
      if (!facesSouth) scrawl.rotation.y = Math.PI;
      scrawl.rotation.z = 0.03 * (g.dx > 0 ? -1 : 1); // hand-drawn, not hung level
      this.scene.add(scrawl);
      this.attachToStructure(door.signX, door.signZ, scrawl.material);
    }

    /* --- the bounty board --- */
    const boardPost = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 1.6, 0.24),
      new THREE.MeshLambertMaterial({ color: 0x2a2118 }),
    );
    boardPost.position.set(BOARD_POS.x, 0.8, BOARD_POS.z);
    boardPost.castShadow = true;
    this.scene.add(boardPost);
    const board = this.addBillboard(makeBoardTexture(), 2.4, 2.0, BOARD_POS.x, BOARD_POS.z);
    board.position.y = 1.4;
    this.colliders.add(BOARD_POS.x, BOARD_POS.z, 0.9, 0.5, 'board');

    /* --- the sealed gate --- */
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
    gate.position.set(GATE_POS.x, 0, GATE_POS.z);
    gate.castShadow = true;
    this.scene.add(gate);
    this.colliders.add(GATE_POS.x, GATE_POS.z, 8, 1.2, 'gate');

    /* --- lighting rig --- */
    this.hemi = new THREE.HemisphereLight(LOOK.skyColor, LOOK.groundBounce, LOOK.ambientIntensity);
    this.scene.add(this.hemi);

    this.sun = new THREE.DirectionalLight(LOOK.sunColor, LOOK.sunIntensity);
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

    for (const l of LAMPS) this.addLamp(l.x, l.z);

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
    (this.scene.fog as THREE.FogExp2).color.set(LOOK.fogColor);
    (this.scene.fog as THREE.FogExp2).density = LOOK.fogDensity;
    (this.scene.background as THREE.Color).set(LOOK.fogColor);
  }

  applySun(): void {
    this.sun.intensity = LOOK.sunIntensity;
    this.sun.color.set(LOOK.sunColor);
  }

  applyAmbient(): void {
    this.hemi.intensity = LOOK.ambientIntensity;
    this.hemi.color.set(LOOK.skyColor);
    this.hemi.groundColor.set(LOOK.groundBounce);
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
    this.waterTexture.dispose();
    this.scene.clear();
    this.billboards.length = 0;
    this.structures.length = 0;
    this.hitboxes.length = 0;
    this.lamps.length = 0;
    this.signs.length = 0;
  }
}
