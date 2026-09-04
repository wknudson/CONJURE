/**
 * The banner that says progress is not being kept.
 *
 * `writeSave` has always failed quietly and returned `false`, and the one caller threw the
 * answer away — so in a private window, or at quota, or with storage blocked by policy, a
 * tester played a whole session, earned everything, closed the tab and lost it all with no
 * warning at any point. Now the first failed write raises this, and the next successful one
 * takes it down again. It is not dismissable while the writes keep failing, on purpose.
 *
 * Appended to `document.body` like the crash panel, for the same reason: it must outlive
 * any screen swap.
 */

import type { StorageFailure } from './save.js';

const COPY: Record<StorageFailure, string> = {
  blocked:
    'This browser is not letting the game save. Private browsing and some privacy settings do this. You can keep playing, but nothing will be kept when this tab closes.',
  full: 'Browser storage is full, so the game cannot save. Free some space or use another browser. You can keep playing, but nothing will be kept when this tab closes.',
};

let banner: HTMLElement | null = null;

export function showSaveWarning(reason: StorageFailure): void {
  if (!banner) {
    banner = document.createElement('div');
    banner.className = 'save-warning';
    banner.setAttribute('role', 'alert');
    document.body.appendChild(banner);
  }
  banner.textContent = `Progress is not being saved. ${COPY[reason]}`;
}

export function clearSaveWarning(): void {
  banner?.remove();
  banner = null;
}
