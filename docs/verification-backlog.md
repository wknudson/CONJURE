# Verification backlog — what has been seen, and what has not

The district's whole time-of-day layer — the clock, the lamps, the lamplighters, the changing
sky, the Warden's beat, the pack shifts — was built and committed **without ever being looked
at**. This file records what has since been verified against real pixels, what has not, and, most
importantly, **how to verify it**, because getting a frame out of this project turned out to be
the hard part and that knowledge is worth more than the results.

Written for whoever picks this up next. Nothing here is a bug report unless it says so.

---

## How to get a frame at all

Two independent things stop the district rendering, and neither is detectable the obvious way.

**1. A hidden Browser pane gives the page a zero-size window.** `window.innerWidth` and
`innerHeight` are **0**, so the canvas is 0×0 and the post-processing render targets are
incomplete — the console fills with `GL_INVALID_FRAMEBUFFER_OPERATION: Attachment has zero size`.
`requestAnimationFrame` never fires, so three.js draws nothing and the district's async actor load
never completes: no player, no follower, no packs.

The trap is that `document.hidden` is `false` and `document.visibilityState` is `"visible"`
throughout. The Page Visibility API says the page is fine. Only the window size and a rAF tick
counter reveal otherwise. Check it like this:

```js
let n = 0; const t = performance.now();
(function loop(){ n++; requestAnimationFrame(loop); })();
setTimeout(() => console.log({ innerWidth: window.innerWidth, rafTicks: n }), 1000);
```

`resize_window` on the tab fixes the *size* (and silences the framebuffer errors) but not rAF.

**2. A background Chrome tab is throttled to almost nothing.** Driving the app in the user's real
Chrome, rAF drops to ~0 and `setInterval` to about 1 Hz — measured **14 timer callbacks in 12.4
seconds** where 410 were scheduled. `document.visibilityState` is `"hidden"` and
`document.hasFocus()` is `false` here, so this one *is* honestly reported.

A `computer` `left_click` on the page activates the tab (`hasFocus: true`, `visibility:
"visible"`, rAF resumes at roughly 6 fps) but it reverts as soon as automation stops driving it,
and there is no tab-activation tool in the Chrome toolset — only create, close and context. **A
human focusing the tab is currently the only way to get sustained real frames.**

### What does work

`window.__district`, installed in `mount` under a DEV guard — deliberately in `mount` and not in
`loadActors`, because `loadActors` is exactly what stalls. It exposes `frame`, `renderer`, `post`,
`world`, `camera`, `area`, `player`, `follower`, `packs`, `warden`, `combat`, `cameraYaw`,
`setCameraYaw`, `ambush`.

- **A screenshot forces a paint.** That is why screenshots return real images even when rAF is
  dead, and taking one is also what lets a parked `loadActors` finish. Screenshot first, then
  probe.
- **`__district.frame()` takes no arguments.** It calls `this.loop()`, which reads `dt` from a real
  `THREE.Clock` and clamps it to 0.05. Calling it in a tight synchronous loop therefore advances
  game time by *almost nothing*, because no real time passed between `getDelta()` calls. Passing a
  dt is silently ignored. This wasted a lot of time — do not use it to fast-forward the clock.
- **`renderer.info.render.calls` reads 1 even on a good frame**, because rendering goes through the
  `post` composer. It is not a rendering-failed signal.
- **`gl.readPixels` works** immediately after a forced frame, which makes real measurement possible:

```js
const gl = __district.renderer.getContext();
const buf = new Uint8Array(w * h * 4);
__district.world.setHour(12); __district.frame();
gl.readPixels(x, y, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
```

- **Vite serves the TS modules in dev**, so registries can be pulled into the page:
  `await import('/src/core/data/encounters/index.ts')` gives you `ENCOUNTERS`. Same for
  `/src/district/map.ts` (`isWalkable`, `isSafeAt`).
- Keep evaluated scripts **short**. The CDP `Runtime.evaluate` bridge times out at 45s and long
  loops with awaits get killed mid-run.

### Two measurement traps

Both of these produced findings that looked like bugs and were not:

- `world.setHour(h)` sets the **world's** hour only. The screen's own `this.hour` is untouched, so
  the HUD and anything driven from `tickClock` — notably the lamplighter — do not follow. Lamps
  measured this way all share one value, which looks like the lamplighter is broken. It is not; it
  simply never ran.
- The clock only advances through `tickClock`, which needs real elapsed time. See the `frame()`
  note above.

---

## Verified against real pixels

All measured in Ashfall Ward and the Cinderworks, via `readPixels` on a central crop.

**The daylight curve is exactly as designed.** Flat night, a three-hour dawn ramp, a flat day, a
three-hour dusk, and dawn and dusk mirror each other precisely — hour 5 ≡ hour 19, hour 6 ≡ hour
18. The day plateau is *bitwise identical* across 07:00, 09:00, 12:00, 15:00 and 17:00.

| hour | luminance (Cinderworks) | saturation | warm cast |
|---|---|---|---|
| 00, 03 | 58 | 0.497 | +40.5 |
| 05 | 75.1 | 0.361 | +34.6 |
| 06 | 113.2 | 0.160 | +19.5 |
| 07–17 | 134 | 0.099 | +12.3 |
| 18 | 113.2 | 0.160 | +19.5 |
| 19 | 75.1 | 0.361 | +34.6 |
| 20, 22 | 58 | 0.497 | +40.5 |

Ashfall runs darker at night — 22.5 at 01:00 against 123.6 at noon. Fog goes `#2b2119` → `#8e8c83`
in the Cinderworks.

**The one-hour lamp lag is real and visible.** `lampsAt(hour) = 1 - daylightAt(hour - 1)` shows up
as lamps still burning at 0.26 at 07:00 and already at 0.74 by 20:00 — going out late and coming on
early, which is what a lamplighter's round looks like from outside.

**The sky changes per ward and per day, and thins rather than fades.** Ashfall's ash drew **210 of
340** motes; the Cinderworks' drew **174 of 340**. Different wards, same day, neither at zero and
neither at full.

**Sidewalk Immunity reads correctly.** Moving the player off sanctioned paving flips the banner
from `SANCTIONED WALKWAY — SAFE` to `UNPAVED GROUND — EXPOSED`, the scene darkens away from the lit
walkway, and an `ambush()` on sanctioned ground is *correctly refused*.

Also confirmed present and rendering: the player and follower sprites, ground textures, bloom on
the ward signage, the Warden's detection ring, and the interaction prompts.

---

## Found by looking, and fixed

**The hour readout was frozen, in two independent ways.** Committed as part of this work.

1. `DistrictScreen` handed the HUD `hour: () => this.opts.hour` — the hour the screen was
   *mounted* at. `tickClock` advances `this.hour`, and that is what the world, the Warden, the
   packs, the lamps and the sky all read. Everything moved except the number on screen.
2. `renderLedger()` was called only at mount and on a purse change, so even reading the live hour
   the DOM never refreshed.

Every test passed before the fix and after, because `clockLabel` and `phaseAt` are pure and
correct — they were being asked the wrong question. **This is the class of bug the whole file
exists to warn about: a unit test cannot see a value that is never handed to it.**

⚠️ **Both fixes are themselves unverified in a browser.** They were derived from the symptom and
the source, they typecheck, and 560 tests pass — but nobody has watched the readout move. This is
the first thing to confirm.

---

## Not verified — the actual backlog

Roughly in order of value.

| # | What | Why it is still open |
|---|---|---|
| 1 | **The hour readout advancing** | The two fixes above. Needs ~30s of sustained real frames, i.e. a focused tab. If the ledger ticks off `01:00 · night`, both are confirmed. |
| 2 | **The lamplighter walking the row** | Driven from `tickClock`, so it needs the clock genuinely running. The tell: the ten `world.lamps` values **diverging from each other**, lighting one at a time behind him. All ten sharing a value means he never ran — see the measurement trap above. Ashfall is the longest round at 10 lamps; Lamprow's seven on the High Street are the authored showcase. |
| 3 | **In-world combat** | The original request that started this work, and completely unseen. Three parts: on-world sprites must **disappear** when the board comes up (the reported bug was roaming minions still rendered after starting a fight with them); the camera must **orbit** (`setCameraYaw` is exposed on the dev handle); and the grid must be **legible**. `ambush('curfew_breakers')` returns `undefined` and declines silently *even on exposed ground*, so there is a further guard — cooldown, or the Warden's grace — that needs live frames to find. Ashfall has no packs; Lamprow, the Chalk Verge and the Chalk Road do. |
| 4 | **The gate art in situ** | Redrawn as closed, latched and unwarded in two leaves. `gateArt.test.ts` asserts the composition by rendering the texture to a text grid under node, but nobody has seen it on the mesh at 8×4.6 world units. |
| 5 | **A night/noon pass across all nineteen wards** | Only two wards have been measured. |
| 6 | **The Warden's beat and the pack shifts** | Pure functions of the clock and unit-tested as such; never watched. |
| 7 | **Errands, stalls and asides end to end** | Registry-tested only. No errand has been walked from offer to reward in a browser. |

### One open question for the art side, not a bug

Noon is very desaturated: **0.099 against 0.497 at night**, and the noon fog `#8e8c83` is near
neutral grey. `DAY_FOG` is a single constant blended at 0.72 for every area and fog is the hard
ceiling on brightness, so **all nineteen wards probably converge on a similar grey midday**. Only
one ward was measured; the rest is inference from the constant.

This is the side effect of a deliberate earlier fix. Blending toward one common daylight solved a
real problem — multiplying amplified the spread until the Tallow Levels were four times Saltglass
at noon — but it also flattens what makes each ward look like itself in daylight. Whether that is
correct for a smog-bound city is a judgement call, not a defect.
