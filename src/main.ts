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

import { ScreenManager } from './app/ScreenManager.js';
import { TitleScreen } from './app/TitleScreen.js';
import { CombatScreen } from './app/CombatScreen.js';
import { ResultsScreen } from './app/ResultsScreen.js';
import { DeckBuilderScreen } from './app/DeckBuilderScreen.js';
import { loadSave, writeSave, type SaveData } from './app/save.js';
import { companionById } from './core/data/companions.js';
import { grantCard, rollRewards } from './core/data/collection.js';
import { makeRng } from './core/util/rng.js';
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

function showTitle(): void {
  screens.go(
    new TitleScreen({
      save,
      notes: bootNotes.splice(0),
      onStart: (encounter, companionId) => {
        save.lastCompanionId = companionId;
        persist();
        startCombat(encounter, companionId);
      },
      onEditDeck: (companionId) => showBuilder(companionId),
    }),
  );
}

function showBuilder(companionId: string): void {
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
        showTitle();
      },
      showTitle,
    ),
  );
}

function startCombat(encounter: EncounterDef, companionId: string): void {
  screens.go(
    new CombatScreen(
      encounter,
      (result, played) => finishCombat(result, played, companionId),
      companionId,
      undefined,
      deckFor(companionId),
    ),
  );
}

function finishCombat(result: CombatResult, played: EncounterDef, companionId: string): void {
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
      onRematch: () => startCombat(played, companionId),
      onTitle: showTitle,
    }),
  );
}

showTitle();
