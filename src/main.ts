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
import './styles/creation.css';
import './styles/builder.css';
import './styles/safehouse.css';
import './styles/district.css';

import { ScreenManager } from './app/ScreenManager.js';
import { TitleScreen } from './app/TitleScreen.js';
import { CombatScreen } from './app/CombatScreen.js';
import { ResultsScreen } from './app/ResultsScreen.js';
import { VictoryScreen } from './app/VictoryScreen.js';
import { DeckBuilderScreen } from './app/DeckBuilderScreen.js';
import type { DeckBuilderResult } from './app/DeckBuilderScreen.js';
import { PreCombatScreen } from './app/PreCombatScreen.js';
import { DistrictScreen, type WorldFight } from './district/DistrictScreen.js';
import { DEFAULT_AREA, areaById } from './district/areas/index.js';
import { tutorialActive } from './district/quest.js';
import { ShopScreen } from './app/ShopScreen.js';
import { ArtificerScreen } from './app/ArtificerScreen.js';
import { CharacterCreationScreen } from './app/CharacterCreationScreen.js';
import {
  deleteProfile,
  grantRosterUnlocks,
  initializeNewProfile,
  loadSave,
  writeSave,
  type Profile,
  type SaveFile,
  type SlotId,
  type TutorialFlag,
} from './app/save.js';
import { forfeitIfAbandoned, isDown, rescuePlayer } from './core/overworld/state.js';
import {
  composeBoard,
  encounterForBounty,
  huntBoard,
  lairBoard,
  packBounty,
  type Bounty,
} from './core/data/bounties.js';
import { packByEncounter, reinforceSquad, type PackDef } from './core/data/packs.js';
import { stampClock } from './core/data/hunts.js';
import { storyContractByEncounter } from './core/data/campaign.js';
import {
  carryFor,
  contractRefusal,
  openContract,
  payErrand,
  resolveCombat,
  type CombatOutcome,
} from './core/overworld/run.js';
import { errandById } from './district/errands.js';
import { companionById, DEFAULT_COMPANION } from './core/data/companions.js';
import { printedDeck } from './core/data/collection.js';
import { grantSchematic, rollSchematicOffer } from './core/data/schematics.js';
import { ascendCard, forgeSchematic } from './core/overworld/forge.js';
import { spliceCard } from './core/overworld/splice.js';
import { socketRefusal } from './core/data/grimoire.js';
import {
  levelCompanion,
  tameCompanion,
  syncPactCeiling,
  type CompanionInstance,
} from './core/overworld/vivarium.js';
import { VivariumScreen } from './app/VivariumScreen.js';
import { hashText, makeRng } from './core/util/rng.js';
import { NOVICE_AI, profileByName } from './core/ai/controller.js';
import type { EncounterDef } from './core/data/encounters/registry.js';
import { encounterById } from './core/data/encounters/index.js';
import type { CombatResult } from './contract/events.js';
import { awardVanguardXp, unlockVanguard } from './core/data/roster.js';

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
    grantRosterUnlocks(p, DEFAULT_COMPANION.id);
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
  // Permanent, and written down rather than inferred. Releasing this animal later keeps
  // the bodies it brought -- see `Profile.rosterUnlocks`.
  grantRosterUnlocks(p, baseId);
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
  showDistrict(activeBaseId());
}

/** Draws up a new commission on an empty poster, then opens it. */
/**
 * A blank slot, and the one question that has to be answered before it can be filled.
 *
 * Nothing is written until a discipline is confirmed: backing out of enrolment leaves the
 * slot exactly as blank as it was, which is what makes the title wall safe to explore.
 */
function draftProfile(slot: SlotId): void {
  screens.go(
    new CharacterCreationScreen({
      onCreate: (look) => {
        saveFile.profiles[slot] = initializeNewProfile(slot, look);
        openProfile(slot);
      },
      onCancel: showTitle,
    }),
  );
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
 * Records a step of the guided lap, once.
 *
 * The only writer. The district raises the one flag only it can see — that the Dispatcher
 * has been spoken to — and every other step is recorded here, on the way through the
 * callback that actually performs it, so a step cannot be marked done by a screen that
 * merely intended to open.
 */
function recordTutorial(flag: TutorialFlag): void {
  const p = profile();
  if (p.tutorial.includes(flag)) return;
  p.tutorial.push(flag);
  persist();
}

/**
 * The ward between contracts.
 *
 * A street rather than a menu: the four trades are doors on it, the board is a post on the
 * plaza, and the Commander walks between them with their beast at heel. Every callback
 * below is the same one the DOM hub used to hand out — this changed where the player
 * stands, not what the doors do.
 *
 * A player who walks in on the floor is picked up at the door rather than being stopped
 * at it — the rescue is a fee and a hospital bed, not a wall.
 */
/**
 * Which area the player is standing in.
 *
 * `playerPos.mapId` was decorative — only `restorePosition` read it, and only to reject a
 * position saved somewhere else. It selects the screen now, which is what makes a fight
 * taken out in the wilds return you to the wilds with no extra bookkeeping. A save written
 * before areas existed says `'start'`, and anything unrecognised falls back to the ward.
 */
function currentAreaId(): string {
  return areaById(profile().state.overworld.playerPos?.mapId ?? '')?.id ?? DEFAULT_AREA.id;
}

function showDistrict(companionId: string): void {
  showArea(currentAreaId(), companionId);
}

/**
 * What a fight costs the clock.
 *
 * Walking is charged by `DistrictScreen`'s own street clock, which runs at two game-hours a real
 * minute — so a crossing pays for itself in the walking and is not billed again here. This is the
 * one jump: an hour and a half whether you won or lost, which is the only place the clock gets to
 * say something rather than merely tick.
 */
const HOURS_PER_FIGHT = 1.5;

/**
 * Moves the character's clock forward. Counts hours, and never resets.
 *
 * It used to wrap at twenty-four, which threw away the day — and the sky wants to know how many
 * have passed, because whether it is snowing today should not be the same question it was
 * yesterday. Everything that reads the *hour* takes it modulo a day already, so nothing else
 * changed and no save had to be migrated: a v24 file's 0-to-24 reading is day zero.
 */
function advanceClock(hours: number): void {
  const p = active ? profile() : null;
  if (!p) return;
  p.clock = Math.max(0, p.clock + hours);
  persist();
}

function showArea(areaId: string, companionId: string): void {
  rescueIfDown();
  const area = areaById(areaId) ?? DEFAULT_AREA;
  const global = profile().state;
  // The gauge is resynced on every entry rather than only when a Companion changes: it
  // is the one number every clamp in the game reads, and a profile restored with a
  // levelled Companion would otherwise sit at the base ceiling until the next level.
  syncPactCeiling(global.overworld, activeCompanion());
  persist();
  const notice = pendingNotice;
  pendingNotice = null;

  screens.go(
    new DistrictScreen({
      area,
      global,
      companionId,
      companionLevel: activeCompanion().level,
      companionShiny: activeCompanion().shiny === true,
      gender: profile().characterLook.gender,
      // The campaign first, dice after: each tier's poster is the next story contract
      // until that tier's arc is walked, then the rolled pools take the slot back.
      bounties: composeBoard(global.overworld.bountySeed, profile().campaign),
      // Standing work, past the gate. Composed off the same seed as the board so a hunt's
      // fee is stable while the player is looking at it, and re-rolled when a fight moves
      // the seed on — the same rule the posters follow.
      huntBoard: huntBoard(global.overworld.bountySeed),
      lairBoard: lairBoard(global.overworld.bountySeed),
      hunts: profile().hunts,
      collection: profile().collection,
      deck: deckFor(companionId),
      // Consumed on the way in, so a death is announced once rather than every time a
      // shop door closes behind the player.
      notice: notice ?? undefined,
      tutorial: profile().tutorial,
      onTutorialFlag: recordTutorial,
      // The ledger the board already reads to pick each tier's next poster. The street reads the
      // same one, so what a wall says and what the board offers can never disagree about how far
      // through the campaign this character is.
      campaign: profile().campaign,
      hour: profile().clock,
      // The street clock runs while the player stands in it, so the hour they leave with is not
      // the one they arrived with. Written on the way out rather than per frame -- `persist` is a
      // `localStorage` write and the clock moves sixty times a second.
      onHour: (hour) => {
        profile().clock = hour;
        persist();
      },
      // Read fresh on every entry, which is every crossing and every shop door, so the street
      // is always built against what the file actually says rather than against a snapshot
      // taken when the character was opened.
      errands: profile().errands,
      onErrandAccept: (id) => {
        profile().errands.active = { id, ready: false };
        persist();
      },
      onErrandReady: (id) => {
        // Written even though the district also holds it: this is the half that has to survive
        // closing the tab. Killing the waywatch and then quitting must not un-kill it.
        const led = profile().errands;
        if (led.active?.id === id) led.active.ready = true;
        persist();
      },
      onErrandAbandon: () => {
        // Cleared without touching `done`, so the job goes straight back on offer.
        profile().errands.active = null;
        persist();
      },
      onErrandComplete: (id) => {
        const led = profile().errands;
        // Guarded rather than trusted. A turn-in conversation is driven by a dialogue callback
        // and dialogue callbacks are the kind of thing that fire twice; paying an errand twice
        // is the one bug in this system that is worth actual money.
        if (led.done.includes(id)) return null;
        const def = errandById(id);
        led.active = null;
        led.done.push(id);
        persist();
        if (!def) return null;

        const { brewTaken } = payErrand(global, def.reward);
        persist();
        // A full satchel is an ordinary thing that happens rather than an error -- the same
        // call `addConsumable` already makes -- so it is said out loud instead of the brew
        // quietly evaporating between the thanks and the purse.
        if (def.reward.brew && !brewTaken) return 'Satchel full. The brew was left behind.';
        const paid = def.reward.ducats ?? 0;
        return paid > 0 ? `Paid: ${paid} Ducats.` : 'Paid.';
      },
      onChange: persist,
      onApothecary: () =>
        screens.go(
          new ShopScreen({
            global,
            onChange: persist,
            onBack: () => showDistrict(companionId),
          }),
        ),
      onArtificer: () =>
        screens.go(
          new ArtificerScreen({
            global,
            collection: () => profile().collection,
            schematics: () => profile().schematics,
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
              // The ledger goes to the till as well as to the shelf. A screen that only
              // gated the button would let a stale render cut a card the character holds no
              // plan for -- the same `*Refusal`-asked-twice discipline every other trade
              // here keeps.
              const next = forgeSchematic(global, profile().collection, cardId, profile().schematics);
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
            // The bench is Companion-centric now: it presses a spell out of a particular
            // beast's book, so it needs the roster and a way to write back to one instance.
            companions: () => profile().companions,
            activeCompanionId: () => profile().activeCompanionId,
            onSocket: (instanceId, slot, cardId) => {
              const beast = profile().companions.find((c) => c.instanceId === instanceId);
              const source = beast ? companionById(beast.baseId)?.grimoire : undefined;
              if (!beast || !source) return false;
              // Asked again here, not trusted from the screen. A modal is a render, and a
              // render can be stale.
              if (socketRefusal(source, profile().collection.unlocked, slot, cardId) !== null) {
                return false;
              }
              beast.overrides = { ...beast.overrides, [slot]: cardId };
              return true;
            },
            onChange: persist,
            onBack: () => showDistrict(companionId),
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
            onBack: () => showDistrict(activeBaseId()),
          }),
        ),
      onJournal: () => showBuilder(companionId, () => showDistrict(companionId)),
      // The crossing itself is free: `DistrictScreen.unmount` has already handed back an hour
      // that moved while the player walked to the edge of the map, so charging again here would
      // be billing the same walk twice.
      onTravel: (exit) => showArea(exit.to, companionId),
      // A pack is a fight that happened to you, so it is deliberately *not* routed through
      // `onBounty`: that path records `bounty_taken` and would tick a step of the guided lap
      // the player never walked. Everything after the hand-off is the ordinary road, because
      // that road is what pays the spoils and closes the abandon failsafe.
      onPack: (encounterId, pulled) => {
        const pack = packByEncounter(encounterId);
        if (!pack) return null;
        const encounter = encounterById(encounterId);
        if (!encounter) {
          pendingNotice = {
            title: 'Contract Void',
            body: 'The posting names a place nobody can find any more. Try another.',
          };
          showDistrict(companionId);
          return null;
        }

        // The ring closed on more than the one that jumped you. Each extra pack sends the
        // squad its reinforcement budget buys, and pays its own spoils — they die in this
        // fight and go off the road on this fight's clock, so declining their purse would
        // make every pull a straight loss.
        const extras = pulled
          .map((id) => packByEncounter(id))
          .filter((p): p is PackDef => p !== undefined);
        const bounty = packBounty(pack, global.overworld.bountySeed);
        for (const other of extras) {
          const theirs = packBounty(other, global.overworld.bountySeed).spoils;
          bounty.spoils.ducats = (bounty.spoils.ducats ?? 0) + (theirs.ducats ?? 0);
          bounty.spoils.marrowShards =
            (bounty.spoils.marrowShards ?? 0) + (theirs.marrowShards ?? 0);
        }

        // Straight to the fight. An ambush that stops to ask which cards you would like is
        // not an ambush, so the pre-combat beat is skipped and the deck is the one this
        // Companion already fights with — `deckFor`, the same list PreCombat itself opens
        // on, rather than `lastRun` which may belong to another beast entirely.
        const deck = deckFor(companionId);
        const seed = Math.floor(Math.random() * 1e9);
        profile().lastRun = { encounterId, seed, companionId, deck: [...deck] };
        persist();
        // `'defer'`: the contract, the stake and the failsafe handle are all opened here as
        // they always were, but the fight itself is handed back to the district to be played
        // on the road it started on rather than swapped to a board of its own.
        return startCombat(
          encounter,
          companionId,
          deck,
          seed,
          bounty,
          {
            wave2: extras.map(reinforceSquad),
            pulled: extras.map((p) => p.encounterId),
          },
          'defer',
        );
      },
      onBounty: (bounty) => {
        // Any real contract counts, not only the Novice one. The board steers a new
        // Commander at the Novice posting and refuses the rest — but it lifts that gate if
        // the Novice stake is out of reach, and a player who got through it that way has
        // still taken work. The audit is the one exclusion: it is a dev affordance paying
        // five thousand Ducats, and a lap "completed" on it would be completed on nothing.
        if (!bounty.audit) recordTutorial('bounty_taken');
        takeBounty(bounty, companionId);
      },
      onLeave: showTitle,
    }),
  );
}

function showTitle(): void {
  // Whatever is up comes down first, while the profile is still open: the district writes
  // the hour and the player's position to it on unmount, and did so into a closed profile
  // the first time this path was walked from the street.
  screens.close();

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
      // Both belong to the beast standing beside the player, not to the species: which
      // eight it drafted when it was caught, and what each of them rolled.
      activeCompanion().grimoire,
      activeCompanion().spellModifiers,
      activeCompanion().overrides,
      profile().collection,
      // The Vanguard's gate, read off the character's own ledger of grants. Deliberately
      // not recomputed from the current roster: a released beast keeps its bodies.
      profile().rosterUnlocks,
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
        // The sockets belong to the beast the player was standing next to when they
        // edited them, not to the species — two Ignis on the roster socket separately.
        activeCompanion().overrides = { ...result.overrides };
        // Anything newly enrolled starts a record, at level 1 with nothing earned.
        // Idempotent, so re-saving an unchanged warband demotes nobody — and a body
        // dropped from the roster keeps its record, because a career is not a loadout.
        for (const defId of result.roster) {
          profile().vanguardProgress = unlockVanguard(profile().vanguardProgress, defId);
        }
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
    showDistrict(companionId);
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
      onBack: () => showDistrict(companionId),
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
  /**
   * What the Combat Ring dragged in, when the road picked this fight rather than the board.
   *
   * `wave2` is the squads, in the engine's own terms. `pulled` is the pack ids, kept only
   * so the win can put them on the same cooldown as the pack that started it.
   */
  ring?: { wave2: string[][]; pulled: string[] },
  /**
   * Whether to open the 2D board, or hand the fight back to be played where it started.
   *
   * `'screen'` is every fight reached from the Bounty Board: it swaps to `CombatScreen` and
   * returns nothing. `'defer'` is the road, where `DistrictScreen` lays the board on the
   * ground it is already rendering and needs the pieces rather than a screen.
   *
   * Everything above this line runs either way, and that is the point of the switch being
   * here rather than of there being two functions: the contract, the stake, the failsafe
   * handle and the save all happen *before* the player can see a single turn, and a second
   * copy of that ordering is a second chance to let the first turn be a free look.
   */
  present: 'screen' | 'defer' = 'screen',
): WorldFight | null {
  const global = profile().state;
  const carry = carryFor(
    global.overworld,
    activeCompanion(),
    profile().vanguardProgress,
    // The Companion's half is printed inside `createCombat`, after its sockets are
    // applied; the Hero half is printed on the line below. Both halves, one rule.
    profile().collection.ascended,
  );

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
  const refusal = contractRefusal(global, bounty);
  if (refusal !== null) {
    // Nothing to undo: the refusal is checked before anything is spent or opened. But it
    // has to be *said* — this used to return in silence, which left the player on the
    // pre-combat screen pressing a Ready button that did nothing and told them nothing.
    pendingNotice =
      refusal === 'cannot-cover-wager'
        ? {
            title: 'Stake Refused',
            body: `A duel wants ${bounty.wager ?? 0} Ducats on the table and you have ${
              global.overworld.economy.ducats
            }. Take other work first.`,
          }
        : {
            title: 'Contract Refused',
            body: 'Another fight is already open against your name. Finish it first.',
          };
    showDistrict(companionId);
    return null;
  }
  openContract(global, bounty);
  // The ring's pulls are deliberately *not* written here. This handle exists so a boot that
  // finds a fight open can collect on it, and `forfeitIfAbandoned` forfeits rather than
  // resuming — so a fight abandoned mid-ring is settled as a loss, and there is nothing
  // for a remembered wave to be restored into.
  global.combat = { encounterId: encounter.id, seed };
  persist();

  const opened = {
    encounter,
    seed,
    deck: printedDeck(profile().collection, deck),
    ai: profileByName(saveFile.difficulty) ?? NOVICE_AI,
    carry,
    roster: profile().roster,
    ...(ring?.wave2 ? { wave2: ring.wave2 } : {}),
    onFinish: (result: CombatResult, played: EncounterDef, outcome: CombatOutcome) =>
      finishCombat(result, played, outcome, companionId, ring?.pulled ?? []),
  };
  if (present === 'defer') return opened;

  screens.go(
    new CombatScreen(
      encounter,
      opened.onFinish,
      companionId,
      seed,
      opened.deck,
      opened.ai,
      carry,
      opened.roster,
      ring?.wave2,
      // The bearing the Hero is painted in. Read from the character rather than the board,
      // which does not carry it -- the same place the district reads it to put a body on the
      // street. Without it the fight draws a prism where the Commander should be standing.
      { gender: profile().characterLook.gender },
    ),
  );
  return null;
}

// Nothing about the fight is carried past its end any more: with the rematch gone, the
// results screen only reports and returns.
function finishCombat(
  result: CombatResult,
  played: EncounterDef,
  outcome: CombatOutcome,
  companionId: string,
  /** Packs the Combat Ring dragged into this fight. Empty for anything off the board. */
  pulled: string[] = [],
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

  // A trial that ended in a binding is the other way a bloodline is claimed, and it pays
  // the same permanent unlock a wild taming does.
  if (tamed) grantRosterUnlocks(p, tamed.baseId);

  if (result === 'victory') p.record.wins += 1;
  else if (result === 'bound') p.record.bound += 1;
  else p.record.losses += 1;

  // The clock, and it moves whether you won or not. An hour and a half is what the fight took;
  // losing it does not give the time back, which is the one place this system gets to say
  // something rather than merely tick.
  advanceClock(HOURS_PER_FIGHT);

  // Survival XP. Written here rather than inside `resolveCombat` because progression
  // belongs to the *character* and the run does not own one -- the same reason the
  // bestiary and the Companion roster are handed in rather than reached for.
  p.vanguardProgress = awardVanguardXp(p.vanguardProgress, {
    survivors: outcome.rosterSurvivors ?? [],
    fallen: outcome.rosterFallen ?? [],
    won: result === 'victory' || result === 'bound',
  });

  // A win offers **plans**, not cards. Nothing here grants a card any more: the only way
  // into a collection is to take a Schematic off something and then pay the Artificer to
  // cut it, and this is the first half of that.
  //
  // Drawn from the deck this fight just played, so what a win teaches is what beat you
  // with it. Seeded off the running record so the same win does not reroll into a
  // different offer if the screen is rebuilt -- and salted with the encounter id, because
  // the record alone would hand two different fights won at the same tally the same seed.
  // The lap ends when a contract does, won or lost. What it was teaching was the loop —
  // street, board, fight, street — and a Commander who came home beaten has been all the
  // way round it. Making them do it again until they win would be the tutorial refusing
  // to admit it is over.
  //
  // Keyed off the lap still running rather than off which contract was taken. Tying it to
  // the Novice one specifically left a player who spent their stake at the Apothecary,
  // took the Adept contract through the lifted gate and won it with the objective panel
  // still asking them to go and take a Novice contract they could no longer afford.
  if (tutorialActive(p.tutorial)) p.tutorial.push('complete');

  const won = result === 'victory' || result === 'bound';

  // The campaign ledger, and the crack. A story contract completes on a win (a loss
  // keeps it posted — the story does not advance past a fight the player lost), and its
  // reveal is queued as the street notice, which is where the rescue notes already
  // appear: the player reads it standing on the pavement the contract lied about.
  const story = storyContractByEncounter(played.id);
  if (won && story && !p.campaign.includes(story.id)) {
    p.campaign.push(story.id);
    pendingNotice = { title: story.crack.title, body: story.crack.body };
  }

  // The clock: hunts and lairs on a win, roaming packs either way. The rule and its reasons
  // live in `stampClock` — this used to stamp packs on a win alone, which left the crew
  // that had just beaten a character standing on the road the rescue put them back on.
  // `Date.now()` is read here rather than in `core`, which stays clock-free: the registry
  // does the arithmetic and is handed the time.
  stampClock(p.hunts, played.id, pulled, won, Date.now());

  const offer = won
    ? rollSchematicOffer(
        makeRng(p.record.wins * 7919 + p.record.bound * 31 + hashText(played.id) + 5),
        played,
        p.collection,
        p.schematics,
      )
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
        offer,
        tamed,
        onClaim: (cardId) => {
          p.schematics = grantSchematic(p.schematics, cardId);
          persist();
        },
        onLeave: () => {
          persist();
          showDistrict(companionId);
        },
      }),
    );
    return;
  }

  screens.go(
    new ResultsScreen({
      result,
      encounter: played,
      // No rematch. In a hub-based RPG the way back to a fight is through the Bounty
      // Board, and a button that re-ran the same contract for the same pay was a money
      // printer sitting on the results screen.
      // Back to the hub rather than the title: the Safehouse is where a character lives
      // between contracts, and the title is only the way out.
      onTitle: () => showDistrict(companionId),
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
