/**
 * The event-handler registry: one animation per logic event type.
 *
 * Handlers own all view-state mutation. Because the sequencer awaits each step, view
 * state is always a correct replay of the past even though logic state has already
 * raced ahead to the future.
 */

import type { Coord, Side, UnitId } from '../contract/ids.js';
import type { UnitSnapshot } from '../contract/snapshots.js';
import type { Sequencer } from './Sequencer.js';
import { easeInOutQuad, easeInQuad, easeOutBack, easeOutQuad, tween } from './tween.js';
import type { EntityViewMap } from '../render/EntityViews.js';
import { lerpCoord } from '../render/EntityViews.js';
import type { Fx } from '../render/Fx.js';
import { FLOATER_FOR_DTYPE } from '../render/Fx.js';
import type { Sfx } from '../sound/Sfx.js';
import type { Hud } from '../hud/Hud.js';
import type { TetherModel } from '../render/BoardRenderer.js';
import { schoolOf, statusColor } from '../render/palette.js';
import { ownerOfKind } from '../hud/cardFace.js';
// Read-only data, the same way `cardFace.ts` reads it: the house rule forbids *editing*
// the core from the presentation layer, not knowing what an Aura's school is.
import { AURAS } from '../core/data/auras.js';

/**
 * Somewhere to hang the tether.
 *
 * Named as a sink rather than typed as the renderer because that is the whole of what the
 * handlers below do with it: assign a model, or clear it. Whoever draws the cable reads the
 * field on its own frame. `BoardRenderer` satisfies this with the public field it already
 * has, and so does the board out in the district — which is the point.
 */
export interface TetherSink {
  tether: TetherModel | null;
}

export interface CombatView {
  views: EntityViewMap;
  fx: Fx;
  sfx: Sfx;
  hud: Hud;
  /**
   * Needed for board furniture that is driven by events rather than by board state — at
   * present the Aetheric Tether, which `BoardView` does not carry and which cannot be
   * added to it without editing the core.
   */
  renderer: TetherSink;
  /**
   * Where a side's Hero or Companion figure stands, in tile coordinates — fractional and
   * off-grid included, which both cameras project happily.
   *
   * The commander figures are the one piece of the scene the two shells draw with nothing
   * in common (`BoardRenderer.commanders` on one, `BodyLayer.setStands` on the other), so
   * the handlers ask rather than reach. Optional, like `snapshotOf` below: a shell that
   * cannot answer simply loses the flourish, not the fight.
   */
  casterAnchor?: (side: Side, owner: 'hero' | 'companion') => Coord | null;
  /**
   * The current snapshot of a unit the views have never met.
   *
   * Exists for `unitRevived`, which deliberately carries no snapshot of its own. Logic
   * state has already raced ahead of the animation, so the shell can answer from the board
   * it is holding.
   */
  snapshotOf?: (unitId: UnitId) => UnitSnapshot | null;
}

/** Held beat before a death resolves, so removing a piece has weight. */
const MINION_HITSTOP_MS = 150;
const BEHEMOTH_HITSTOP_MS = 400;

/**
 * The colour a status tick's name-tag wears — the same element its damage number below
 * arrives in, so the two read as one beat. Anything unlisted names itself in plain text.
 */
const TICK_FLOATER: Record<string, string> = {
  burn: 'fire',
  toxin: 'toxic',
};

/** A pause that respects the sequencer's speed scaling, so skip still skips. */
function hold(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function registerHandlers(seq: Sequencer<CombatView>): void {
  /**
   * The Alpha's body, remembered from the seal until the Rite is cast.
   *
   * The two events can be many turns apart — the beast seals itself, and the player takes
   * as long as they like to draw the Rite and choose who holds it — so the id has to
   * survive between them. Scoped to this registration, which is one combat.
   */
  let sealedBossId: string | undefined;

  // ---------------------------------------------------------------- board setup

  seq.on('combatStarted', async (e, { view, t }) => {
    // Curtain-up. The first event of every fight was entirely unobserved — the name of
    // the thing you walked into deserves a beat before the first body drops in. The
    // turn banner that follows the setup replaces it naturally.
    view.hud.banner(e.encounterName.toUpperCase(), 'foe');
    view.sfx.play('chime', { pitch: 0.8 });
    await hold(t(900));
  });

  seq.on('unitDeployed', async (e, { view, t }) => {
    // Deployment used to be silent: a body appeared on the next view sync as if it had
    // always been there. It lands now — the same drop the summon has, a size smaller,
    // because placing a piece is a decision and not yet an act of magic.
    view.sfx.play('card');
    const snap = view.snapshotOf?.(e.unitId);
    if (!snap) return;
    if (!view.views.get(e.unitId)) {
      const v = view.views.addUnit(snap);
      v.elev = 30;
      await tween(t(200), easeOutBack, (k) => {
        v.elev = 30 * (1 - k);
      });
      v.elev = 0;
    }
  });

  seq.on('unitRecalled', async (e, { view, t }) => {
    // The event carries no unit id — the body is already gone from the board — so the
    // view to lift off is found by where it was standing. The idle re-sync would drop
    // it anyway; this just makes being picked back up look like being picked up.
    const v = view.views
      .all()
      .find((x) => x.snapshot?.side === 'player' && roundOf(x.pos).x === e.at.x && roundOf(x.pos).y === e.at.y);
    view.sfx.play('rasp');
    if (!v) return;
    await tween(t(160), easeOutQuad, (k) => {
      v.alpha = 1 - k;
      v.elev = k * 18;
    });
    view.views.remove(v.id);
  });

  seq.on('deploymentEnded', (e, { view }) => {
    view.hud.flashNotice(`The line is set — ${e.fielded} fielded`);
    view.sfx.play('gear_lock');
  });

  seq.on('unitSummoned', async (e, { view, t }) => {
    const v = view.views.addUnit(e.unit);
    view.sfx.play('card');
    // Drop in from above with a slight overshoot.
    v.elev = 46;
    await tween(t(220), easeOutBack, (k) => {
      v.elev = 46 * (1 - k);
    });
    v.elev = 0;
  });

  seq.on('obstacleSpawned', async (e, { view, t }) => {
    const v = view.views.addObstacle(e.obstacle);
    view.sfx.play('card');
    v.elev = 36;
    await tween(t(190), easeOutQuad, (k) => {
      v.elev = 36 * (1 - k);
    });
    v.elev = 0;
  });

  // ---------------------------------------------------------------- movement

  seq.on('unitMoved', async (e, { view, t }) => {
    const v = view.views.get(e.unitId);
    if (!v || e.path.length < 2) return;

    for (let i = 0; i < e.path.length - 1; i++) {
      const from = e.path[i]!;
      const to = e.path[i + 1]!;
      await tween(t(120), easeOutQuad, (k) => {
        v.pos = lerpCoord(from, to, k);
        v.elev = Math.sin(k * Math.PI) * 6;
      });
      v.pos = { ...to };
      v.elev = 0;
    }
  });

  seq.on('unitDisplaced', async (e, { view, t }) => {
    const v = view.views.get(e.unitId);
    if (!v) return;
    view.sfx.play('hit');
    await tween(t(130), easeInQuad, (k) => {
      v.pos = lerpCoord(e.from, e.to, k);
    });
    v.pos = { ...e.to };
  });

  seq.on('collision', async (e, { view, t }) => {
    view.sfx.play('crash');
    view.fx.screenShake(7, t(240));
    view.fx.crashBadge(e.at);

    const v = view.views.get(e.unitId);
    if (!v) return;
    await tween(t(170), easeOutQuad, (k) => {
      v.squash = Math.sin(k * Math.PI);
    });
    v.squash = 0;
  });

  // ---------------------------------------------------------------- combat

  seq.on('attackDeclared', async (e, { view, t }) => {
    const v = view.views.get(e.attackerId);
    if (!v) return;

    // Where the blow is going. A body or obstacle answers from its view; a portrait
    // answers from wherever that side's Commander is standing, so a swing at the throne
    // leans the same way every other swing does.
    const at: Coord | null =
      e.target.kind !== 'portrait'
        ? (view.views.get(e.target.id)?.pos ?? null)
        : (view.casterAnchor?.(e.target.side, 'hero') ?? null);

    // A shot that crosses ground gets a tracer; a melee swing does not. A blade that
    // already reached is not a projectile, and a line drawn between two adjacent tiles is
    // a smear rather than a shot — the lunge below is what sells those.
    const snap = v.snapshot;
    const reach = at
      ? Math.max(Math.abs(at.x - v.pos.x), Math.abs(at.y - v.pos.y))
      : 1;
    if (snap && at && reach > 1 && e.target.kind !== 'portrait') {
      view.fx.tracer(v.pos, at, schoolOf(snap.school).main, snap.attackProfile === 'arcing', t(220));
    }

    // The swing itself: motion with a direction, not just a hop in place. Both are
    // round trips on `sin(kπ)`, so a skip's `finishAll()` lands at k=1 — the origin —
    // and nothing is left to clean up.
    const base = { ...v.pos };
    const span = at ? Math.hypot(at.x - base.x, at.y - base.y) : 0;
    const dir = span > 0 ? { x: (at!.x - base.x) / span, y: (at!.y - base.y) / span } : null;

    if (dir && reach <= 1) {
      // Melee: the body throws itself at the target and recovers. 0.35 tiles keeps the
      // depth sort honest — the attacker never rounds into its victim's cell.
      await tween(t(240), easeInOutQuad, (k) => {
        const s = Math.sin(k * Math.PI);
        v.pos = { x: base.x + dir.x * 0.35 * s, y: base.y + dir.y * 0.35 * s };
        v.elev = 6 * s;
      });
    } else if (dir) {
      // Ranged: the tracer carries the shot; the body just absorbs the loosing of it,
      // a short kick away from the target.
      await tween(t(150), easeOutQuad, (k) => {
        const s = Math.sin(k * Math.PI);
        v.pos = { x: base.x - dir.x * 0.12 * s, y: base.y - dir.y * 0.12 * s };
        v.elev = 10 * s;
      });
    } else {
      // No target to lean toward — the old vertical hop still says "I acted".
      await tween(t(110), easeOutQuad, (k) => {
        v.elev = Math.sin(k * Math.PI) * 10;
      });
    }
    v.pos = base;
    v.elev = 0;
  });

  seq.on('damageDealt', async (e, { view, t }) => {
    if (e.target.kind === 'portrait') {
      view.hud.setCommanderHp(e.target.side, e.remainingHp);
      if (e.hpLoss > 0) {
        view.hud.pulsePact(e.target.side);
        view.sfx.play('hit');
        // Damage redirected from a Bound Form names the tile it happened on. Showing the
        // number there as well as on the gauge is what connects the two: the hit landed
        // on your Companion, and your Pact is what paid for it.
        if (e.at) view.fx.damageNumber(e.at, e.hpLoss);
      }
      return;
    }

    const v = view.views.get(e.target.id);
    if (v) {
      v.hp = e.remainingHp;
      v.armor = Math.max(0, v.armor - e.absorbedByArmor);
      // The blanch: a body that actually bled goes white for a beat. The wash the status
      // system already decays, borrowed at full brightness — one line, both boards.
      if (e.hpLoss > 0) v.flash = { color: '#FFFFFF', life: 1 };
    }

    if (e.at) {
      if (e.hpLoss > 0) view.fx.damageNumber(e.at, e.hpLoss, FLOATER_FOR_DTYPE[e.dtype]);
      else if (e.absorbedByArmor > 0) view.fx.label(e.at, 'ABSORBED', 'absorb');
    }

    // A discharge sounds nothing like a blade. The arcs it throws off are `physical` and
    // deliberately keep the ordinary hit, so one cast reads as a crack and then thumps.
    if (e.hpLoss > 0) view.sfx.play(e.dtype === 'shock' ? 'shock' : 'hit');

    // A heavy blow — forty or more, or half a body in one swing — earns a beat of held
    // silence and a kick of the frame. Gated on the target surviving: a killing blow
    // keeps only the death's own hit-stop, or the two stack into a stutter. Parallel-safe
    // AoE groups run these holds concurrently, so a blast costs one stop, not one per body.
    const heavy = e.hpLoss >= 40 || (v && v.maxHp > 0 && e.hpLoss >= v.maxHp * 0.5);
    if (heavy && e.remainingHp > 0) {
      await hold(t(90));
      view.fx.screenShake(4, t(120));
    }

    const amp = heavy ? 0.75 : 0.6;
    await tween(t(110), easeOutQuad, (k) => {
      if (v) v.squash = Math.sin(k * Math.PI) * amp;
    });
    if (v) v.squash = 0;
  });

  seq.on('armorGained', (e, { view }) => {
    if (e.target.kind === 'portrait') {
      view.hud.setCommanderArmor(e.target.side, e.total);
      return;
    }
    const v = view.views.get(e.target.id);
    if (!v) return;
    v.armor = e.total;
    view.fx.damageNumber(roundOf(v.pos), e.amount, 'armor');
  });

  seq.on('healed', (e, { view }) => {
    if (e.target.kind === 'portrait') {
      view.hud.setCommanderHp(e.target.side, e.remainingHp);
      return;
    }
    const v = view.views.get(e.target.id);
    if (v) {
      v.hp = e.remainingHp;
      view.fx.damageNumber(roundOf(v.pos), e.amount, 'heal');
    }
  });

  // ---------------------------------------------------------------- marks

  seq.on('markAttached', (e, { view }) => {
    const v = view.views.get(e.hostId);
    if (v) v.mark = { school: e.mark.school };
  });

  seq.on('markDetonated', async (e, { view, t }) => {
    const v = view.views.get(e.hostId);
    if (v) v.mark = null;

    // Cascade crescendo. A three-mark chain currently looks like three separate pops;
    // escalating each link turns it into the single loudest thing the game can do.
    // `chainDepth` comes from the engine and is 0 for the mark that starts the chain.
    const link = e.chainDepth + 1;
    view.sfx.play('detonate', { pitch: 1 + Math.min(e.chainDepth, 4) * 0.12 });
    view.fx.screenShake(9 + Math.min(e.chainDepth, 4) * 3, t(300));

    if (link > 1) {
      view.fx.label(e.at, `CASCADE ×${link}${link >= 3 ? '!' : ''}`, 'cascade');
    }

    await view.fx.detonation(e.at, e.school, t(420));
  });

  seq.on('markFizzled', (e, { view }) => {
    const v = view.views.get(e.hostId);
    if (v) {
      v.mark = null;
      view.fx.label(roundOf(v.pos), 'FIZZLE', 'fizzle');
    }
  });

  // ---------------------------------------------------------------- statuses

  seq.on('statusApplied', (e, { view }) => {
    const v = view.views.get(e.unitId);
    if (!v) return;
    const existing = v.statuses.find((s) => s.kind === e.status);
    if (existing) existing.stacks = e.stacks;
    else v.statuses.push({ kind: e.status, stacks: e.stacks });

    // A status changes nothing a player can see — same body, same tile, same health — so
    // without this the only confirmation it landed was reading the log. Synchronous and
    // un-awaited: it is feedback about something that already happened, and making the
    // sequencer wait on it would put a beat between the cast and its own result.
    v.flash = { color: statusColor(e.status), life: 1 };
  });

  seq.on('statusTicked', (e, { view }) => {
    const v = view.views.get(e.unitId);
    if (!v) return;
    v.statuses = v.statuses
      .map((s) => (s.kind === e.status ? { ...s, stacks: e.remaining } : s))
      .filter((s) => s.stacks > 0);

    // Name the tick. The damage itself arrives through `dealDamage` a beat later, as an
    // ordinary damage floater in the element's colour — what was missing was whose fault
    // the number is. A `-6` that appears on nobody's turn now says BURN above itself.
    if (e.damage > 0) {
      view.fx.label(roundOf(v.pos), e.status.toUpperCase(), TICK_FLOATER[e.status] ?? 'note', -58);
    }
  });

  seq.on('escalated', async (e, { view, t }) => {
    const v = view.views.get(e.unitId);
    if (!v) return;
    v.escalation = e.stacks;
    v.atk = e.atk;
    v.hp = e.hp;
    view.fx.label(roundOf(v.pos), 'ESCALATE', 'escalate');
    await tween(t(160), easeOutQuad, (k) => {
      v.elev = Math.sin(k * Math.PI) * 8;
    });
    v.elev = 0;
  });

  // ---------------------------------------------------------------- auras

  // The growth system shipped without a single frame of presentation: a body took an
  // Aura, grew for three turns and hit its Climax entirely in the stat bar. These four
  // are its moments. The school comes off the Aura's own definition — read-only, the
  // way `cardFace` reads card data — with neutral as the fallthrough so an Aura added
  // later is unstyled rather than invisible.
  const auraSchool = (id: string): string => AURAS[id]?.school ?? 'neutral';

  seq.on('auraAttached', async (e, { view, t }) => {
    const v = view.views.get(e.unitId);
    if (v) {
      v.atk = e.atk;
      v.hp = e.hp;
      v.flash = { color: schoolOf(auraSchool(e.aura) as never).main, life: 1 };
      view.fx.label(roundOf(v.pos), e.name.toUpperCase(), 'aura');
      void view.fx.castBurst(roundOf(v.pos), auraSchool(e.aura), t(260));
    }
    await hold(t(200));
  });

  seq.on('auraStacked', async (e, { view, t }) => {
    const v = view.views.get(e.unitId);
    if (!v) return;
    v.atk = e.atk;
    v.hp = e.hp;
    view.fx.label(roundOf(v.pos), `▲ ${e.stacks}`, 'aura');
    await tween(t(160), easeOutQuad, (k) => {
      v.elev = Math.sin(k * Math.PI) * 6;
    });
    v.elev = 0;
  });

  seq.on('auraClimaxed', async (e, { view, t }) => {
    const v = view.views.get(e.unitId);
    if (v) {
      v.atk = e.atk;
      v.hp = e.hp;
      view.fx.label(roundOf(v.pos), 'CLIMAX', 'aura');
      void view.fx.sigilBurst(roundOf(v.pos), auraSchool(e.aura), t(420));
    }
    // The cap is the payoff the player grew three turns toward; it gets the chime and
    // the kick that an ordinary stack does not.
    view.sfx.play('chime', { pitch: 1.2 });
    view.fx.screenShake(5, t(240));
    await hold(t(280));
  });

  seq.on('auraDetonated', async (e, { view, t }) => {
    const v = view.views.get(e.unitId);
    view.sfx.play('detonate', { pitch: 1.1 });
    if (!v) return;
    // The card's own ops carry the consequences; this is just the Aura itself going up.
    await view.fx.detonation(roundOf(v.pos), auraSchool(e.aura), t(380));
  });

  // ---------------------------------------------------------------- removal

  seq.on('unitTithed', (e, { view }) => {
    const v = view.views.get(e.unitId);
    if (!v) return;
    // Two beats, stacked: what was done to the unit, and what it paid out. The second is
    // the reason the player did it, so it should not be left to the dial to report. The
    // wound itself arrives separately, as the ordinary damage floater.
    view.fx.label(roundOf(v.pos), 'TITHE', 'sacrifice');
    if (e.marrow > 0) {
      view.fx.label(roundOf(v.pos), `+${e.marrow} MARROW`, 'marrow', -20);
      view.sfx.play('rasp');
    }
  });

  seq.on('unitConsumed', (e, { view }) => {
    // A body spent whole. No payout to report — whatever it became is its own event.
    const v = view.views.get(e.unitId);
    if (v) view.fx.label(roundOf(v.pos), 'CONSUMED', 'sacrifice');
  });

  seq.on('unitChannelled', async (e, { view, t }) => {
    // A quieter beat than a sacrifice: nothing is lost, the unit simply gives up its
    // swing. A brief lift and a marrow chime, then it settles back as spent — wearing
    // the channel glyph until its owner's next refresh, so "gave up its swing" stays
    // distinguishable from "already swung" for the rest of the round.
    const v = view.views.get(e.unitId);
    if (v) {
      v.channelled = true;
      view.fx.label(roundOf(v.pos), 'CHANNEL', 'marrow');
      if (e.marrow > 0) view.fx.label(roundOf(v.pos), `+${e.marrow} MARROW`, 'marrow', -20);
      // The class ladder pays in more than Marrow now; report the whole yield, stacked
      // above the pair the tile has always shown.
      if (e.bones > 0) view.fx.label(roundOf(v.pos), `+${e.bones} BONE`, 'refund', -60);
      if (e.draw > 0) view.fx.label(roundOf(v.pos), `+${e.draw} DRAW`, 'note', -80);
    }
    view.sfx.play('rasp');
    await tween(t(180), easeOutQuad, (k) => {
      if (v) v.elev = Math.sin(k * Math.PI) * 8;
    });
    if (v) v.elev = 0;
  });

  seq.on('unitEscaped', async (e, { view, t }) => {
    // No hit-stop and no death sound: it got away, which is a disappointment rather than
    // a killing blow, and dressing it as one would misreport who won the exchange.
    const v = view.views.get(e.unitId);
    view.fx.label(e.at, 'ESCAPED', 'note');
    await tween(t(260), easeOutQuad, (k) => {
      if (v) {
        v.alpha = 1 - k;
        v.elev = k * 14;
      }
    });
    view.views.remove(e.unitId);
  });

  seq.on('unitDied', async (e, { view, t }) => {
    const v = view.views.get(e.unitId);

    // Hit-stop. A beat of held silence before the death reads as weight; without it a
    // unit leaving the board has exactly the same texture as a unit being scratched.
    // A Behemoth gets a longer one, because it is a bigger thing to lose.
    await hold(t(e.footprint === 2 ? BEHEMOTH_HITSTOP_MS : MINION_HITSTOP_MS));

    view.sfx.play(e.footprint === 2 ? 'death2' : 'death1');
    if (e.footprint === 2) view.fx.screenShake(8, t(320));

    if (v) {
      await tween(t(230), easeInQuad, (k) => {
        v.alpha = 1 - k;
        v.elev = -14 * k;
      });
    }
    view.views.remove(e.unitId);
  });

  // A rostered body fell and its tile is remembered for a revive. The event was emitted
  // and never drawn: the body simply vanished on the next sync, and the player learned
  // that a pyre existed only when something rose from it. The flare in the Pact's blue is
  // the same one the revive runs backwards, so the two read as one thing.
  seq.on('pyreLit', async (e, { view, t }) => {
    view.fx.label(e.at, 'FALLEN', 'damage');
    void view.fx.pyreFlare(e.at, t(300));
    await hold(t(220));
  });

  seq.on('unitRevived', async (e, { view, t }) => {
    // The most dramatic beat the game had, and until now the body simply popped into
    // existence on the next view sync. The pyre flares in its own pact blue, and the
    // body rises out of it — the death sink, run backwards.
    view.sfx.play('chime');
    view.fx.label(e.at, 'REVIVED', 'refund');
    void view.fx.pyreFlare(e.at, t(360));

    // The event deliberately carries no snapshot; the shell answers from the board that
    // logic state has already raced ahead to. A shell that cannot answer keeps the flare
    // and the label, and the idle re-sync stands the body up plainly.
    const snap = view.snapshotOf?.(e.unitId);
    if (!snap) {
      await hold(t(300));
      return;
    }
    const v = view.views.addUnit(snap);
    v.hp = e.hp;
    v.alpha = 0;
    await tween(t(300), easeOutBack, (k) => {
      v.elev = 30 * (1 - k);
      v.alpha = Math.min(1, k * 1.6);
    });
    v.elev = 0;
    v.alpha = 1;
  });

  seq.on('obstacleDestroyed', async (e, { view, t }) => {
    const v = view.views.get(e.obstacleId);
    view.sfx.play('death1');
    if (v) {
      await tween(t(200), easeInQuad, (k) => {
        v.alpha = 1 - k;
      });
    }
    view.views.remove(e.obstacleId);
  });

  // ---------------------------------------------------------------- resources & cards

  seq.on('boneGained', (e, { view }) => {
    view.hud.setResources(e.side, e.total, undefined);
    if (e.side === 'player') view.sfx.play('bone');
  });

  seq.on('marrowExtracted', async (e, { view, t }) => {
    view.hud.setResources(e.side, undefined, e.total);
    // Glass or a purse: a geode shatters, a scavenger simply drops what it carried.
    view.sfx.play(e.source === 'obstacle' ? 'shatter' : 'rasp');
    if (e.side !== 'player') return;

    // Lifted clear of the damage number, which sits at -30 and lands between these two
    // at the default offsets: a geode always takes the hit that kills it, so unlike a
    // sacrifice or a channel this beat always has a third floater competing for the tile.
    view.fx.label(e.at, `+${e.amount} MARROW`, 'marrow', -60);
    view.fx.label(e.at, e.name.toUpperCase(), 'marrow', -80);
    await tween(t(200), easeOutQuad, () => {});
  });

  seq.on('boneRefunded', async (e, { view, t }) => {
    // The dial moves for both sides; only the player is told about it. An enemy refund
    // still has to reach the HUD or its bank would drift from the truth.
    view.hud.setResources(e.side, e.total, undefined);
    if (e.side !== 'player') return;

    // Anchored to the tile the reaction fired on, not the portrait: the refund is the
    // reward for a setup that landed *there*, and the eye is already looking at it.
    view.fx.label(e.at, `+${e.amount} BONE`, 'refund');
    view.fx.label(e.at, e.name.toUpperCase(), 'refund', -20);
    view.sfx.play('chime');
    await tween(t(200), easeOutQuad, () => {});
  });

  seq.on('resourcesChanged', (e, { view }) => {
    view.hud.setResources(e.side, e.bones, e.marrow);
  });

  seq.on('cardDrawn', (e, { view }) => {
    view.hud.onCardDrawn(e.side, e.card);
  });

  seq.on('cardBurned', (e, { view }) => {
    view.hud.onCardRemoved(e.side, e.card.instanceId);
    if (e.side === 'player') {
      view.hud.flashNotice('Hand full — card burned for Marrow');
      view.sfx.play('rasp');
    }
  });

  seq.on('cardDiscarded', (e, { view }) => {
    view.hud.onCardRemoved(e.side, e.cardId);
  });

  seq.on('cardPlayed', async (e, { view, t }) => {
    // The card's on-screen rect has to be read before the removal detaches it.
    const rect = view.hud.cardRect(e.card.instanceId);
    view.hud.onCardRemoved(e.side, e.card.instanceId);
    view.sfx.play('card');
    if (e.side === 'enemy') view.hud.flashNotice(`Enemy plays ${e.card.name}`);

    // The figure that cast it answers with a sigil. Owner comes off what the card *is* —
    // `ownerOfKind`, not `card.source`, which is 'companion' on Hero-owned Marks — and the
    // burst is fire-and-forget: decoration must not lengthen the turn.
    const anchor = view.casterAnchor?.(e.side, ownerOfKind(e.card.kind));
    if (anchor) void view.fx.sigilBurst(anchor, e.card.school, t(420));

    // `at` exists only for tile-targeted casts; a unit-targeted or global card keeps just
    // the flourish, and its own ops carry the rest of the presentation.
    if (rect && e.at) await view.fx.cardFlight(rect, e.at, e.card.school, t(280));
    if (e.at) await view.fx.castBurst(e.at, e.card.school, t(320));
  });

  seq.on('cardInjected', (e, { view }) => {
    view.hud.onCardDrawn(e.side, e.card);
    view.hud.flashNotice('The beast seals itself — the Rite of Subjugation is drawn!');
    view.sfx.play('win');
  });

  seq.on('cardReturnedToHand', (e, { view }) => {
    view.hud.onCardDrawn(e.side, e.card);
    view.hud.flashNotice(`${e.card.name} evicted — +${e.refundedMarrow} Marrow`);
  });

  // ---------------------------------------------------------------- flow

  seq.on('turnStarted', (e, { view }) => {
    view.hud.setTurn(e.turn, e.side);
    // A channel lasts until the swing it gave up comes back, which is this moment for
    // the side that just refreshed. Cleared here rather than in `syncFrom`, because a
    // channelled body is not exhausted — it keeps its move — so no snapshot field
    // mirrors the glyph and the view layer has to keep its own time.
    for (const v of view.views.all()) {
      if (v.snapshot?.side === e.side) v.channelled = false;
    }
  });

  seq.on('phaseChanged', (e, { view }) => {
    view.hud.setPhase(e.phase, e.side);
  });

  // Reactions are the loudest thing that can happen: name them, flash, and shake.
  seq.on('intentWhiffed', async (e, { view, t }) => {
    view.fx.label(e.at, 'MISS', 'fizzle');
    view.sfx.play('card');
    await tween(t(220), easeOutQuad, () => {});
  });

  seq.on('intentDeclared', () => {
    // Nothing to animate: the board renderer draws declarations continuously from state.
  });

  seq.on('intentsCleared', () => {
    /* likewise */
  });

  /**
   * Reactions route to their own presentation.
   *
   * They are mechanically distinct — one breaks armour, one leaves fog, one consumes a
   * status for area damage — and sharing a single flash threw that away. Each now looks
   * and sounds like the thing it is, so the board is readable without reading the label.
   *
   * An unknown id falls through to the generic burst rather than rendering nothing, so a
   * reaction added later is merely unstyled instead of invisible.
   */
  seq.on('reactionTriggered', async (e, { view, t }) => {
    view.hud.flashNotice(`${e.name}!`);
    view.fx.label(e.at, e.name.toUpperCase(), 'reaction');

    switch (e.reaction) {
      case 'shatter':
        // Rigid failure: hard, brief, and gone.
        view.sfx.play('shatter', { pitch: 1.15 });
        view.fx.screenShake(9, t(140));
        await view.fx.shatterBurst(e.at, t(300));
        return;

      case 'vaporize':
        // Nothing struck anything, so nothing shakes. The cloud outstays the beat because
        // the fog it leaves behind is a real rule, not just a flourish.
        view.sfx.play('hiss');
        await view.fx.steamBloom(e.at, t(520));
        return;

      case 'wildfire':
        // Combustion: a lower, longer rumble under a bloom that turns as it spreads.
        view.sfx.play('wildfire', { pitch: 0.85 });
        view.fx.screenShake(7, t(420));
        await view.fx.wildfireBloom(e.at, t(460));
        return;

      // The other three shared one generic bang for a long time: a detonate cue, a shake,
      // and nothing drawn but the name. Each now looks like the rule it is.
      case 'overload':
        // A charge going off and throwing everything a tile away: the hardest shove in the
        // game, so the biggest shake, and a blast that runs a tile wider than the rest.
        view.sfx.play('detonate', { pitch: 1.1 });
        view.fx.screenShake(10, t(300));
        await view.fx.overloadBlast(e.at, t(380));
        return;

      case 'superconduct':
        // Cold running in, not out. Barely a tremor; the crash of the strip that follows is
        // its own event with its own sound.
        view.sfx.play('shock', { pitch: 0.75 });
        view.fx.screenShake(3, t(200));
        await view.fx.superconductArc(e.at, t(420));
        return;

      case 'arc':
        // Current earthing through the neighbours: a quick crackle and a chain of bolts.
        view.sfx.play('shock', { pitch: 1.25 });
        view.fx.screenShake(4, t(220));
        await view.fx.arcChain(e.at, t(360));
        return;

      default:
        view.sfx.play('detonate');
        view.fx.screenShake(6, t(260));
        await tween(t(300), easeOutQuad, () => {});
        return;
    }
  });

  seq.on('armorStripped', async (e, { view, t }) => {
    const v = view.views.get(e.unitId);
    if (v) v.armor = 0;
    view.sfx.play('crash');
    await tween(t(160), easeOutQuad, () => {});
  });

  seq.on('hazardSpawned', async (_e, { view, t }) => {
    view.sfx.play('rasp');
    await tween(t(220), easeOutQuad, () => {});
  });

  seq.on('hazardExpired', async () => {
    // Purely visual: the renderer stops drawing it on the next board sync.
  });

  seq.on('resonanceTriggered', async (e, { view, t }) => {
    if (e.side !== 'player') return;
    view.hud.flashNotice(`Resonance — ${e.name}`);
    view.sfx.play('rasp');
    await tween(t(180), easeOutQuad, () => {});
  });

  // ---------------------------------------------------------- the Harpoon Protocol

  seq.on('subjugationBegan', async (e, { view, t }) => {
    sealedBossId = e.bossUnitId;
    view.hud.banner('AETHER-PLATED', 'boss');
    view.fx.screenShake(14, t(560));
    await tween(t(760), easeOutQuad, () => {});
  });

  seq.on('anchorSet', async (e, { view, t }) => {
    view.renderer.tether = {
      anchorId: e.unitId,
      ...(sealedBossId ? { bossId: sealedBossId } : {}),
    };
    // Starts from what a snapped tether carried over, not always from nothing.
    view.hud.setSubjugation(e.held, e.of);
    view.fx.label(e.at, e.held > 0 ? `ANCHORED · ${e.held} HELD` : 'ANCHORED', 'tether');
    view.fx.screenShake(8, t(300));
    // The cable under load, for as long as it holds. Synthesised for this and never
    // started; it runs under the fight until the snap or the vault lock ends it, and it
    // deliberately coexists with the Last Stand heartbeat — dying while holding the
    // tether should sound like both.
    view.sfx.startLoop('tether_strain', 'winch_grind');
    await tween(t(420), easeOutQuad, () => {});
  });

  seq.on('subjugationProgress', async (e, { view, t }) => {
    view.hud.setSubjugation(e.turnsSurvived, e.of);
    // One heavy notch of the winch per round held.
    view.sfx.play('gear_lock');
    await tween(t(360), easeOutQuad, () => {});
  });

  seq.on('tetherSnapped', async (e, { view, t }) => {
    view.renderer.tether = null;
    view.hud.setSubjugation(null);
    // The strain ends the instant the cable does, so the snap lands on silence.
    view.sfx.stopLoop('tether_strain');
    // Steel letting go. The cue was synthesised for exactly this beat and then never
    // wired; the loudest failure in the game was the one that made no sound.
    view.sfx.play('cable_snap');
    view.fx.label(e.at, 'TETHER SNAPPED', 'tether');
    view.fx.screenShake(18, t(620));
    await tween(t(520), easeOutQuad, () => {});
  });

  seq.on('bossPhaseShift', async (e, { view, t }) => {
    view.hud.banner(e.name.toUpperCase(), 'boss');
    view.fx.screenShake(12, t(500));
    view.sfx.play('detonate');
    await tween(t(700), easeOutQuad, () => {});
  });

  seq.on('suddenDeath', async (e, { view, t }) => {
    void e;
    view.views.clear();
    // Its own words. It said LAST STAND, which is what the HUD calls a Pact at a quarter
    // — a different state, and one that may already have been on screen for turns.
    view.hud.banner('SUDDEN DEATH', 'danger');
    await tween(t(900), easeOutQuad, () => {});
  });

  seq.on('combatEnded', (e, { view }) => {
    view.sfx.play(e.result === 'defeat' ? 'lose' : 'win');
    // A subjugation that held to the end is a vault closing on something enormous.
    if (e.result === 'bound') view.sfx.play('vault_lock');
    // Whatever was still looping — the Last Stand heartbeat, above all — ends with the
    // fight. Without this the pulse followed the player back into the overworld.
    view.sfx.stopAllLoops();
    // However the fight ended, the cable is no longer holding anything. `bound` is the
    // subjugation succeeding; the others are the trial ending around it.
    view.renderer.tether = null;
    view.hud.setSubjugation(null);
    sealedBossId = undefined;
  });

  seq.on('deckReshuffled', (e, { view }) => {
    if (e.side === 'player') view.hud.flashNotice('Deck reshuffled');
  });
}

function roundOf(c: Coord): Coord {
  return { x: Math.round(c.x), y: Math.round(c.y) };
}
