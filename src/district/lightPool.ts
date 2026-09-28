/**
 * Which of an area's fires get a real light this frame, and how much of one.
 *
 * Every gas lamp, brazier and ember vent used to own a `PointLight`, and three.js lights a
 * Lambert pixel by looping over **every** point light in the scene -- culled or not, lit or
 * out. Ashfall had seventeen and the Cinderworks sixteen at twenty tiles across; at twice the
 * ground and three times the furniture, the light count is the first thing that falls over, and
 * on a weaker GPU it can fail shader compilation outright. And because three.js bakes the count
 * into every lit shader, adding or removing one mid-walk recompiles the scene.
 *
 * So an area gets a fixed pool, built once and warmed with the rest of its shaders, and each
 * frame the pool is handed to the fires nearest whoever the camera is following. The lamps
 * further out keep their unlit heads -- which are what bloom picks out at a distance anyway --
 * and lose only the pool of light on the flags under them, which the fog has usually eaten by
 * then.
 *
 * The only hard part is not popping. A light that switched off because another fire drew a
 * hair nearer would flash across a whole street. So each fire's share fades with how far it is
 * *inside* the cut: the cut is the distance of the nearest fire that did not make the pool, and
 * a fire at the cut gets nothing. Two fires trading places across the cut are both at zero at the
 * moment they trade, so nothing visible ever switches.
 */

const scratch = { dist: new Float32Array(0), order: [] as number[] };

/** Where a fire is. Only the ground position ranks it; height does not bring a lamp nearer. */
export interface FirePoint {
  readonly x: number;
  readonly z: number;
}

/**
 * Each fire's share of a real light, 0 to 1, written into `out` (one slot per fire).
 *
 * At most `pool` fires have a share above zero. With no more fires than lights every fire
 * gets a whole one, always. `band` is how far inside the cut a fire must be to burn at full
 * strength -- a few units, so the fade happens off to the side of the screen.
 */
export function poolShares(
  fires: readonly FirePoint[],
  fx: number,
  fz: number,
  pool: number,
  band: number,
  out: Float32Array,
): void {
  const n = fires.length;
  if (n <= pool) {
    out.fill(1, 0, n);
    return;
  }
  // Scratch kept between frames: this runs every frame and allocates nothing once warm.
  if (scratch.dist.length < n) {
    scratch.dist = new Float32Array(n);
    scratch.order = new Array<number>(n);
  }
  const { dist, order } = scratch;
  order.length = n;
  for (let i = 0; i < n; i++) {
    dist[i] = Math.hypot(fires[i]!.x - fx, fires[i]!.z - fz);
    order[i] = i;
  }
  order.sort((a, b) => dist[a]! - dist[b]!);
  const cut = dist[order[pool]!]!;
  out.fill(0, 0, n);
  for (let r = 0; r < pool; r++) {
    const i = order[r]!;
    out[i] = Math.min(1, Math.max(0, (cut - dist[i]!) / band));
  }
}
