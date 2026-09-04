import { describe, expect, it } from 'vitest';
import { isTutorialFlag, type TutorialFlag } from '../app/save.js';
import { tutorialActive } from '../district/quest.js';

/**
 * The combat coach marks are recorded on the profile's tutorial ledger, not in the
 * browser: a second character on the same machine used to never see them. The flag has to
 * survive the save's flag filter, and it must not read as a step of the district's lap.
 */
describe('the coach-marks flag', () => {
  it('is a tutorial flag the save keeps', () => {
    expect(isTutorialFlag('coach')).toBe(true);
  });

  it('does not count as a step of the first lap', () => {
    const flags: TutorialFlag[] = ['coach'];
    expect(tutorialActive(flags), 'the lap is still on with only the marks seen').toBe(true);
    expect(tutorialActive(['intro', 'artificer', 'journal', 'bounty_taken', 'complete'])).toBe(false);
  });
});
