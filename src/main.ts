/**
 * Entry point: wires the screens together and owns the persistent save.
 *
 * The save is loaded once here and written after anything that changes it, so no screen
 * has to know about storage. A failed write is not fatal — the session simply continues
 * without persisting, which beats losing the run to an exception.
 */

import './styles/base.css';
import './styles/board.css';
import './styles/hud.css';
import './styles/cards.css';
import './styles/screens.css';
import './styles/onboarding.css';
import './styles/builder.css';
import './styles/safehouse.css';

import { ScreenManager } from './app/ScreenManager.js';
import { TitleScreen } from './app/TitleScreen.js';
import { CombatScreen } from './app/CombatScreen.js';
import { ResultsScreen } from './app/ResultsScreen.js';
import { DeckBuilderScreen } from './app/DeckBuilderScreen.js';
import { PreCombatScreen } from './app/PreCombatScreen.js';
import { SafehouseScreen } from './app/SafehouseScreen.js';
import { ShopScreen } from './app/ShopScreen.js';
import { ArtificerScreen } from './app/ArtificerScreen.js';
import { loadSave, writeSave, type SaveData } from './app/save.js';
import {
  forfeitIfAbandoned,
  isDown,
  newRun,
  rescuePlayer,
  type GlobalGameState,
} from './core/overworld/state.js';
import { encounterForBounty, rollBounties, type Bounty } from './core/data/bounties.js';
import { carryFor, resolveCombat, type CombatOutcome } from './core/overworld/run.js';
import { companionById } from './core/data/companions.js';
import { grantCard, printedDeck, rollRewards } from './core/data/collection.js';
import { ascendCard, forgeSchematic } from './core/overworld/forge.js';
import {
  levelCompanion,
  newCompanion,
  syncPactCeiling,
  type CompanionProgress,
} from './core/overworld/vivarium.js';
import { VivariumScreen } from './app/VivariumScreen.js';
import { makeRng } from './core/util/rng.js';
import { NOVICE_AI, profileByName } from './core/ai/controller.js';
import type { EncounterDef } from './core/data/encounters/registry.js';
import type { CombatResult } from './contract/events.js';

const root = document.getElementById('app');
if (!root) throw new Error('#app root element is missing');

const screens = new ScreenManager(root);

const loaded = loadSave();
let save: SaveData = loaded.save;
const bootNotes = loaded.notes;

function persist(): void {
  writeSave(save);
}

/**
 * The active Companion's progression, created on demand.
 *
 * On demand rather than assumed present, because a save from before the Vivarium — or one
 * naming a Companion added since — has no entry, and a missing one must read as "level 1"
 * rather than as a crash on the way into the hub.
 */
function progressFor(companionId: string): CompanionProgress {
  const existing = save.companions[companionId];
  if (existing) return existing;
  const fresh = newCompanion();
  save.companions[companionId] = fresh;
  return fresh;
}

/**
 * Collect on anything abandoned last session, before a screen can show otherwise.
 *
 * Done at boot rather than at the Safehouse door because the Pact has to already read
 * zero by the time anything renders it — a hub that showed a healthy run for one frame
 * and then killed it would look like a bug rather than a rule. Written back immediately,
 * so closing the tab again cannot undo the collection.
 */
if (save.overworld && forfeitIfAbandoned(save.overworld)) {
  bootNotes.push('You left a fight unfinished. The Magistracy collected on the Pact.');
  persist();
}

/**
 * A message the Safehouse owes the player on its next mount, shown once.
 *
 * Held here rather than on the run because it is news about a transition, not a fact
 * about the state — and the hub is re-entered every time a shop door closes, so a flag
 * that lived on the run would announce the same death over and over.
 */
let pendingNotice: { title: string; body: string } | null = null;

/** The deck a companion will actually fight with, falling back to its default. */
function deckFor(companionId: string): string[] {
  const saved = save.decks[companionId];
  if (saved && !saved.invalid && saved.cards.length > 0) return saved.cards;
  return companionById(companionId)?.deck ?? [];
}

/**
 * The Gauntlet run in progress.
 *
 * Held here and stored under `save.overworld` as the very same object, so a purchase is
 * in the save the moment it happens and `persist()` is only ever a write. The run and the
 * collection are still different lifetimes — a forged card outlives the run that paid for
 * it — which is why they are separate fields rather than one.
 */
let run: GlobalGameState | null = null;

/** What a new character opens with, before they have won anything. */
const OPENING_PURSE = { ducats: 120, marrowShards: 3 };

function startCharacter(): GlobalGameState {
  // Seeded once, at creation, so two characters do not stare at the same board forever.
  const overworld = newRun(Math.floor(Math.random() * 1e9) >>> 0);
  overworld.economy = { ...OPENING_PURSE };
  return { overworld, combat: null };
}

/**
 * The character this session is playing: resumed, rescued, or created.
 *
 * Three cases, and the middle one is the RPG death penalty. A player who comes back down
 * is not wiped and not restarted — they are picked up for a share of the purse and left
 * at 1 health. Nothing they own is taken. Only somebody who has never played at all gets
 * a new character and the opening purse.
 *
 * `save.overworld` is set to the very same object rather than a copy, so every mutation
 * a screen makes is already in the save by the time `persist()` is called. One object,
 * one truth — a copy taken here would be a second one to keep in step.
 */
function adoptCharacter(): GlobalGameState {
  const restored = save.overworld;

  let global: GlobalGameState;
  if (!restored) {
    global = startCharacter();
  } else if (isDown(restored)) {
    global = { overworld: restored, combat: null };
    const fee = rescuePlayer(global);
    pendingNotice = {
      title: 'Rescued',
      body: 'You blacked out. The Magistracy rescued you for a fee of ' + fee + ' Ducats.',
    };
  } else {
    global = { overworld: restored, combat: null };
  }

  save.overworld = global.overworld;
  return global;
}

/**
 * The hub between contracts.
 *
 * A player who walks in on the floor is picked up at the door rather than being stopped
 * at it — the rescue is a fee and a hospital bed, not a wall.
 */
function showSafehouse(companionId: string): void {
  if (!run || isDown(run.overworld)) run = adoptCharacter();
  save.overworld = run.overworld;
  // The gauge is resynced on every entry rather than only when a Companion changes: it
  // is the one number every clamp in the game reads, and a save restored with a levelled
  // Companion would otherwise sit at the base ceiling until the next level was bought.
  syncPactCeiling(run.overworld, progressFor(companionId));
  persist();
  const global = run;
  const notice = pendingNotice;
  pendingNotice = null;

  screens.go(
    new SafehouseScreen({
      global,
      companionId,
      companionLevel: progressFor(companionId).level,
      bounties: rollBounties(global.overworld.bountySeed),
      collection: save.collection,
      deck: deckFor(companionId),
      // Consumed on the way in, so a death is announced once rather than every time a
      // shop door closes behind the player.
      notice: notice ?? undefined,
      onChange: persist,
      onApothecary: () =>
        screens.go(
          new ShopScreen({
            global,
            onChange: persist,
            onBack: () => showSafehouse(companionId),
          }),
        ),
      onArtificer: () =>
        screens.go(
          new ArtificerScreen({
            global,
            collection: () => save.collection,
            // Both tills return whether they fired. The collection is replaced rather
            // than mutated — it is the save's, not the character's — so a refusal simply
            // leaves the old one in place and nothing has been charged.
            onAscend: (cardId) => {
              const next = ascendCard(global, save.collection, cardId);
              if (!next) return false;
              save.collection = next;
              return true;
            },
            onForgeSchematic: (cardId) => {
              const next = forgeSchematic(global, save.collection, cardId);
              if (!next) return false;
              save.collection = next;
              return true;
            },
            onChange: persist,
            onBack: () => showSafehouse(companionId),
          }),
        ),
      onVivarium: () =>
        screens.go(
          new VivariumScreen({
            global,
            companions: () => save.companions,
            activeCompanionId: () => save.activeCompanionId,
            onSelect: (id) => {
              save.activeCompanionId = id;
              // The Pact's ceiling belongs to whoever is standing beside it, so it moves
              // the moment the choice does — not at the next fight.
              syncPactCeiling(global.overworld, progressFor(id));
            },
            onLevel: (id) =>
              levelCompanion(global, progressFor(id), id === save.activeCompanionId),
            onChange: persist,
            // Back through the hub rather than to it, so the room is rebuilt around
            // whichever Companion the player walked out with.
            onBack: () => showSafehouse(save.activeCompanionId),
          }),
        ),
      onJournal: () => showBuilder(companionId, () => showSafehouse(companionId)),
      onBounty: (bounty) => takeBounty(bounty, companionId),
      onLeave: showTitle,
    }),
  );
}

function showTitle(): void {
  screens.go(
    new TitleScreen({
      save,
      notes: bootNotes.splice(0),
      onStart: (companionId, difficulty) => {
        save.activeCompanionId = companionId;
        save.difficulty = difficulty;
        persist();
        showSafehouse(companionId);
      },
      onEditDeck: (companionId) => showBuilder(companionId),
    }),
  );
}

function showBuilder(companionId: string, onDone: () => void = showTitle): void {
  screens.go(
    new DeckBuilderScreen(
      companionId,
      deckFor(companionId),
      save.collection,
      (result) => {
        save.decks[result.companionId] = {
          companionId: result.companionId,
          cards: result.cards,
        };
        save.activeCompanionId = result.companionId;
        persist();
        onDone();
      },
      onDone,
    ),
  );
}

/**
 * Accepts a contract, if the catalogue still knows the fight it names.
 *
 * A bounty read off disk can outlive the encounter it points at, so the lookup is checked
 * rather than asserted — an unknown fight puts the player back in the hub with a reason
 * instead of throwing on a click.
 */
function takeBounty(bounty: Bounty, companionId: string): void {
  const encounter = encounterForBounty(bounty);
  if (!encounter) {
    pendingNotice = {
      title: 'Contract Void',
      body: 'The posting names a place nobody can find any more. Try another.',
    };
    showSafehouse(companionId);
    return;
  }
  showPreCombat(encounter, companionId, bounty);
}

/** See the ground, adapt the deck, then commit to the fight. */
function showPreCombat(
  encounter: EncounterDef,
  companionId: string,
  bounty: Bounty,
): void {
  screens.go(
    new PreCombatScreen({
      encounter,
      companionId,
      deck: deckFor(companionId),
      collection: save.collection,
      onReady: (deck, seed) => {
        // The adapted deck belongs to this fight, not to the saved deck: a swap made for
        // a narrow ruin should not follow the player into the next arena.
        save.lastRun = { encounterId: encounter.id, seed, companionId, deck: [...deck] };
        persist();
        startCombat(encounter, companionId, deck, seed, bounty);
      },
      // Back to the Safehouse, because that is where the contract was taken down from.
      onBack: () => showSafehouse(companionId),
    }),
  );
}

/**
 * Opens the fight, carrying the character into it.
 *
 * The deck reaches the engine through `createCombat`'s own parameter rather than through
 * the carry, because the deck that fights is the one the pre-combat screen adapted — up
 * to five swaps away from the saved list. Two routes to the same field would only be an
 * argument about which one wins.
 *
 * This is also the one place a base card id becomes its Rank 2 printing, and it is the
 * *last* possible moment on purpose. Everything upstream — the builder, the collection,
 * the swap budget — counts by base id, and handing any of them an `_r2` would break the
 * copy limits that `baseIdOf` exists to enforce. The engine, which only resolves ids,
 * neither knows nor needs to know that a substitution happened.
 */
function startCombat(
  encounter: EncounterDef,
  companionId: string,
  deck: string[],
  seed: number,
  bounty: Bounty,
): void {
  const carry = run ? carryFor(run.overworld, progressFor(companionId)) : undefined;

  // Commit to the fight on disk *before* it is mounted. From here until `resolveCombat`
  // clears it, the save says a fight is open, and a boot that finds it open collects on
  // it. This ordering is the whole failsafe: the write has to happen before the player
  // can see a single turn, or the first turn is a free look.
  //
  // The payout is cached here too, not looked up when the fight ends: the board rerolls
  // after every contract, so a win settled against the *new* board would pay for a job
  // nobody accepted.
  if (run) {
    run.combat = { encounterId: encounter.id, seed };
    run.overworld.activeEncounter = { bountyId: bounty.id, spoils: bounty.spoils };
  }
  persist();

  screens.go(
    new CombatScreen(
      encounter,
      (result, played, outcome) => finishCombat(result, played, outcome, companionId),
      companionId,
      seed,
      printedDeck(save.collection, deck),
      profileByName(save.difficulty) ?? NOVICE_AI,
      carry,
    ),
  );
}

// Nothing about the fight is carried past its end any more: with the rematch gone, the
// results screen only reports and returns.
function finishCombat(
  result: CombatResult,
  played: EncounterDef,
  outcome: CombatOutcome,
  companionId: string,
): void {
  // Fold the fight back into the character first: the Pact is written back wounds and
  // all, the brew is spent whether it was won or lost, and a win is paid at the rate the
  // accepted contract promised.
  if (run) resolveCombat(run, outcome, result);

  if (result === 'victory') save.record.wins += 1;
  else if (result === 'bound') save.record.bound += 1;
  else save.record.losses += 1;

  // A win offers a card. Seeded off the running record so the same win does not reroll
  // into a different offer if the screen is rebuilt.
  const won = result === 'victory' || result === 'bound';
  const rewards = won
    ? rollRewards(makeRng(save.record.wins * 7919 + save.record.bound * 31 + 5), 3)
    : [];
  persist();

  screens.go(
    new ResultsScreen({
      result,
      encounter: played,
      rewards,
      onClaim: (cardId) => {
        save.collection = grantCard(save.collection, cardId);
        persist();
      },
      // No rematch. In a hub-based RPG the way back to a fight is through the Bounty
      // Board, and a button that re-ran the same contract for the same pay was a money
      // printer sitting on the results screen.
      // Back to the hub rather than the title: the Safehouse is where a character lives
      // between contracts, and the title is only the way out.
      onTitle: () => showSafehouse(companionId),
    }),
  );
}

showTitle();
