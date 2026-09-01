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

export const COMPANIONS: CompanionDef[] = [
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
      omit: ['chimney_draw', 'emberfall', 'slag_cairn', 'pressure_valve_release'],
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
      omit: ['hoarfrost_veil', 'calving', 'whiteout', 'hail_spire'],
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
      omit: ['elmos_fire', 'capacitor_dump', 'tesla_pylon', 'thunderhead'],
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
      omit: ['exhume', 'last_rites', 'charnel_pillar', 'smoke_bomb'],
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
      omit: ['pollen_drift', 'blight_harvest', 'noxious_cloud', 'blight_bloom'],
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
      omit: ['sinkhole', 'counterweight', 'deadweight', 'crag_slam'],
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
      omit: ['cataclysm', 'cataclysmic_core', 'cinder_gale', 'pyre_pillar'],
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
      omit: ['rime_lock', 'deep_winter', 'creeping_rime', 'ice_barricade'],
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
    id: 'kite',
    artId: 'conduit_kite',
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
      omit: ['arcing_step', 'galvanic_rally', 'paralytic_arc', 'chain_bolt'],
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
    unitCardId: 'kite_bound',
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
      omit: ['harvest_the_weak', 'blood_and_bone_rally', 'marrow_burst', 'grave_call'],
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
      omit: ['thornlash', 'strangling_vines', 'briar_rampart', 'verdant_collapse'],
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
      omit: ['iron_gate', 'battlement', 'bastion_stance', 'petrifying_mantle'],
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
];

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
