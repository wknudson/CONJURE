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
import { isRunOver, newRun, type GlobalGameState } from './core/overworld/state.js';
import { companionById } from './core/data/companions.js';
import { grantCard, rollRewards } from './core/data/collection.js';
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

/** The deck a companion will actually fight with, falling back to its default. */
function deckFor(companionId: string): string[] {
  const saved = save.decks[companionId];
  if (saved && !saved.invalid && saved.cards.length > 0) return saved.cards;
  return companionById(companionId)?.deck ?? [];
}

/**
 * The Gauntlet run, held for the session.
 *
 * Deliberately not in `SaveData`: the run is a single sitting's progress, the save is
 * everything that outlives one. They meet only where a forged card crosses from the purse
 * into the collection.
 */
let run: GlobalGameState | null = null;

/**
 * Ducats and Shards to open with.
 *
 * Scaffolding, not balance. Combat does not pay into the run yet — that needs a carry
 * through `CombatSession`, which is engine plumbing rather than routing — so without a
 * stipend the Apothecary and the Artificer would both be shelves nobody could shop at.
 */
const OPENING_PURSE = { ducats: 120, marrowShards: 3 };

function startRun(companionId: string): GlobalGameState {
  const overworld = newRun(deckFor(companionId));
  overworld.economy = { ...OPENING_PURSE };
  return { overworld, combat: null };
}

/**
 * The hub between fights.
 *
 * A dead run is replaced on the way in rather than blocking the door: the Bounty Board
 * already refuses to hire a broken Pact, and a player who walked out to the title and
 * back is asking to start again.
 */
function showSafehouse(encounter: EncounterDef, companionId: string): void {
  if (!run || isRunOver(run.overworld)) run = startRun(companionId);
  run.overworld.deck = deckFor(companionId);
  const global = run;

  screens.go(
    new SafehouseScreen({
      global,
      companionId,
      posted: encounter,
      collection: save.collection,
      deck: deckFor(companionId),
      onApothecary: () =>
        screens.go(
          new ShopScreen({ global, onBack: () => showSafehouse(encounter, companionId) }),
        ),
      onArtificer: () =>
        screens.go(
          new ArtificerScreen({
            global,
            collection: () => save.collection,
            onForge: (cardId) => {
              save.collection = grantCard(save.collection, cardId);
              persist();
            },
            onBack: () => showSafehouse(encounter, companionId),
          }),
        ),
      onJournal: () => showBuilder(companionId, () => showSafehouse(encounter, companionId)),
      onBounty: (enc) => showPreCombat(enc, companionId),
      onLeave: showTitle,
    }),
  );
}

function showTitle(): void {
  screens.go(
    new TitleScreen({
      save,
      notes: bootNotes.splice(0),
      onStart: (encounter, companionId, difficulty) => {
        save.lastCompanionId = companionId;
        save.difficulty = difficulty;
        persist();
        showSafehouse(encounter, companionId);
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
        save.lastCompanionId = result.companionId;
        persist();
        onDone();
      },
      onDone,
    ),
  );
}

/** See the ground, adapt the deck, then commit to the fight. */
function showPreCombat(encounter: EncounterDef, companionId: string): void {
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
        startCombat(encounter, companionId, deck, seed);
      },
      // Back to the Safehouse, because that is where the contract was taken down from.
      onBack: () => showSafehouse(encounter, companionId),
    }),
  );
}

function startCombat(
  encounter: EncounterDef,
  companionId: string,
  deck: string[],
  seed: number,
): void {
  screens.go(
    new CombatScreen(
      encounter,
      (result, played) => finishCombat(result, played, companionId, deck, seed),
      companionId,
      seed,
      deck,
      profileByName(save.difficulty) ?? NOVICE_AI,
    ),
  );
}

function finishCombat(
  result: CombatResult,
  played: EncounterDef,
  companionId: string,
  deck: string[],
  seed: number,
): void {
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
      // A rematch is the same fight: same seed, same adapted deck. Rerolling would make
      // "again" mean a different battle, which is not what the button says.
      onRematch: () => startCombat(played, companionId, deck, seed),
      // Back to the hub rather than the title: the Safehouse is where a run lives between
      // contracts, and the title is only the way out of one.
      onTitle: () => showSafehouse(played, companionId),
    }),
  );
}

showTitle();
