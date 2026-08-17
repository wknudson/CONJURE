/**
 * Determinism harness.
 *
 * The engine is a pure reducer over a seeded PRNG, so the same seed and the same command
 * sequence must always produce the same events and the same final state. That property is
 * what makes the AI's simulate-and-score loop sound and every other test trustworthy — so
 * it is worth asserting directly rather than assuming.
 *
 * Nothing here records into GameState: the log lives in the harness, keeping the state
 * lean and serialisable.
 */

import type { GameEvent } from '../contract/events.js';
import type { GameState } from '../core/types/state.js';
import type { Action } from '../contract/query.js';
import type { EncounterDef } from '../core/data/encounters/registry.js';
import { CombatSession } from '../core/session.js';
import type { AiProfile } from '../core/ai/controller.js';

/** One step of a recorded game: either a player action or "the AI took its turn". */
export type Step = { kind: 'action'; action: Action } | { kind: 'ai' };

export interface Recording {
  encounterId: string;
  seed: number;
  steps: Step[];
  events: GameEvent[];
  finalHash: string;
}

/**
 * A stable structural hash of the whole game state.
 *
 * Object key order is sorted rather than trusted: two runs that build the same state by
 * different insertion orders should still compare equal, and a hash that silently depends
 * on insertion order would make this harness pass for the wrong reason.
 */
export function hashState(state: GameState): string {
  const json = stableStringify(state);
  // FNV-1a: short, dependency-free, and more than adequate for detecting divergence.
  let h = 0x811c9dc5;
  for (let i = 0; i < json.length; i++) {
    h ^= json.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
}

/** A compact, comparable form of the event stream. */
export function eventSignature(events: GameEvent[]): string {
  return events.map((e) => stableStringify(e)).join('\n');
}

/** Replays a recorded step list against a fresh session and returns what happened. */
export function replay(
  encounter: EncounterDef,
  seed: number,
  steps: Step[],
  ai?: AiProfile,
): { events: GameEvent[]; finalHash: string; state: GameState } {
  const session = ai
    ? new CombatSession(encounter, seed, ai)
    : new CombatSession(encounter, seed);
  const events: GameEvent[] = [];

  for (const step of steps) {
    if (session.isOver()) break;
    if (step.kind === 'ai') {
      events.push(...session.runAiTurn());
    } else {
      events.push(...session.dispatch(step.action));
    }
  }

  return {
    events,
    finalHash: hashState(session.debugState),
    state: session.debugState,
  };
}

/**
 * Invariants that must hold after every single command, in every game, forever.
 * Returns a list of violations rather than throwing, so a fuzz run can report all of them.
 */
export function checkInvariants(state: GameState, where: string): string[] {
  const bad: string[] = [];
  const say = (msg: string): number => bad.push(`${where}: ${msg}`);

  for (const side of ['player', 'enemy'] as const) {
    const c = state.players[side];
    if (c.hp < 0) say(`${side} commander HP went negative (${c.hp})`);
    if (c.hp > c.maxHp) say(`${side} commander HP ${c.hp} exceeds max ${c.maxHp}`);
    if (c.armor < 0) say(`${side} commander armor negative (${c.armor})`);
    if (c.pips < 0 || c.sparks < 0) say(`${side} has negative resources`);

    // Every card id referenced by a zone must exist in the instance table.
    for (const zone of ['hand', 'deck', 'discard'] as const) {
      for (const id of c[zone]) {
        if (!c.cards[id]) say(`${side} ${zone} references unknown card ${id}`);
      }
    }
    // And a card must live in exactly one zone.
    const seen = new Map<string, string>();
    for (const zone of ['hand', 'deck', 'discard'] as const) {
      for (const id of c[zone]) {
        const prior = seen.get(id);
        if (prior) say(`${side} card ${id} is in both ${prior} and ${zone}`);
        seen.set(id, zone);
      }
    }
  }

  const occupied = new Map<string, string>();
  for (const u of Object.values(state.units)) {
    if (u.hp <= 0) say(`unit ${u.id} (${u.name}) is alive at ${u.hp} HP`);
    if (u.armor < 0) say(`unit ${u.id} has negative armor`);
    if (u.escalation > u.escalationCap) {
      say(`unit ${u.id} escalated ${u.escalation} past cap ${u.escalationCap}`);
    }

    const cells =
      u.footprint === 1
        ? [u.anchor]
        : [
            u.anchor,
            { x: u.anchor.x + 1, y: u.anchor.y },
            { x: u.anchor.x, y: u.anchor.y + 1 },
            { x: u.anchor.x + 1, y: u.anchor.y + 1 },
          ];

    for (const c of cells) {
      if (c.x < 0 || c.y < 0 || c.x >= state.width || c.y >= state.height) {
        say(`unit ${u.id} occupies out-of-bounds tile ${c.x},${c.y}`);
        continue;
      }
      const key = `${c.x},${c.y}`;
      const prior = occupied.get(key);
      if (prior) say(`units ${prior} and ${u.id} share tile ${key}`);
      occupied.set(key, u.id);
    }
  }

  // A Bound Form is the Pact's body: at most one per side, it never grows, it is worth
  // nothing as an offering, and its own HP must never move (all damage is redirected).
  for (const side of ['player', 'enemy'] as const) {
    const bound = Object.values(state.units).filter(
      (u) => u.side === side && u.keywords.includes('BoundForm'),
    );
    if (bound.length > 1) say(`${side} has ${bound.length} Bound Forms`);
    for (const u of bound) {
      if (u.hp !== u.maxHp) say(`Bound Form ${u.id} lost HP of its own (${u.hp}/${u.maxHp})`);
      if (u.escalation !== 0) say(`Bound Form ${u.id} escalated to ${u.escalation}`);
      if (u.sacrificeValue !== 0) say(`Bound Form ${u.id} is worth ${u.sacrificeValue} sparks`);
    }
  }

  for (const o of Object.values(state.obstacles)) {
    if (o.hp <= 0) say(`obstacle ${o.id} is alive at ${o.hp} HP`);
    // Cover may share its tile with a unit; solid terrain may not.
    if (!o.cover && occupied.has(`${o.anchor.x},${o.anchor.y}`)) {
      say(`solid obstacle ${o.id} shares a tile with a unit`);
    }
  }

  return bad;
}

/**
 * Invariants that only hold for a side whose cleanup has just run.
 *
 * Checked against the *inactive* side only. Draft 7 allows the Pip bank to overflow
 * freely during a turn and caps it during end-of-turn cleanup, so the side that has just
 * started — and already taken its +1 — is legitimately allowed to be sitting on nine.
 */
export function checkCleanupInvariants(state: GameState, where: string): string[] {
  const bad: string[] = [];
  const side = state.activeSide === 'player' ? 'enemy' : 'player';
  const c = state.players[side];

  if (c.pips > 8) bad.push(`${where}: ${side} banked ${c.pips} pips, over the cap of 8`);
  if (c.hand.length > c.handLimit + 1) {
    // +1 tolerance: the Rite of Binding overlay is allowed to exceed the limit.
    bad.push(`${where}: ${side} holds ${c.hand.length} cards, over limit ${c.handLimit}`);
  }
  return bad;
}
