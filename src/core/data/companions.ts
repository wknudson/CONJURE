/**
 * Companions.
 *
 * A Companion is chosen before a run and decides three things: which school its
 * Resonance belongs to, which lane on the board that Resonance watches, and which cards
 * fill the Companion slots of the deck. The Hero half of the deck never changes, so the
 * two play the same physical game and differ in what their caster brings to it.
 */

import type { School } from '../../contract/ids.js';
import { STARTER_DECK } from './cards/index.js';
import type { GrimoireSource } from './grimoire.js';
import { HYBRID_HYBRID_CHANCE, MONO_HYBRID_CHANCE } from './grimoire.js';

/**
 * Cards a Companion fuses into the deck at the opening bell. Exactly eight, always.
 *
 * A constant rather than "whatever the species happens to carry", because the Hero Deck's
 * bounds are written *against* it: a 12-card Hero half is a 20-card deck once the beast
 * has shuffled its own in, and a species that quietly brought seven would make every deck
 * size in the game one short without anything saying so.
 */
export const GRIMOIRE_SIZE = 8;

export interface CompanionDef {
  id: string;
  name: string;
  title: string;
  school: School;
  /**
   * What this species' art is filed under, when that is not its id.
   *
   * The founders' files are named for their ids (`ignis-front.png`); the wild bloodlines'
   * are named for their titles (`chimera_of_the_caldera-front.png` for `chimera`). Rather
   * than rename painted art or make the loader guess, the species states where its own
   * pictures are — the one place that already knows everything else about it.
   *
   * This existed as an unwritten assumption that ids and filenames matched, and every
   * wild species broke it: a bound Chimera fetched `chimera-front.png`, 404ed, and took
   * the whole district's actor batch down with it. `spriteAssets.test.ts` now walks every
   * species against the folder so the next mismatch is a red test, not a dead street.
   */
  artId?: string;
  /** One line, shown on the selection screen. */
  blurb: string;
  /**
   * The Hero Deck a new character is handed alongside this Companion.
   *
   * Identical across every species now, and deliberately so: the Hero half is utility, and
   * utility has no colour. What makes a Boreas fight differently from an Ignis is the
   * Grimoire below, not this.
   */
  deck: string[];
  /**
   * The pool this bloodline drafts its eight from, and how it is weighted.
   *
   * A *pool*, not a list, and that is the change. Every Ignis used to carry the same eight
   * cards, so the second one you caught was worth nothing — the beast was a checkbox. Two
   * Ignis are now two different books drawn from the same shelf: one heavy on Ashen Wakes,
   * one that rolled a Cataclysm it has no business knowing.
   *
   * `schools` is a list because a hybrid bloodline draws from two at once. Every species
   * shipped so far is mono-element, so every entry holds one — the second slot is what a
   * Chimera would use, and the draft has no separate case for it.
   *
   * What each of the eight *rolled* is a second, independent question
   * (`CompanionInstance.spellModifiers`). Which cards, and what those cards came out at.
   */
  grimoire: GrimoireSource;

  /**
   * The eight this species used to always bring.
   *
   * Kept as the **fallback** for a beast tamed before the draft existed, and for nothing
   * else. A save from before this change holds no drafted list, and re-rolling one on load
   * would hand every player a different Companion than the one they went and caught.
   */
  legacyGrimoire: string[];
  /** The setup-only stat block placed on the board as its Bound Form. */
  unitCardId: string;
}

const SPECIES: CompanionDef[] = [
  {
    id: 'ignis',
    name: 'Ignis',
    title: 'Ember Drake',
    school: 'pyre',
    blurb:
      'Marks and cascades. Brand your enemies, then set the whole board off at once. Ember Watch ignites anything standing in its lane.',
    // The founding deck, exactly as specced.
    deck: [...STARTER_DECK],
    // Marks, cascades and the big burst. The Drake gives up the chimney half of the school
    // to the Salamander: ground fire, the draw, and the two slow constructs.
    grimoire: {
      schools: ['pyre'],
      hybridChance: MONO_HYBRID_CHANCE,
      // Two, where it was four: the Drake's own signatures now say what the omit used to.
      omit: ['chimney_draw', 'slag_cairn'],
    },
    legacyGrimoire: [
      'flame_surge',
      'flame_surge',
      'ashen_wake',
      'ashen_wake',
      'ember_coat',
      'ember_coat',
      'cataclysm',
      'cataclysmic_core',
    ],
    unitCardId: 'ignis_bound',
  },
  {
    id: 'boreas',
    name: 'Boreas',
    title: 'Frost Bear',
    school: 'frost',
    blurb:
      'Control. Chill an enemy three times and it freezes solid — then break it. Rime Guard armours your Hero each turn.',
    deck: [...STARTER_DECK],
    // Lockdown. The Bear keeps the long control cards — the rime, the deep winter, the wall
    // — and leaves the harbour's weather and the ice-breaking to the Seal.
    grimoire: {
      schools: ['frost'],
      hybridChance: MONO_HYBRID_CHANCE,
      // Two, where it was four: the Bear's signatures carry the lockdown now.
      omit: ['hoarfrost_veil', 'calving'],
    },
    legacyGrimoire: [
      'glacial_spike',
      'glacial_spike',
      'frost_nova',
      'frost_nova',
      'brittle_touch',
      'brittle_touch',
      'flash_freeze',
      'ice_barricade',
    ],
    unitCardId: 'boreas_bound',
  },
  {
    id: 'voltara',
    name: 'Voltara',
    title: 'Storm Lynx',
    school: 'surge',
    blurb:
      'Setup. Charge a cluster and let somebody else light it — fire Overloads, frost Superconducts. Storm Tithe pays a Bone back for the first card each turn.',
    // Three Static Arcs, because charging is the whole plan and one copy would make the
    // plan a coincidence. Arc Lash and the Hound are Hero cards and would be legal in any
    // deck; they are here because this is the deck that wants them.
    deck: [...STARTER_DECK],
    // Charge, step, cash in. The Lynx is the mobile half of Surge and gives the Kudu the
    // things that stand still: the pylon, the storm overhead, and the two big discharges.
    grimoire: {
      schools: ['surge'],
      hybridChance: MONO_HYBRID_CHANCE,
      // Two, where it was four: the Lynx's signatures carry the footwork now.
      omit: ['capacitor_dump', 'tesla_pylon'],
    },
    legacyGrimoire: [
      'static_arc',
      'static_arc',
      'static_arc',
      'arc_lash',
      'arc_lash',
      'static_charge',
      'static_charge',
      'marrow_burst',
    ],
    unitCardId: 'voltara_bound',
  },
  {
    id: 'mortis',
    name: 'Mortis',
    title: 'Carrion Stag',
    school: 'dusk',
    blurb:
      'Attrition. Feed it your own bodies and take the difference — Grave Tithe drains the weakest thing standing every turn you cast.',
    // Its own school has exactly two cards a deck can hold three of, so the six are those
    // at their caps. A Dusk deck is short on options by design: it spends what it has.
    deck: [...STARTER_DECK],
    // Attrition by siphon. The Stag spends bodies; it does not dig them up again — the
    // grave-work, the smoke and the mercy go to the Jackal.
    grimoire: {
      schools: ['dusk'],
      hybridChance: MONO_HYBRID_CHANCE,
      // Two, where it was four: the Stag's signatures carry the feeding now.
      omit: ['exhume', 'charnel_pillar'],
    },
    legacyGrimoire: [
      'shadow_siphon',
      'shadow_siphon',
      'shadow_siphon',
      'marrow_siphon',
      'marrow_siphon',
      'marrow_siphon',
      'harvest_the_weak',
      'marrow_burst',
    ],
    unitCardId: 'mortis_bound',
  },
  {
    id: 'sylva',
    name: 'Sylva',
    title: 'Thorn Warden',
    school: 'bloom',
    blurb:
      'Patience. Poison, roots, and a body that grows where you plant it. Verdant Growth gives 2 HP back for the first card each turn.',
    deck: [...STARTER_DECK],
    // Thorns and roots. The Warden is the briar half of Bloom and hands the field half —
    // pollen, blight, the harvest — to the Aurochs.
    grimoire: {
      schools: ['bloom'],
      hybridChance: MONO_HYBRID_CHANCE,
      // Two, where it was four: the Warden's signatures carry the patience now.
      omit: ['blight_harvest', 'blight_bloom'],
    },
    legacyGrimoire: [
      'spore_cloud',
      'spore_cloud',
      'root_snare',
      'root_snare',
      'root_snare',
      'verdant_swell',
      'verdant_swell',
      'verdant_collapse',
    ],
    unitCardId: 'sylva_bound',
  },
  {
    id: 'ferrum',
    name: 'Ferrum',
    title: 'Vault Boar',
    school: 'bulwark',
    blurb:
      'Ground. Walls, shoves, and a body that will not be moved. Shield Oath armours everything standing in its lane.',
    deck: [...STARTER_DECK],
    // Walls and the refusal to move. The Boar keeps the gates and the plate; the breaking
    // work — the sinkhole, the counterweight, the crag — belongs to the Ram.
    grimoire: {
      schools: ['bulwark'],
      hybridChance: MONO_HYBRID_CHANCE,
      // Two, where it was four: the Boar's signatures carry the ground now.
      omit: ['sinkhole', 'crag_slam'],
    },
    legacyGrimoire: [
      'seismic_slam',
      'seismic_slam',
      'petrifying_mantle',
      'petrifying_mantle',
      'smoke_bomb',
      'smoke_bomb',
      'pressure_valve_release',
      'cataclysm',
    ],
    unitCardId: 'ferrum_bound',
  },
  // ---------------------------------------------------------------- hybrids
  //
  // Ten bloodlines that draw on two schools at once. The draft has supported a two-school
  // pool since it was written and had no content for it: every species shipped so far is
  // mono-element, so the hybrid branch was a mechanism nobody could reach.
  //
  // These are what it was for. A Chimera draws its pure spells from Pyre *and* Frost, and
  // rolls a fusion into any given slot at `HYBRID_HYBRID_CHANCE` -- roughly a third of its
  // book -- where a mono-element beast rolls one at a twentieth. Two Chimeras are two very
  // different decks, and neither is a deck a mono bloodline would realistically deal.
  //
  // One thing these do *not* change, and it is worth knowing before reading a caught
  // beast's book: `hybridPool` reaches a fusion when the bloodline supplies **at least
  // one** of the two schools that press it. That rule was written for mono-element beasts,
  // where it is the only reading that works, and it is unchanged here -- so a Frost/Dusk
  // Grave-Gargoyle can legitimately deal itself a Pyre/Frost Vaporize Blast. A hybrid's
  // identity is currently expressed by *how often* it draws fusions, not by *which*.
  // Tightening that to the beast's own pair is a live design question, not an oversight.
  //
  // **`school` is the Resonance, and a hybrid has to pick one.** Resonance is keyed by
  // school and a Companion carries a single one, so each of these names the parent whose
  // passive it inherits -- the Chimera burns like an Ignis, the Mantis rimes like a
  // Boreas. Their own bespoke Resonances are designed and *not* built; see the note above
  // `RESONANCE` in `data/resonance.ts` for what each would need.

  {
    id: 'chimera',
    artId: 'chimera_of_the_caldera',
    name: 'Chimera of the Caldera',
    title: 'Caldera Chimera',
    school: 'pyre',
    blurb:
      'Boil them. Fire into a Chilled body flash-boils it, and the steam it leaves blinds whatever is left standing behind.',
    deck: [...STARTER_DECK],
    grimoire: { schools: ['pyre', 'frost'], hybridChance: HYBRID_HYBRID_CHANCE },
    legacyGrimoire: [
      'flame_surge',
      'flame_surge',
      'glacial_spike',
      'glacial_spike',
      'brittle_touch',
      'frost_nova',
      'ember_coat',
      'cataclysm',
    ],
    unitCardId: 'chimera_bound',
  },
  {
    id: 'wasp',
    artId: 'cinder_wasp',
    name: 'Cinder-Wasp Swarm',
    title: 'Ember Swarm',
    school: 'surge',
    blurb:
      'Charge, then light it. A Charged body takes fire badly, and the arc goes looking for the next one.',
    deck: [...STARTER_DECK],
    grimoire: { schools: ['pyre', 'surge'], hybridChance: HYBRID_HYBRID_CHANCE },
    legacyGrimoire: [
      'static_arc',
      'static_arc',
      'arc_lash',
      'flame_surge',
      'flame_surge',
      'ashen_wake',
      'ember_coat',
      'static_charge',
    ],
    unitCardId: 'wasp_bound',
  },
  {
    id: 'tortoise',
    artId: 'obsidian_tortoise',
    name: 'Obsidian Tortoise',
    title: 'Caldera Bulwark',
    school: 'bulwark',
    blurb:
      'Ground held and ground denied. Shove them off the tile they wanted and leave something burning on it.',
    deck: [...STARTER_DECK],
    grimoire: { schools: ['pyre', 'bulwark'], hybridChance: HYBRID_HYBRID_CHANCE },
    legacyGrimoire: [
      'seismic_slam',
      'seismic_slam',
      'petrifying_mantle',
      'petrifying_mantle',
      'flame_surge',
      'ashen_wake',
      'ember_coat',
      'smoke_bomb',
    ],
    unitCardId: 'tortoise_bound',
  },
  {
    id: 'treant',
    artId: 'crimson_treant',
    name: 'Crimson Treant',
    title: 'Ashwood Warden',
    school: 'bloom',
    blurb:
      'Poison first, fire second. Wildfire burns off every stack at once and everything nearby is standing in it.',
    deck: [...STARTER_DECK],
    grimoire: { schools: ['pyre', 'bloom'], hybridChance: HYBRID_HYBRID_CHANCE },
    legacyGrimoire: [
      'spore_cloud',
      'spore_cloud',
      'root_snare',
      'root_snare',
      'flame_surge',
      'ashen_wake',
      'verdant_swell',
      'ember_coat',
    ],
    unitCardId: 'treant_bound',
  },
  {
    id: 'mantis',
    artId: 'storm_mantis',
    name: 'Storm-Mantis',
    title: 'Rime Conductor',
    school: 'frost',
    blurb:
      'Cold conducts. Shock through a Chilled body Superconducts, and what it earths into comes out Brittle.',
    deck: [...STARTER_DECK],
    grimoire: { schools: ['frost', 'surge'], hybridChance: HYBRID_HYBRID_CHANCE },
    legacyGrimoire: [
      'glacial_spike',
      'glacial_spike',
      'static_arc',
      'static_arc',
      'arc_lash',
      'frost_nova',
      'brittle_touch',
      'static_charge',
    ],
    unitCardId: 'mantis_bound',
  },
  {
    id: 'juggernaut',
    artId: 'glacial_juggernaut',
    name: 'Glacial Juggernaut',
    title: 'Icebreaker',
    school: 'bulwark',
    blurb:
      'Freeze it, then break it. A physical blow on frozen flesh Shatters, and the shrapnel does not care who is nearby.',
    deck: [...STARTER_DECK],
    grimoire: { schools: ['frost', 'bulwark'], hybridChance: HYBRID_HYBRID_CHANCE },
    legacyGrimoire: [
      'glacial_spike',
      'flash_freeze',
      'frost_nova',
      'seismic_slam',
      'seismic_slam',
      'petrifying_mantle',
      'ice_barricade',
      'brittle_touch',
    ],
    unitCardId: 'juggernaut_bound',
  },
  {
    id: 'gargoyle',
    artId: 'grave_gargoyle',
    name: 'Grave-Gargoyle',
    title: 'Black Ice',
    school: 'dusk',
    blurb:
      'Cold is patient and so is the debt. Chill them still, then take what is left in Marrow.',
    deck: [...STARTER_DECK],
    grimoire: { schools: ['frost', 'dusk'], hybridChance: HYBRID_HYBRID_CHANCE },
    legacyGrimoire: [
      'glacial_spike',
      'frost_nova',
      'brittle_touch',
      'shadow_siphon',
      'shadow_siphon',
      'marrow_siphon',
      'marrow_burst',
      'flash_freeze',
    ],
    unitCardId: 'gargoyle_bound',
  },
  {
    id: 'dynamo',
    artId: 'kinetic_dynamo',
    name: 'Kinetic Dynamo',
    title: 'Momentum Engine',
    school: 'surge',
    blurb:
      'Charge is only useful if something moves. Shock them, shove them, and let the wall finish it.',
    deck: [...STARTER_DECK],
    grimoire: { schools: ['surge', 'bulwark'], hybridChance: HYBRID_HYBRID_CHANCE },
    legacyGrimoire: [
      'static_arc',
      'arc_lash',
      'seismic_slam',
      'seismic_slam',
      'petrifying_mantle',
      'static_charge',
      'smoke_bomb',
      'arc_lash',
    ],
    unitCardId: 'dynamo_bound',
  },
  {
    id: 'geist',
    artId: 'volatile_geist',
    name: 'Volatile Geist',
    title: 'Aether Siphon',
    school: 'dusk',
    blurb:
      'Everything is a battery, including your own line. Charge a body, spend it, and take the difference.',
    deck: [...STARTER_DECK],
    grimoire: { schools: ['surge', 'dusk'], hybridChance: HYBRID_HYBRID_CHANCE },
    legacyGrimoire: [
      'static_arc',
      'arc_lash',
      'marrow_siphon',
      'marrow_siphon',
      'shadow_siphon',
      'harvest_the_weak',
      'marrow_burst',
      'static_charge',
    ],
    unitCardId: 'geist_bound',
  },
  {
    id: 'sovereign',
    artId: 'bone_bastion_sovereign',
    name: 'Bone Bastion Sovereign',
    title: 'Marrow Bastion',
    school: 'bulwark',
    blurb:
      'The line holds because of what is buried under it. Feed it your own and it stands taller.',
    deck: [...STARTER_DECK],
    grimoire: { schools: ['bulwark', 'dusk'], hybridChance: HYBRID_HYBRID_CHANCE },
    legacyGrimoire: [
      'petrifying_mantle',
      'petrifying_mantle',
      'seismic_slam',
      'marrow_siphon',
      'shadow_siphon',
      'harvest_the_weak',
      'smoke_bomb',
      'marrow_burst',
    ],
    unitCardId: 'sovereign_bound',
  },

  // ------------------------------------------------------- the second bloodlines
  //
  // One more mono-element species per school, so no element is a single beast any more.
  //
  // These exist because of a gap the hybrids made obvious. A school used to *be* its founder
  // — Frost was Boreas — so "what does a Frost beast draw" and "what does Boreas draw" were
  // the same question, and `GrimoireSource` could be a pair of schools because nothing else
  // varied. Six of these break that, and `omit` is what they broke it with: each pair shares
  // most of a shelf and disagrees at the edges, so catching the second Frost bloodline hands
  // you a book the first one could not have dealt.
  //
  // **None of them reach the creation screen**, and that is by construction rather than by a
  // list: `foundersOf` takes the *first* mono species of each school, and these are second.
  // Every one is something you go out and catch.

  {
    id: 'salamander',
    artId: 'flue_salamander',
    name: 'Flue Salamander',
    title: 'Chimney Fire',
    school: 'pyre',
    blurb:
      'Fire that lives in the ductwork. Lays burning ground, drags them onto it, and is somewhere else by the time it catches.',
    deck: [...STARTER_DECK],
    // The chimney half of Pyre: ground fire, the draw, the slow constructs. It never learns
    // the Drake's cataclysms -- a salamander is not an artillery piece.
    grimoire: {
      schools: ['pyre'],
      hybridChance: MONO_HYBRID_CHANCE,
      // Two, where it was four: the signatures carry the chimney now.
      omit: ['cataclysm', 'cataclysmic_core'],
    },
    legacyGrimoire: [
      'emberfall',
      'emberfall',
      'chimney_draw',
      'chimney_draw',
      'backdraft',
      'backdraft',
      'stoke',
      'slag_cairn',
    ],
    unitCardId: 'salamander_bound',
  },
  {
    id: 'seal',
    artId: 'saltglass_seal',
    name: 'Saltglass Seal',
    title: 'Harbor Ghost',
    school: 'frost',
    blurb:
      'Came in with the tide and stayed after the writ. Fogs the water, freezes what moves in it, and breaks the ice itself.',
    deck: [...STARTER_DECK],
    // Harbour weather and the breaking of ice. The long lockdown cards are the Bear's.
    grimoire: {
      schools: ['frost'],
      hybridChance: MONO_HYBRID_CHANCE,
      // Two, where it was four: the Seal's signatures carry the harbour now.
      omit: ['rime_lock', 'deep_winter'],
    },
    legacyGrimoire: [
      'cold_snap',
      'cold_snap',
      'whiteout',
      'whiteout',
      'calving',
      'hoarfrost_veil',
      'flash_freeze',
      'hail_spire',
    ],
    unitCardId: 'seal_bound',
  },
  {
    id: 'kudu',
    artId: 'conduit_kudu',
    name: 'Conduit Kudu',
    title: 'Pylon Grazer',
    school: 'surge',
    blurb:
      'Grazes the pylon fields where the grid hums loudest. Draws every charge within reach down through its horns and into one body.',
    deck: [...STARTER_DECK],
    // The standing half of Surge -- pylons, the storm overhead, the big discharge. The
    // Lynx keeps the footwork.
    grimoire: {
      schools: ['surge'],
      hybridChance: MONO_HYBRID_CHANCE,
      // Two, where it was four: the Kudu's signatures carry what stands still now.
      omit: ['arcing_step', 'galvanic_rally'],
    },
    legacyGrimoire: [
      'induction',
      'induction',
      'capacitor_dump',
      'thunderhead',
      'tesla_pylon',
      'elmos_fire',
      'static_arc',
      'discharge',
    ],
    unitCardId: 'kudu_bound',
  },
  {
    id: 'jackal',
    artId: 'barrow_jackal',
    name: 'Barrow Jackal',
    title: 'Grave-Digger',
    school: 'dusk',
    blurb:
      'Digs where the ground is freshest. Rots them slowly, and puts your own dead back on their feet.',
    deck: [...STARTER_DECK],
    // The grave-work half of Dusk. It exhumes and it tends; the Stag's harvests and rallies
    // are somebody else's appetite.
    grimoire: {
      schools: ['dusk'],
      hybridChance: MONO_HYBRID_CHANCE,
      // Two, where it was four: the Jackal's signatures carry the digging now.
      omit: ['blood_and_bone_rally', 'grave_call'],
    },
    legacyGrimoire: [
      'pall',
      'pall',
      'exhume',
      'last_rites',
      'creeping_decay',
      'charnel_pillar',
      'shadow_siphon',
      'wither',
    ],
    unitCardId: 'jackal_bound',
  },
  {
    id: 'aurochs',
    artId: 'moss_aurochs',
    name: 'Moss Aurochs',
    title: 'Fallow Warden',
    school: 'bloom',
    blurb:
      'Grazes the strips the tithe left. Poisons a whole field and calls the rot in when it is ready.',
    deck: [...STARTER_DECK],
    // The field half of Bloom: pollen, blight, harvest. Thorns and briars are the Warden's.
    grimoire: {
      schools: ['bloom'],
      hybridChance: MONO_HYBRID_CHANCE,
      // Two, where it was four: the Aurochs' signatures carry the field now.
      omit: ['strangling_vines', 'verdant_collapse'],
    },
    legacyGrimoire: [
      'pollen_drift',
      'pollen_drift',
      'blight_harvest',
      'blight_harvest',
      'blight_bloom',
      'noxious_cloud',
      'taproot',
      'spore_cloud',
    ],
    unitCardId: 'aurochs_bound',
  },
  {
    id: 'ram',
    artId: 'quarry_ram',
    name: 'Quarry Ram',
    title: 'Chalk Breaker',
    school: 'bulwark',
    blurb:
      'Breaks the road it is not allowed to walk. Drops the ground out from under them and shoves what is left.',
    deck: [...STARTER_DECK],
    // The breaking half of Bulwark. The Boar keeps the gates; a ram has never held a door
    // in its life.
    grimoire: {
      schools: ['bulwark'],
      hybridChance: MONO_HYBRID_CHANCE,
      // Two, where it was four: the Ram's signatures carry the breaking now.
      omit: ['iron_gate', 'bastion_stance'],
    },
    legacyGrimoire: [
      'sinkhole',
      'counterweight',
      'counterweight',
      'crag_slam',
      'deadweight',
      'seismic_slam',
      'seismic_slam',
      'avalanche_slam',
    ],
    unitCardId: 'ram_bound',
  },

  // ------------------------------------------------- the last five pairings
  //
  // Fifteen pairs of schools exist and ten of them had a bloodline. These are the other
  // five, and with them every two-school combination in the game is somebody's.
  //
  // Four of the five are half Bloom, which is not an accident of taste: Bloom was the school
  // with the fewest partners already spoken for, so closing the set meant closing Bloom's
  // row. The fusion book grew to match -- each of these five pairings gained a second
  // fusion card in the same change, so a hybrid drafting a third of its book out of fusions
  // no longer draws the same one every time.
  //
  // No `omit` on any of them. A hybrid is already unlike every other species by its pairing,
  // and it draws from two schools at once -- roughly thirty cards -- so subtracting four
  // would be noise rather than character. The omit lists exist to separate species that
  // would otherwise be identical, and no two hybrids are.

  {
    id: 'shade',
    artId: 'cinder_shade',
    name: 'Cinder Shade',
    title: 'Lamp-Eater',
    school: 'dusk',
    blurb:
      'What is left of a lamplighter who kept going back. Burns them, then drinks what the burning left.',
    deck: [...STARTER_DECK],
    grimoire: { schools: ['pyre', 'dusk'], hybridChance: HYBRID_HYBRID_CHANCE },
    legacyGrimoire: [
      'flame_surge',
      'ashen_wake',
      'stoke',
      'shadow_siphon',
      'shadow_siphon',
      'marrow_siphon',
      'wither',
      'ember_coat',
    ],
    unitCardId: 'shade_bound',
  },
  {
    id: 'elk',
    artId: 'winterthorn_elk',
    name: 'Winterthorn Elk',
    title: 'Rimebloom',
    school: 'frost',
    blurb:
      'Poison first, then the cold. Anything rotting when the frost lands freezes where it stands.',
    deck: [...STARTER_DECK],
    grimoire: { schools: ['frost', 'bloom'], hybridChance: HYBRID_HYBRID_CHANCE },
    legacyGrimoire: [
      'spore_cloud',
      'spore_cloud',
      'root_snare',
      'glacial_spike',
      'glacial_spike',
      'cold_snap',
      'frost_nova',
      'brittle_touch',
    ],
    unitCardId: 'elk_bound',
  },
  {
    id: 'serpent',
    artId: 'voltbriar_serpent',
    name: 'Voltbriar Serpent',
    title: 'Hedge Lightning',
    school: 'surge',
    blurb:
      'Lives in the briar and the briar is live. Roots them where they stand, then makes standing there a mistake.',
    deck: [...STARTER_DECK],
    grimoire: { schools: ['surge', 'bloom'], hybridChance: HYBRID_HYBRID_CHANCE },
    legacyGrimoire: [
      'root_snare',
      'root_snare',
      'static_arc',
      'static_arc',
      'arc_lash',
      'induction',
      'spore_cloud',
      'static_charge',
    ],
    unitCardId: 'serpent_bound',
  },
  {
    id: 'heron',
    artId: 'murk_heron',
    name: 'Murk Heron',
    title: 'Fen Reaper',
    school: 'dusk',
    blurb:
      'Stands in the shallows until the rot is ready. Poison and decay are the same patience twice.',
    deck: [...STARTER_DECK],
    grimoire: { schools: ['dusk', 'bloom'], hybridChance: HYBRID_HYBRID_CHANCE },
    legacyGrimoire: [
      'noxious_cloud',
      'noxious_cloud',
      'creeping_decay',
      'shadow_siphon',
      'marrow_siphon',
      'pall',
      'spore_cloud',
      'wither',
    ],
    unitCardId: 'heron_bound',
  },
  {
    id: 'crab',
    artId: 'dolmen_crab',
    name: 'Dolmen Crab',
    title: 'Hedgefort',
    school: 'bulwark',
    blurb:
      'A standing stone the hedge grew through, and then wore. Holds the ground and taxes whoever stands beside it.',
    deck: [...STARTER_DECK],
    grimoire: { schools: ['bulwark', 'bloom'], hybridChance: HYBRID_HYBRID_CHANCE },
    legacyGrimoire: [
      'tectonic_plate',
      'tectonic_plate',
      'briar_rampart',
      'root_snare',
      'seismic_slam',
      'seismic_slam',
      'spore_cloud',
      'thornlash',
    ],
    unitCardId: 'crab_bound',
  },

  // -------------------------------------------------------- the third bloodlines
  //
  // Two more mono species for Pyre, Frost and Surge, so each of those schools speaks through
  // four beasts. What separates four beasts of one school is no longer mostly `omit`: each
  // has three signature cards of its own and opens its book on one of them, and the omit is
  // down to the two cards that most belong to a cousin. Every one is huntable; none reaches
  // the creation screen, because `foundersOf` takes the first mono species of each school.
  //
  // Their art is still to be painted, so each ships on a school-coloured stand-in listed in
  // `COMPANION_ART_PENDING`.

  {
    id: 'phoenix',
    artId: 'ashwing_phoenix',
    name: 'Ashwing Phoenix',
    title: 'Pyre Bird',
    school: 'pyre',
    blurb:
      'Burns down to ash every winter and comes back angrier. Throws fire from above the fight, and puts your fallen back on their feet.',
    deck: [...STARTER_DECK],
    // The Phoenix is the caster of the school: it keeps the long shapes and gives up the
    // two that pull the fight to it.
    grimoire: {
      schools: ['pyre'],
      hybridChance: MONO_HYBRID_CHANCE,
      omit: ['chimney_draw', 'pressure_valve_release'],
    },
    legacyGrimoire: [
      'phoenix_dive',
      'phoenix_dive',
      'wingbeat_embers',
      'flame_surge',
      'flame_surge',
      'molten_shot',
      'kindling',
      'ash_rebirth',
    ],
    unitCardId: 'phoenix_bound',
  },
  {
    id: 'badger',
    artId: 'cinderback_badger',
    name: 'Cinderback Badger',
    title: 'Sett Burner',
    school: 'pyre',
    blurb:
      'Digs its sett under the slag heaps and fills it with smoke. Bites hard, burns what it bites, and will not be moved off its ground.',
    deck: [...STARTER_DECK],
    // The brawler of the school: close fire and smoke. It never learns the long shapes.
    grimoire: {
      schools: ['pyre'],
      hybridChance: MONO_HYBRID_CHANCE,
      omit: ['cinder_gale', 'cataclysmic_core'],
    },
    legacyGrimoire: [
      'burrow_strike',
      'burrow_strike',
      'smoke_sett',
      'cinderback_bristle',
      'fire_breath',
      'fire_breath',
      'scorch',
      'stoke',
    ],
    unitCardId: 'badger_bound',
  },
  {
    id: 'mammoth',
    artId: 'hoarfrost_mammoth',
    name: 'Hoarfrost Mammoth',
    title: 'Glacier Walker',
    school: 'frost',
    blurb:
      'Walks down off the glacier once a generation and does not step round anything. Stands in front, tramples a line, and freezes what it stops.',
    deck: [...STARTER_DECK],
    // The wall of the school: armour and stomps. It leaves the fog to the Seal and the Ermine.
    grimoire: {
      schools: ['frost'],
      hybridChance: MONO_HYBRID_CHANCE,
      omit: ['whiteout', 'cold_snap'],
    },
    legacyGrimoire: [
      'mammoth_trample',
      'permafrost_stomp',
      'permafrost_stomp',
      'woolly_hide',
      'woolly_hide',
      'glacial_spike',
      'ice_barricade',
      'frost_nova',
    ],
    unitCardId: 'mammoth_bound',
  },
  {
    id: 'ermine',
    artId: 'rime_ermine',
    name: 'Rime Ermine',
    title: 'Snow Thief',
    school: 'frost',
    blurb:
      'White on white, and gone before you see it. Bites what the cold has already slowed, and hides in its own weather.',
    deck: [...STARTER_DECK],
    // The skirmisher of the school: cheap cold and the payoff for it. It never learns the
    // slow walls.
    grimoire: {
      schools: ['frost'],
      hybridChance: MONO_HYBRID_CHANCE,
      omit: ['ice_barricade', 'hail_spire'],
    },
    legacyGrimoire: [
      'ermine_bite',
      'ermine_bite',
      'frozen_ambush',
      'white_dash',
      'cold_snap',
      'cold_snap',
      'creeping_rime',
      'frostbite',
    ],
    unitCardId: 'ermine_bound',
  },
  {
    id: 'eel',
    artId: 'galvanic_eel',
    name: 'Galvanic Eel',
    title: 'Canal Current',
    school: 'surge',
    blurb:
      'Lives in the canals under the Works, where the grid bleeds into the water. Coils round what it catches and turns the water against it.',
    deck: [...STARTER_DECK],
    // The water half of Surge: currents and coils. It leaves the pylons to the Kudu.
    grimoire: {
      schools: ['surge'],
      hybridChance: MONO_HYBRID_CHANCE,
      omit: ['tesla_pylon', 'tempest_break'],
    },
    legacyGrimoire: [
      'eel_coil',
      'eel_jolt',
      'eel_jolt',
      'canal_current',
      'static_arc',
      'static_arc',
      'discharge',
      'spark',
    ],
    unitCardId: 'eel_bound',
  },
  {
    id: 'pangolin',
    artId: 'sparkback_pangolin',
    name: 'Sparkback Pangolin',
    title: 'Rolling Grid',
    school: 'surge',
    blurb:
      'Plated in scales that hum. Curls up, takes the blow, and gives the charge back to whoever struck it.',
    deck: [...STARTER_DECK],
    // The shield of the school: scales and rolls. It never learns the Lynx's footwork.
    grimoire: {
      schools: ['surge'],
      hybridChance: MONO_HYBRID_CHANCE,
      omit: ['arcing_step', 'galvanic_rally'],
    },
    legacyGrimoire: [
      'ball_roll',
      'ball_roll',
      'scale_shed',
      'static_curl',
      'thunderclap',
      'chain_bolt',
      'induction',
      'spark',
    ],
    unitCardId: 'pangolin_bound',
  },

  // ------------------------------------------------------- the fourth bloodlines
  //
  // Bulwark, Dusk and Bloom, likewise to four beasts each: a charger and a builder, a watcher
  // and a trapper, a runner and a duster. Huntable, signature-led, and on stand-in art until
  // painted.

  {
    id: 'rhino',
    artId: 'ironhide_rhino',
    name: 'Ironhide Rhino',
    title: 'Wall Breaker',
    school: 'bulwark',
    blurb:
      'Hide like a tannery door and no reverse gear. Charges down a line, gores what is left, and cannot be moved off the spot it chose.',
    deck: [...STARTER_DECK],
    // The charger of the school: lines and horns. It leaves the patient walls to the Boar.
    grimoire: {
      schools: ['bulwark'],
      hybridChance: MONO_HYBRID_CHANCE,
      omit: ['bastion_stance', 'battlement'],
    },
    legacyGrimoire: [
      'horn_gore',
      'crushing_charge',
      'iron_brace',
      'fault_line',
      'fault_line',
      'siege_break',
      'counterweight',
      'seismic_slam',
    ],
    unitCardId: 'rhino_bound',
  },
  {
    id: 'beetle',
    artId: 'menhir_beetle',
    name: 'Menhir Beetle',
    title: 'Stone Roller',
    school: 'bulwark',
    blurb:
      'Rolls the old standing stones back to where they stood and dares you to move them. Casts from behind its own shell.',
    deck: [...STARTER_DECK],
    // The builder of the school: stones and shells. It never learns the ground-breaking.
    grimoire: {
      schools: ['bulwark'],
      hybridChance: MONO_HYBRID_CHANCE,
      omit: ['sinkhole', 'avalanche_slam'],
    },
    legacyGrimoire: [
      'standing_stone',
      'dung_ball',
      'dung_ball',
      'hardened_shell',
      'iron_gate',
      'rubble_wall',
      'rubble_wall',
      'bastion_stance',
    ],
    unitCardId: 'beetle_bound',
  },
  {
    id: 'owl',
    artId: 'gloam_owl',
    name: 'Gloam Owl',
    title: 'Barrow Watcher',
    school: 'dusk',
    blurb:
      'Watches the barrows at night and sees everything that walks there. Strikes from the dark and knows what you will do before you do.',
    deck: [...STARTER_DECK],
    // The watcher of the school: sight and darkness. It leaves the digging to the Jackal.
    grimoire: {
      schools: ['dusk'],
      hybridChance: MONO_HYBRID_CHANCE,
      omit: ['grave_call', 'exhume'],
    },
    legacyGrimoire: [
      'silent_talon',
      'silent_talon',
      'owl_omen',
      'moonless_night',
      'gloom_bolt',
      'gloom_bolt',
      'wither',
      'pall',
    ],
    unitCardId: 'owl_bound',
  },
  {
    id: 'spider',
    artId: 'crypt_spider',
    name: 'Crypt Spider',
    title: 'Ossuary Weaver',
    school: 'dusk',
    blurb:
      'Spins across the ossuary doors and waits for whoever opens them. Webs, poisons, and feeds its brood on what it catches.',
    deck: [...STARTER_DECK],
    // The trapper of the school: webs and venom. It never learns the smoke.
    grimoire: {
      schools: ['dusk'],
      hybridChance: MONO_HYBRID_CHANCE,
      omit: ['smoke_bomb', 'last_rites'],
    },
    legacyGrimoire: [
      'venom_bite',
      'venom_bite',
      'web_snare',
      'brood_sac',
      'pall',
      'plague_wind',
      'creeping_decay',
      'shadow_siphon',
    ],
    unitCardId: 'spider_bound',
  },
  {
    id: 'fox',
    artId: 'bramble_fox',
    name: 'Bramble Fox',
    title: 'Hedge Runner',
    school: 'bloom',
    blurb:
      'Runs the hedgerows between the tithe strips and knows every gap in them. Pounces on whatever the thorns are holding.',
    deck: [...STARTER_DECK],
    // The runner of the school: bites and pounces. It never learns the slow roots.
    grimoire: {
      schools: ['bloom'],
      hybridChance: MONO_HYBRID_CHANCE,
      omit: ['taproot', 'verdant_swell'],
    },
    legacyGrimoire: [
      'bramble_pounce',
      'bramble_pounce',
      'sly_retreat',
      'briar_bite',
      'briar_bite',
      'thornlash',
      'root_snare',
      'nettle',
    ],
    unitCardId: 'fox_bound',
  },
  {
    id: 'moth',
    artId: 'pollen_moth',
    name: 'Pollen Moth',
    title: 'Field Duster',
    school: 'bloom',
    blurb:
      'Drifts over the fallow strips at dusk and dusts everything below it. The field it passes over wakes up poisoned.',
    deck: [...STARTER_DECK],
    // The duster of the school: clouds and spores. It leaves the thicket walls to the Warden.
    grimoire: {
      schools: ['bloom'],
      hybridChance: MONO_HYBRID_CHANCE,
      omit: ['briar_rampart', 'root_snare'],
    },
    legacyGrimoire: [
      'pollen_burst',
      'pollen_burst',
      'dusting_wings',
      'moth_swarm',
      'spore_cloud',
      'pollen_drift',
      'noxious_cloud',
      'spore_burst',
    ],
    unitCardId: 'moth_bound',
  },

  // ------------------------------------------------------- the lair hybrids

  {
    id: 'otter',
    artId: 'steamvent_otter',
    name: 'Steamvent Otter',
    title: 'Vent Swimmer',
    school: 'frost',
    blurb:
      'Swims the hot pools under the caldera vents where the meltwater meets the fire. Scalds, chills, and hides in its own steam.',
    deck: [...STARTER_DECK],
    grimoire: { schools: ['pyre', 'frost'], hybridChance: HYBRID_HYBRID_CHANCE },
    legacyGrimoire: [
      'scalding_splash',
      'glacial_spike',
      'glacial_spike',
      'flame_surge',
      'flame_surge',
      'cold_snap',
      'kindling',
      'frost_nova',
    ],
    unitCardId: 'otter_bound',
  },
  {
    id: 'thunderhawk',
    artId: 'thunderhawk',
    name: 'Thunderhawk',
    title: 'Storm Raptor',
    school: 'surge',
    blurb:
      'Rides the storm front down off the Shelf and strikes like the lightning it flies in. What it hits burns.',
    deck: [...STARTER_DECK],
    grimoire: { schools: ['pyre', 'surge'], hybridChance: HYBRID_HYBRID_CHANCE },
    legacyGrimoire: [
      'lightning_dive',
      'static_arc',
      'static_arc',
      'flame_surge',
      'flame_surge',
      'chain_bolt',
      'spark',
      'kindling',
    ],
    unitCardId: 'thunderhawk_bound',
  },
  {
    id: 'wight',
    artId: 'frostbarrow_wight',
    name: 'Frostbarrow Wight',
    title: 'Cold Revenant',
    school: 'dusk',
    blurb:
      'Something the barrow kept cold for a long time and has only lately let go of. Rots what it touches and freezes what it rots.',
    deck: [...STARTER_DECK],
    grimoire: { schools: ['frost', 'dusk'], hybridChance: HYBRID_HYBRID_CHANCE },
    legacyGrimoire: [
      'barrow_chill',
      'wither',
      'wither',
      'glacial_spike',
      'glacial_spike',
      'pall',
      'frostbite',
      'cold_snap',
    ],
    unitCardId: 'wight_bound',
  },
  {
    id: 'bear',
    artId: 'barrow_bear',
    name: 'Barrow Bear',
    title: 'Ossuary Sleeper',
    school: 'bulwark',
    blurb:
      'Sleeps the winter out in the ossuary and wakes up hungry. Stands in front of the dead as if they were its cubs.',
    deck: [...STARTER_DECK],
    grimoire: { schools: ['bulwark', 'dusk'], hybridChance: HYBRID_HYBRID_CHANCE },
    legacyGrimoire: [
      'ossuary_maul',
      'ossuary_maul',
      'counterweight',
      'counterweight',
      'crag_slam',
      'pall',
      'wither',
      'bastion_stance',
    ],
    unitCardId: 'bear_bound',
  },
  {
    id: 'myconid',
    artId: 'rotcap_myconid',
    name: 'Rotcap Myconid',
    title: 'Spore Elder',
    school: 'bloom',
    blurb:
      'The fairy ring in the Ashwood is one creature, and it is very old. Its caps rot the ground they stand on and everything that falls there.',
    deck: [...STARTER_DECK],
    grimoire: { schools: ['dusk', 'bloom'], hybridChance: HYBRID_HYBRID_CHANCE },
    legacyGrimoire: [
      'rotcap_bloom',
      'rotcap_bloom',
      'spore_cloud',
      'pollen_drift',
      'pall',
      'pall',
      'spore_burst',
      'wither',
    ],
    unitCardId: 'myconid_bound',
  },

  // ------------------------------------------------------- the rare-hunt hybrids

  {
    id: 'armadillo',
    artId: 'slagback_armadillo',
    name: 'Slagback Armadillo',
    title: 'Tip Roller',
    school: 'bulwark',
    blurb:
      'Curls into a ball of cooling slag and rolls down the tip at whatever is at the bottom. What it hits is flattened and alight.',
    deck: [...STARTER_DECK],
    grimoire: { schools: ['pyre', 'bulwark'], hybridChance: HYBRID_HYBRID_CHANCE },
    legacyGrimoire: [
      'slag_roll',
      'slag_roll',
      'fault_line',
      'counterweight',
      'crag_slam',
      'flame_surge',
      'scorch',
      'stoke',
    ],
    unitCardId: 'armadillo_bound',
  },
  {
    id: 'kestrel',
    artId: 'aurora_kestrel',
    name: 'Aurora Kestrel',
    title: 'Polar Light',
    school: 'surge',
    blurb:
      'Hovers over the Rimefields on nights the sky burns green, and falls on whatever the light shows it. The cold it carries conducts.',
    deck: [...STARTER_DECK],
    grimoire: { schools: ['frost', 'surge'], hybridChance: HYBRID_HYBRID_CHANCE },
    legacyGrimoire: [
      'polar_flash',
      'polar_flash',
      'glacial_spike',
      'cold_snap',
      'static_arc',
      'static_arc',
      'chain_bolt',
      'sleet',
    ],
    unitCardId: 'kestrel_bound',
  },
  {
    id: 'newt',
    artId: 'rimebloom_newt',
    name: 'Rimebloom Newt',
    title: 'Meltwater Sleeper',
    school: 'bloom',
    blurb:
      'Sleeps out the winter frozen in the ditches of the Tallow Levels and wakes when the first shoots do. Its skin is cold, and its skin is poison.',
    deck: [...STARTER_DECK],
    grimoire: { schools: ['frost', 'bloom'], hybridChance: HYBRID_HYBRID_CHANCE },
    legacyGrimoire: [
      'rimebloom',
      'rimebloom',
      'frostbite',
      'cold_snap',
      'nettle',
      'thorn_volley',
      'root_snare',
      'sleet',
    ],
    unitCardId: 'newt_bound',
  },
  {
    id: 'raven',
    artId: 'stormgrave_raven',
    name: 'Stormgrave Raven',
    title: 'Carrion Crackle',
    school: 'dusk',
    blurb:
      'Follows the storms over the Bone Bastion and picks over what they leave. It always knows which of you is weakest, and it tells the lightning.',
    deck: [...STARTER_DECK],
    grimoire: { schools: ['surge', 'dusk'], hybridChance: HYBRID_HYBRID_CHANCE },
    legacyGrimoire: [
      'raven_call',
      'raven_call',
      'gloom_bolt',
      'pall',
      'static_arc',
      'spark',
      'discharge',
      'wither',
    ],
    unitCardId: 'raven_bound',
  },
  {
    id: 'toad',
    artId: 'sparkspore_toad',
    name: 'Sparkspore Toad',
    title: 'Bog Battery',
    school: 'bloom',
    blurb:
      'Squats in the salt marsh where the grid runs to earth and swells up on it. Its warts spark, and the spores it puffs are live.',
    deck: [...STARTER_DECK],
    grimoire: { schools: ['surge', 'bloom'], hybridChance: HYBRID_HYBRID_CHANCE },
    legacyGrimoire: [
      'spark_spores',
      'spark_spores',
      'spark',
      'static_insight',
      'nettle',
      'pollen_drift',
      'thorn_volley',
      'static_arc',
    ],
    unitCardId: 'toad_bound',
  },

  // ------------------------------------------------------- the contract hybrids

  {
    id: 'wraith',
    artId: 'wick_wraith',
    name: 'Wick Wraith',
    title: 'Candle Revenant',
    school: 'dusk',
    blurb:
      'Lives in the lamps of Lamprow and eats the light out of them one wick at a time. What it burns, it keeps.',
    deck: [...STARTER_DECK],
    grimoire: { schools: ['pyre', 'dusk'], hybridChance: HYBRID_HYBRID_CHANCE },
    legacyGrimoire: [
      'wick_drain',
      'wick_drain',
      'flame_surge',
      'kindling',
      'pall',
      'wither',
      'gloom_bolt',
      'stoke',
    ],
    unitCardId: 'wraith_bound',
  },
  {
    id: 'chameleon',
    artId: 'ashvine_chameleon',
    name: 'Ashvine Chameleon',
    title: 'Cinder Creeper',
    school: 'pyre',
    blurb:
      'Clings to the burnt orchards of the Tallow Levels, the colour of char one moment and new leaf the next. Its tongue is a lit vine.',
    deck: [...STARTER_DECK],
    grimoire: { schools: ['pyre', 'bloom'], hybridChance: HYBRID_HYBRID_CHANCE },
    legacyGrimoire: [
      'vine_flare',
      'flame_surge',
      'flame_surge',
      'kindling',
      'thorn_volley',
      'nettle',
      'root_snare',
      'scorch',
    ],
    unitCardId: 'chameleon_bound',
  },
  {
    id: 'yak',
    artId: 'rimestone_yak',
    name: 'Rimestone Yak',
    title: 'Pass Hauler',
    school: 'frost',
    blurb:
      'Hauls the salt carts over the Rimefield passes and has never once been talked out of the middle of the road. Its hide is half ice.',
    deck: [...STARTER_DECK],
    grimoire: { schools: ['frost', 'bulwark'], hybridChance: HYBRID_HYBRID_CHANCE },
    legacyGrimoire: [
      'avalanche_haul',
      'avalanche_haul',
      'glacial_spike',
      'frost_nova',
      'counterweight',
      'crag_slam',
      'ice_barricade',
      'bastion_stance',
    ],
    unitCardId: 'yak_bound',
  },
  {
    id: 'scarab',
    artId: 'lodestone_scarab',
    name: 'Lodestone Scarab',
    title: 'Magnet Roller',
    school: 'surge',
    blurb:
      'Rolls balls of scrap iron across the Storm Shelf and charges them off the conduits. Everything metal in the field drifts toward it.',
    deck: [...STARTER_DECK],
    grimoire: { schools: ['surge', 'bulwark'], hybridChance: HYBRID_HYBRID_CHANCE },
    legacyGrimoire: [
      'lodestone_pull',
      'lodestone_pull',
      'static_arc',
      'chain_bolt',
      'counterweight',
      'crag_slam',
      'fault_line',
      'spark',
    ],
    unitCardId: 'scarab_bound',
  },
  {
    id: 'hedgehog',
    artId: 'thornstone_hedgehog',
    name: 'Thornstone Hedgehog',
    title: 'Hedge Fort',
    school: 'bloom',
    blurb:
      'Curls up in the dry-stone walls of the Chalk Road and grows thorns through the gaps. Nothing moves it, and nothing touches it twice.',
    deck: [...STARTER_DECK],
    grimoire: { schools: ['bulwark', 'bloom'], hybridChance: HYBRID_HYBRID_CHANCE },
    legacyGrimoire: [
      'spine_volley',
      'spine_volley',
      'thornlash',
      'root_snare',
      'counterweight',
      'rubble_wall',
      'bastion_stance',
      'nettle',
    ],
    unitCardId: 'hedgehog_bound',
  },
];

/**
 * Every species, with its Grimoire source stamped with its own id.
 *
 * `GrimoireSource.bloodline` is what a signature card is matched against, and it is always
 * the species' id — so it is written here once rather than twenty-seven times by hand, where
 * a species added later could leave it off and quietly draft none of its own signatures.
 */
export const COMPANIONS: CompanionDef[] = SPECIES.map((c) => ({
  ...c,
  grimoire: { ...c.grimoire, bloodline: c.id },
}));

export function companionById(id: string): CompanionDef | undefined {
  return COMPANIONS.find((c) => c.id === id);
}

/**
 * The species behind a Bound Form, found from the stat block on the board.
 *
 * The other direction of `unitCardId`, and it exists because a renderer is handed a fight
 * rather than a character: `EncounterDef.enemyCompanion` names a unit card, and what the
 * screen needs from it is a species -- for `artId`, so an enemy Commander can be drawn as the
 * beast it actually is instead of a coloured prism.
 *
 * A miss is ordinary and not an error. Plenty of unit cards are nobody's Bound Form, and a
 * test arena may name one that no species claims; the caller falls back to a silhouette.
 */
export function companionByUnitCard(unitCardId: string): CompanionDef | undefined {
  return COMPANIONS.find((c) => c.unitCardId === unitCardId);
}

export const DEFAULT_COMPANION = COMPANIONS[0]!;

/**
 * The discipline a character enrols in when nobody asked.
 *
 * Read off `DEFAULT_COMPANION` rather than written down, so the fallback school and the
 * fallback bloodline cannot name different things. It is what a legacy save, a test, and
 * any caller that has not been through the selection screen all get -- the school the game
 * started with, before there was a choice to make.
 */
export const DEFAULT_SCHOOL: School = DEFAULT_COMPANION.grimoire.schools[0]!;
