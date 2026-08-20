/**
 * Entry point: wires the screens together and owns the persistent save.
 *
 * The file is loaded once here and written after anything that changes it, so no screen
 * has to know about storage. A failed write is not fatal — the session simply continues
 * without persisting, which beats losing progress to an exception.
 *
 * Three characters live in that file and exactly one is open at a time. `active` is a
 * *reference into* `saveFile.profiles`, never a copy, so every mutation a screen makes is
 * already in the file by the time `persist()` runs — and `persist()` writes the file
 * whole, so the two profiles nobody is playing come through a save untouched. That is the
 * one invariant this module exists to hold.
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
import { VictoryScreen } from './app/VictoryScreen.js';
import { DeckBuilderScreen } from './app/DeckBuilderScreen.js';
import type { DeckBuilderResult } from './app/DeckBuilderScreen.js';
import { PreCombatScreen } from './app/PreCombatScreen.js';
import { SafehouseScreen } from './app/SafehouseScreen.js';
import { ShopScreen } from './app/ShopScreen.js';
import { ArtificerScreen } from './app/ArtificerScreen.js';
import {
  deleteProfile,
  loadSave,
  newProfile,
  writeSave,
  type Profile,
  type SaveFile,
  type SlotId,
} from './app/save.js';
import { forfeitIfAbandoned, isDown, rescuePlayer } from './core/overworld/state.js';
import { encounterForBounty, rollBounties, type Bounty } from './core/data/bounties.js';
import { carryFor, openContract, resolveCombat, type CombatOutcome } from './core/overworld/run.js';
import { companionById, DEFAULT_COMPANION } from './core/data/companions.js';
import { grantCard, printedDeck, rollRewards } from './core/data/collection.js';
import { ascendCard, forgeSchematic } from './core/overworld/forge.js';
import { spliceCard } from './core/overworld/splice.js';
import {
  levelCompanion,
  tameCompanion,
  syncPactCeiling,
  type CompanionInstance,
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
const saveFile: SaveFile = loaded.save;
const bootNotes = loaded.notes;

/**
 * The character currently open, or null while the player is at the wall.
 *
 * A reference into `saveFile.profiles`, deliberately. Taking a copy here is how one
 * character's purchases would fail to reach disk, or worse, reach the wrong slot.
 */
let active: Profile | null = null;

/**
 * Writes the whole file.
 *
 * There is no "save this profile" — `writeSave` takes the file, so the slots nobody is
 * playing are carried through every write by construction rather than by remembering to.
 */
function persist(): void {
  writeSave(saveFile);
}

/** The open character. Every screen below the wall runs with one, so this asserts it. */
function profile(): Profile {
  if (!active) throw new Error('no profile is open');
  return active;
}

/**
 * The beast standing beside the player.
 *
 * A roster can be empty — every entry released — so this tames a replacement rather than
 * returning undefined. Walking into the hub with no Companion at all would be a Pact with
 * no ceiling, and every screen below would have to check for it.
 */
function activeCompanion(): CompanionInstance {
  const p = profile();
  const found = p.companions.find((c) => c.instanceId === p.activeCompanionId);
  if (found) return found;

  if (p.companions.length === 0) {
    p.companions.push(tameCompanion(makeRng(p.state.overworld.bountySeed), DEFAULT_COMPANION.id, 1));
  }
  p.activeCompanionId = p.companions[0]!.instanceId;
  return p.companions[0]!;
}

/** The species the active instance belongs to — decks, schools and Bound Forms want this. */
function activeBaseId(): string {
  return activeCompanion().baseId;
}

/**
 * Rolls a wild beast onto the roster.
 *
 * The seed is the character's own bounty seed advanced by the roster length, so two
 * tamings in a session cannot land on the same numbers and a replay of the same character
 * produces the same beasts. Dev-only until the Overworld has somewhere to actually find
 * one, but the roll it performs is the real one.
 */
function tameWild(baseId: string = DEFAULT_COMPANION.id): CompanionInstance {
  const p = profile();
  const sequence = p.companions.length + 1;
  const beast = tameCompanion(
    makeRng((p.state.overworld.bountySeed + sequence * 7919) >>> 0),
    baseId,
    sequence,
  );
  p.companions.push(beast);
  return beast;
}

/**
 * Lets one go, and reports whether it went.
 *
 * The last beast on the roster cannot be released. A character with no Companion has no
 * Pact ceiling and no body on the board — the screens below would all have to grow a
 * branch for it, and the player would have made themselves unplayable with one click.
 */
function releaseCompanion(instanceId: string): boolean {
  const p = profile();
  if (p.companions.length <= 1) return false;

  const at = p.companions.findIndex((c) => c.instanceId === instanceId);
  if (at < 0) return false;

  p.companions.splice(at, 1);
  // Releasing whoever was standing beside you promotes the next one, and the Pact's
  // ceiling moves with them — a gauge left at the released beast's roll would be a
  // ceiling nothing on the roster supports.
  if (p.activeCompanionId === instanceId) {
    p.activeCompanionId = p.companions[0]!.instanceId;
  }
  syncPactCeiling(p.state.overworld, activeCompanion());
  return true;
}

/**
 * Collect on anything abandoned last session, before a screen can show otherwise.
 *
 * Done at boot rather than at the Safehouse door because the Pact has to already read
 * zero by the time anything renders it — a hub that showed a healthy run for one frame
 * and then killed it would look like a bug rather than a rule. Written back immediately,
 * so closing the tab again cannot undo the collection.
 */
let forfeited = false;
for (const slot of Object.keys(saveFile.profiles) as SlotId[]) {
  const p = saveFile.profiles[slot];
  if (p && forfeitIfAbandoned(p.state.overworld)) forfeited = true;
}
if (forfeited) {
  bootNotes.push('A fight was left unfinished. The Magistracy collected on the Pact.');
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
  const saved = profile().decks[companionId];
  if (saved && !saved.invalid && saved.cards.length > 0) return saved.cards;
  return companionById(companionId)?.deck ?? [];
}

/**
 * Opens a character and shows their Safehouse.
 *
 * The only door into the game. Setting `activeProfileId` before anything else means a
 * reload mid-session comes back to the same character rather than to the wall.
 */
function openProfile(slot: SlotId): void {
  const p = saveFile.profiles[slot];
  if (!p) {
    showTitle();
    return;
  }
  active = p;
  saveFile.activeProfileId = slot;
  persist();
  // The *species*, not the instance: everything below the hub keys decks, schools and
  // Bound Forms off the bloodline. Passing the roster id here left the pre-combat screen
  // looking up a companion that does not exist and handing the fight an empty deck.
  showSafehouse(activeBaseId());
}

/** Draws up a new commission on an empty poster, then opens it. */
function draftProfile(slot: SlotId): void {
  saveFile.profiles[slot] = newProfile(slot);
  openProfile(slot);
}

/**
 * Picks the player up if they came back down, and reports what it cost.
 *
 * The RPG death penalty, applied at the Safehouse door rather than at the moment of
 * defeat, so the rescue reads as a thing that happened on the way home.
 */
function rescueIfDown(): void {
  const state = profile().state;
  if (!isDown(state.overworld)) return;

  const fee = rescuePlayer(state);
  pendingNotice = {
    title: 'Rescued',
    body: 'You blacked out. The Magistracy rescued you for a fee of ' + fee + ' Ducats.',
  };
}

/**
 * The hub between contracts.
 *
 * A player who walks in on the floor is picked up at the door rather than being stopped
 * at it — the rescue is a fee and a hospital bed, not a wall.
 */
function showSafehouse(companionId: string): void {
  rescueIfDown();
  const global = profile().state;
  // The gauge is resynced on every entry rather than only when a Companion changes: it
  // is the one number every clamp in the game reads, and a profile restored with a
  // levelled Companion would otherwise sit at the base ceiling until the next level.
  syncPactCeiling(global.overworld, activeCompanion());
  persist();
  const notice = pendingNotice;
  pendingNotice = null;

  screens.go(
    new SafehouseScreen({
      global,
      companionId,
      companionLevel: activeCompanion().level,
      bounties: rollBounties(global.overworld.bountySeed),
      collection: profile().collection,
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
            collection: () => profile().collection,
            // Both tills return whether they fired. The collection is replaced rather
            // than mutated — it is the save's, not the character's — so a refusal simply
            // leaves the old one in place and nothing has been charged.
            onAscend: (cardId) => {
              const next = ascendCard(global, profile().collection, cardId);
              if (!next) return false;
              profile().collection = next;
              return true;
            },
            onForgeSchematic: (cardId) => {
              const next = forgeSchematic(global, profile().collection, cardId);
              if (!next) return false;
              profile().collection = next;
              return true;
            },
            // It no longer removes anything. The bench used to eat the base card, which
            // is why it was handed the decks — a copy spent out from under a deck running
            // three left the player with an illegal list. An unlock cannot be spent, so
            // there is nothing to spend and no deck to repair.
            onSplice: (baseCardId, catalystId) => {
              const p = profile();
              const done = spliceCard(global, p.collection, baseCardId, catalystId);
              if (!done) return null;
              p.collection = done.collection;
              return done;
            },
            onChange: persist,
            onBack: () => showSafehouse(companionId),
          }),
        ),
      onVivarium: () =>
        screens.go(
          new VivariumScreen({
            global,
            roster: () => profile().companions,
            activeInstanceId: () => profile().activeCompanionId,
            onSelect: (instanceId) => {
              profile().activeCompanionId = instanceId;
              // The Pact's ceiling belongs to whoever is standing beside it, so it moves
              // the moment the choice does — not at the next fight.
              syncPactCeiling(global.overworld, activeCompanion());
            },
            onLevel: (instanceId) => {
              const beast = profile().companions.find((c) => c.instanceId === instanceId);
              return levelCompanion(global, beast, instanceId === profile().activeCompanionId);
            },
            onRelease: (instanceId) => releaseCompanion(instanceId),
            onTame: (baseId) => tameWild(baseId),
            onChange: persist,
            // Back through the hub rather than to it, so the room is rebuilt around
            // whichever Companion the player walked out with.
            onBack: () => showSafehouse(activeBaseId()),
          }),
        ),
      onJournal: () => showBuilder(companionId, () => showSafehouse(companionId)),
      onBounty: (bounty) => takeBounty(bounty, companionId),
      onLeave: showTitle,
    }),
  );
}

function showTitle(): void {
  // Leaving a character closes it. Nothing below the wall may run against a profile the
  // player is no longer in, and `profile()` throwing is a better failure than the wrong
  // purse being spent.
  active = null;
  saveFile.activeProfileId = null;
  persist();

  screens.go(
    new TitleScreen({
      save: saveFile,
      notes: bootNotes.splice(0),
      onLoad: openProfile,
      onDraft: draftProfile,
      // The screen has already asked. By the time this runs the player has read the
      // warning and pressed the red button, so there is nothing left to confirm here.
      onDelete: (slot) => {
        deleteProfile(saveFile, slot);
        persist();
      },
      onDifficulty: (name) => {
        if (saveFile.difficulty === name) return;
        saveFile.difficulty = name;
        persist();
      },
    }),
  );
}

function showBuilder(companionId: string, onDone: () => void): void {
  screens.go(
    new DeckBuilderScreen(
      companionId,
      deckFor(companionId),
      profile().roster,
      // The rolls belong to the beast standing beside the player, not to the species.
      activeCompanion().spellModifiers,
      profile().collection,
      profile().bestiary,
      profile().state,
      persist,
      (result: DeckBuilderResult) => {
        profile().decks[result.companionId] = {
          companionId: result.companionId,
          cards: result.cards,
        };
        // One warband per character, not per Companion — so this is written beside the
        // decks rather than into the one that was open.
        profile().roster = result.roster;
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
      collection: profile().collection,
      onReady: (deck, seed) => {
        // The adapted deck belongs to this fight, not to the saved deck: a swap made for
        // a narrow ruin should not follow the player into the next arena.
        profile().lastRun = { encounterId: encounter.id, seed, companionId, deck: [...deck] };
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
  const global = profile().state;
  const carry = carryFor(global.overworld, activeCompanion());

  // Commit to the fight on disk *before* it is mounted. From here until `resolveCombat`
  // clears it, the save says a fight is open, and a boot that finds it open collects on
  // it. This ordering is the whole failsafe: the write has to happen before the player
  // can see a single turn, or the first turn is a free look.
  //
  // The payout is cached here too, not looked up when the fight ends: the board rerolls
  // after every contract, so a win settled against the *new* board would pay for a job
  // nobody accepted.
  // The contract opens *first*, and takes the stake if this is a duel — a buy-in charged
  // when the fight ends would be a bet the player could simply walk away from.
  //
  // Before `global.combat` is set, not after: `contractRefusal` refuses while a fight is
  // open, so setting the handle first makes it refuse the very fight it is opening.
  if (!openContract(global, bounty)) {
    // Nothing to undo: the refusal is checked before anything is spent or opened.
    return;
  }
  global.combat = { encounterId: encounter.id, seed };
  persist();

  screens.go(
    new CombatScreen(
      encounter,
      (result, played, outcome) => finishCombat(result, played, outcome, companionId),
      companionId,
      seed,
      printedDeck(profile().collection, deck),
      profileByName(saveFile.difficulty) ?? NOVICE_AI,
      carry,
      profile().roster,
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
  // Read the contract before `resolveCombat` closes it — the receipt is itemised from
  // what was actually accepted, not from whatever the board offers next.
  const paid = profile().state.overworld.activeEncounter?.spoils ?? {};
  // Fold the fight back into the character first: the Pact is written back wounds and
  // all, the brew is spent whether it was won or lost, and a win is paid at the rate the
  // accepted contract promised.
  const p = profile();
  // The roster is handed in so a binding can be folded into it here, in the same call
  // that settles everything else about the fight. `played` is the encounter actually
  // fought, which is what knows whether it had a beast worth keeping.
  const tamed = resolveCombat(p.state, outcome, result, p.bestiary, {
    ...(played.subjugationPrize ? { prize: played.subjugationPrize } : {}),
    roster: p.companions,
  });

  if (result === 'victory') p.record.wins += 1;
  else if (result === 'bound') p.record.bound += 1;
  else p.record.losses += 1;

  // A win offers a card. Seeded off the running record so the same win does not reroll
  // into a different offer if the screen is rebuilt.
  const won = result === 'victory' || result === 'bound';
  const rewards = won
    ? rollRewards(makeRng(p.record.wins * 7919 + p.record.bound * 31 + 5), 3)
    : [];
  persist();

  if (won) {
    screens.go(
      new VictoryScreen({
        result,
        encounter: played,
        // Already banked. `resolveCombat` credited them and `persist()` has run, because
        // the forfeit failsafe requires the open contract to be closed on disk before
        // anything is rendered — a tab shut on an uncommitted victory screen would boot
        // into a forfeit of the fight the player just won.
        spoils: paid,
        rewards,
        tamed,
        onClaim: (cardId) => {
          p.collection = grantCard(p.collection, cardId);
          persist();
        },
        onLeave: () => {
          persist();
          showSafehouse(companionId);
        },
      }),
    );
    return;
  }

  screens.go(
    new ResultsScreen({
      result,
      encounter: played,
      rewards,
      onClaim: (cardId) => {
        p.collection = grantCard(p.collection, cardId);
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

/**
 * Straight back into the character that was open, if one was.
 *
 * A reload should not cost the player the walk from the wall to the hub, and the pointer
 * is only ever left set on a profile that actually exists.
 */
const resume = saveFile.activeProfileId;
if (resume && saveFile.profiles[resume]) openProfile(resume);
else showTitle();
