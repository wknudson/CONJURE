import { describe, expect, it } from 'vitest';
import { CONTRACT_SITES, siteByEncounter, sitesInArea } from '../district/sites.js';
import { STORY_CONTRACTS } from '../core/data/campaign.js';
import { LAIRS } from '../core/data/lairs.js';
import { areaById } from '../district/areas/index.js';
import { encounterById } from '../core/data/encounters/index.js';
import { folkSheetOf, isFolkId } from '../render/folk.js';

/**
 * The board is a briefing surface and the world is the launcher, so the world has to
 * actually hold every fight the board can name. These are the coverage guarantees: a
 * contract with no site is a poster pointing at nothing, and a site with no encounter
 * is a hotspot that throws on interact.
 */
describe('contract sites', () => {
  it('gives every story contract exactly one site', () => {
    for (const contract of STORY_CONTRACTS) {
      const sites = CONTRACT_SITES.filter((s) => s.encounterId === contract.id);
      expect(sites, `${contract.id}: a poster pointing at nothing`).toHaveLength(1);
    }
  });

  it('gives every lair exactly one site', () => {
    for (const lair of LAIRS) {
      const sites = CONTRACT_SITES.filter((s) => s.encounterId === lair.encounterId);
      expect(sites, `${lair.encounterId}: a lair with no ground`).toHaveLength(1);
    }
  });

  it('stands every site in a real area', () => {
    for (const site of CONTRACT_SITES) {
      expect(areaById(site.areaId), `${site.id}: unknown area ${site.areaId}`).toBeDefined();
    }
  });

  it('points every site at a real encounter', () => {
    for (const site of CONTRACT_SITES) {
      expect(
        encounterById(site.encounterId),
        `${site.id}: unknown encounter ${site.encounterId}`,
      ).toBeDefined();
    }
  });

  it('keeps ids in the areaId:slug idiom, unique', () => {
    const seen = new Set<string>();
    for (const site of CONTRACT_SITES) {
      expect(site.id.startsWith(`${site.areaId}:`), `${site.id}: id must lead with its area`).toBe(
        true,
      );
      expect(seen.has(site.id), `${site.id}: duplicate id`).toBe(false);
      seen.add(site.id);
    }
  });

  it('stands every site inside its area’s bounds', () => {
    for (const site of CONTRACT_SITES) {
      const area = areaById(site.areaId)!;
      // World units: an area is cols x rows tiles of 4, centred on the origin.
      const halfW = (area.cols * 4) / 2;
      const halfH = (area.rows * 4) / 2;
      expect(Math.abs(site.at.x), `${site.id}: x outside ${site.areaId}`).toBeLessThanOrEqual(
        halfW,
      );
      expect(Math.abs(site.at.z), `${site.id}: z outside ${site.areaId}`).toBeLessThanOrEqual(
        halfH,
      );
    }
  });

  it('opens the campaign one area from the start ward', () => {
    // The tutorial's first contract must be walkable by a four-minute-old character:
    // its site has to sit in the start ward or a ward adjacent to it.
    const first = STORY_CONTRACTS[0]!;
    const site = siteByEncounter(first.id)!;
    if (site.areaId === 'ashfall_ward') return;
    const ashfall = areaById('ashfall_ward')!;
    const exits = ashfall.exits.map((r) => r.to);
    expect(exits, `${site.areaId} must adjoin the start ward`).toContain(site.areaId);
  });

  it('answers area lookups', () => {
    expect(sitesInArea('highcourt').length).toBeGreaterThanOrEqual(7);
    expect(sitesInArea('nowhere')).toHaveLength(0);
  });

  it('stands a duelist at every wager duel, drawn from the duelists sheet', () => {
    // The five duels are the sites that are a person rather than a place, and the figure is
    // the interactable while the contract is live. Listed by hand so removing one -- or
    // pointing it at a townsperson from another sheet -- fails here rather than rendering a
    // grocer holding the King's ground.
    const duels = [
      'smoke_eaters_rest',
      'ashwood_poacher',
      'waystone_duel',
      'coldwater_duel',
      'underhill_duel',
    ];
    for (const id of duels) {
      const site = siteByEncounter(id);
      expect(site?.duelist, `${id} has nobody standing at it`).toBeTruthy();
      expect(isFolkId(site!.duelist!), `${id}: '${site!.duelist}' is not drawn`).toBe(true);
      expect(folkSheetOf(site!.duelist!), id).toBe('duelists');
    }
    // And nobody else is: a granary door with a duelist standing in it is a data slip.
    for (const site of CONTRACT_SITES) {
      if (!duels.includes(site.encounterId)) {
        expect(site.duelist, `${site.id} is not a duel and has a duelist`).toBeUndefined();
      }
    }
    // Every duelist is a different person. Two sites wearing one face is the cobbler
    // problem all over again, and there are eleven figures to choose from.
    const worn = duels.map((id) => siteByEncounter(id)!.duelist!);
    expect(new Set(worn).size).toBe(worn.length);
  });
});
