/**
 * The event-handler registry: one animation per logic event type.
 *
 * Handlers own all view-state mutation. Because the sequencer awaits each step, view
 * state is always a correct replay of the past even though logic state has already
 * raced ahead to the future.
 */

import type { Coord } from '../contract/ids.js';
import type { Sequencer } from './Sequencer.js';
import { easeInQuad, easeOutBack, easeOutQuad, tween } from './tween.js';
import type { EntityViewMap } from '../render/EntityViews.js';
import { lerpCoord } from '../render/EntityViews.js';
import type { Fx } from '../render/Fx.js';
import type { Sfx } from '../sound/Sfx.js';
import type { Hud } from '../hud/Hud.js';

export interface CombatView {
  views: EntityViewMap;
  fx: Fx;
  sfx: Sfx;
  hud: Hud;
}

/** Held beat before a death resolves, so removing a piece has weight. */
const MINION_HITSTOP_MS = 150;
const BEHEMOTH_HITSTOP_MS = 400;

/** A pause that respects the sequencer's speed scaling, so skip still skips. */
function hold(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function registerHandlers(seq: Sequencer<CombatView>): void {
  // ---------------------------------------------------------------- board setup

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
    // A short lunge toward the target sells the swing.
    await tween(t(110), easeOutQuad, (k) => {
      v.elev = Math.sin(k * Math.PI) * 10;
    });
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
    }

    if (e.at) {
      if (e.hpLoss > 0) view.fx.damageNumber(e.at, e.hpLoss);
      else if (e.absorbedByArmor > 0) view.fx.label(e.at, 'ABSORBED', 'absorb');
    }

    if (e.hpLoss > 0) view.sfx.play('hit');
    await tween(t(110), easeOutQuad, (k) => {
      if (v) v.squash = Math.sin(k * Math.PI) * 0.6;
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

  // ---------------------------------------------------------------- runes

  seq.on('runeAttached', (e, { view }) => {
    const v = view.views.get(e.hostId);
    if (v) v.rune = { school: e.rune.school };
  });

  seq.on('runeDetonated', async (e, { view, t }) => {
    const v = view.views.get(e.hostId);
    if (v) v.rune = null;

    // Cascade crescendo. A three-rune chain currently looks like three separate pops;
    // escalating each link turns it into the single loudest thing the game can do.
    // `chainDepth` comes from the engine and is 0 for the rune that starts the chain.
    const link = e.chainDepth + 1;
    view.sfx.play('detonate', { pitch: 1 + Math.min(e.chainDepth, 4) * 0.12 });
    view.fx.screenShake(9 + Math.min(e.chainDepth, 4) * 3, t(300));

    if (link > 1) {
      view.fx.label(e.at, `CASCADE ×${link}${link >= 3 ? '!' : ''}`, 'cascade');
    }

    await view.fx.detonation(e.at, e.school, t(420));
  });

  seq.on('runeFizzled', (e, { view }) => {
    const v = view.views.get(e.hostId);
    if (v) {
      v.rune = null;
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
  });

  seq.on('statusTicked', (e, { view }) => {
    const v = view.views.get(e.unitId);
    if (!v) return;
    v.statuses = v.statuses
      .map((s) => (s.kind === e.status ? { ...s, stacks: e.remaining } : s))
      .filter((s) => s.stacks > 0);
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

  // ---------------------------------------------------------------- removal

  seq.on('unitSacrificed', (e, { view }) => {
    const v = view.views.get(e.unitId);
    if (v) view.fx.label(roundOf(v.pos), 'SACRIFICE', 'sacrifice');
    if (e.sparksGained > 0) view.sfx.play('spark');
  });

  seq.on('unitChannelled', async (e, { view, t }) => {
    // A quieter beat than a sacrifice: nothing is lost, the unit simply gives up its
    // swing. A brief lift and a spark chime, then it settles back as spent.
    const v = view.views.get(e.unitId);
    if (v) view.fx.label(roundOf(v.pos), 'CHANNEL', 'spark');
    view.sfx.play('spark');
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

  seq.on('pipGained', (e, { view }) => {
    view.hud.setResources(e.side, e.total, undefined);
    if (e.side === 'player') view.sfx.play('pip');
  });

  seq.on('resourcesChanged', (e, { view }) => {
    view.hud.setResources(e.side, e.pips, e.sparks);
  });

  seq.on('cardDrawn', (e, { view }) => {
    view.hud.onCardDrawn(e.side, e.card);
  });

  seq.on('cardBurned', (e, { view }) => {
    view.hud.onCardRemoved(e.side, e.card.instanceId);
    if (e.side === 'player') {
      view.hud.flashNotice('Hand full — card burned for a Spark');
      view.sfx.play('spark');
    }
  });

  seq.on('cardDiscarded', (e, { view }) => {
    view.hud.onCardRemoved(e.side, e.cardId);
  });

  seq.on('cardPlayed', (e, { view }) => {
    view.hud.onCardRemoved(e.side, e.card.instanceId);
    view.sfx.play('card');
    if (e.side === 'enemy') view.hud.flashNotice(`Enemy plays ${e.card.name}`);
  });

  seq.on('cardInjected', (e, { view }) => {
    view.hud.onCardDrawn(e.side, e.card);
    view.hud.flashNotice('The Rite of Binding is offered!');
    view.sfx.play('win');
  });

  seq.on('cardReturnedToHand', (e, { view }) => {
    view.hud.onCardDrawn(e.side, e.card);
    view.hud.flashNotice(`${e.card.name} evicted — +${e.refundedSparks} Spark`);
  });

  // ---------------------------------------------------------------- flow

  seq.on('turnStarted', (e, { view }) => {
    view.hud.setTurn(e.turn, e.side);
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
    view.sfx.play('spark');
    await tween(t(220), easeOutQuad, () => {});
  });

  seq.on('hazardExpired', async () => {
    // Purely visual: the renderer stops drawing it on the next board sync.
  });

  seq.on('resonanceTriggered', async (e, { view, t }) => {
    if (e.side !== 'player') return;
    view.hud.flashNotice(`Resonance — ${e.name}`);
    view.sfx.play('spark');
    await tween(t(180), easeOutQuad, () => {});
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
    view.hud.banner('LAST STAND', 'danger');
    await tween(t(900), easeOutQuad, () => {});
  });

  seq.on('combatEnded', (e, { view }) => {
    view.sfx.play(e.result === 'defeat' ? 'lose' : 'win');
  });

  seq.on('deckReshuffled', (e, { view }) => {
    if (e.side === 'player') view.hud.flashNotice('Deck reshuffled');
  });
}

function roundOf(c: Coord): Coord {
  return { x: Math.round(c.x), y: Math.round(c.y) };
}
