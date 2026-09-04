/**
 * The settings panel: a modal over everything, opened from the title wall, the district's
 * Escape menu and the combat HUD's gear.
 *
 * A module singleton with a plain `openSettings()` rather than a screen or a class each
 * shell constructs, because three unrelated places open it and none of them should have
 * to be handed a callback for the privilege. The one thing it needs from the host — what
 * to put in the diagnostics dump — is registered once by `main.ts`.
 */

import { getSettings, updateSettings, type Settings } from './settings.js';
import { buildLabel } from './build.js';

let panel: HTMLElement | null = null;
let diagnostics: (() => string) | null = null;

/** The host says what a diagnostics copy contains. Without it the button is not shown. */
export function setDiagnosticsProvider(fn: () => string): void {
  diagnostics = fn;
}

export function settingsOpen(): boolean {
  return panel !== null;
}

export function closeSettings(): void {
  panel?.remove();
  panel = null;
  window.removeEventListener('keydown', onKey);
}

function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    e.stopPropagation();
    closeSettings();
  }
}

export function openSettings(): void {
  if (panel) return;
  const s = getSettings();
  panel = document.createElement('div');
  panel.className = 'settings';
  panel.setAttribute('role', 'dialog');
  panel.innerHTML = `
    <div class="settings__card">
      <div class="settings__title">Settings</div>

      <label class="settings__row">
        <span class="settings__label">Volume</span>
        <input class="settings__volume" type="range" min="0" max="100" step="5" value="${Math.round(s.volume * 100)}" />
        <span class="settings__value">${Math.round(s.volume * 100)}%</span>
      </label>

      <label class="settings__row settings__row--check">
        <input class="settings__muted" type="checkbox" ${s.muted ? 'checked' : ''} />
        <span class="settings__label">Mute all sound</span>
      </label>

      <label class="settings__row settings__row--check">
        <input class="settings__shake" type="checkbox" ${s.shake ? 'checked' : ''} />
        <span class="settings__label">Screen shake on blows and detonations</span>
      </label>

      <label class="settings__row settings__row--check">
        <input class="settings__fast" type="checkbox" ${s.speed === 'fast' ? 'checked' : ''} />
        <span class="settings__label">Fast playback of the enemy's turn <span class="settings__hint">(F in a fight)</span></span>
      </label>

      <p class="settings__note">
        Changes apply at once and are kept in this browser. Sound starts on your first click in a fight.
      </p>

      <div class="settings__actions">
        ${diagnostics ? '<button class="settings__copy" type="button">Copy diagnostics</button>' : ''}
        <button class="settings__close" type="button">Done</button>
      </div>
      <div class="settings__build">${buildLabel()}</div>
    </div>`;

  const q = <T extends HTMLElement>(sel: string): T => panel!.querySelector<T>(sel)!;
  const volume = q<HTMLInputElement>('.settings__volume');
  const value = q<HTMLElement>('.settings__value');
  volume.addEventListener('input', () => {
    const v = Number(volume.value) / 100;
    value.textContent = `${Math.round(v * 100)}%`;
    updateSettings({ volume: v });
  });
  const check = (sel: string, apply: (on: boolean) => Partial<Settings>): void => {
    const el = q<HTMLInputElement>(sel);
    el.addEventListener('change', () => updateSettings(apply(el.checked)));
  };
  check('.settings__muted', (on) => ({ muted: on }));
  check('.settings__shake', (on) => ({ shake: on }));
  check('.settings__fast', (on) => ({ speed: on ? 'fast' : 'normal' }));

  const copy = panel.querySelector<HTMLButtonElement>('.settings__copy');
  copy?.addEventListener('click', () => {
    const text = diagnostics?.() ?? '';
    const done = (): void => {
      copy.textContent = 'Copied';
      setTimeout(() => (copy.textContent = 'Copy diagnostics'), 1500);
    };
    // Same fallback as the crash panel: if the clipboard refuses, show the text to select.
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(done, () => showText(text));
    } else {
      showText(text);
    }
  });
  q('.settings__close').addEventListener('click', closeSettings);
  panel.addEventListener('click', (e) => {
    if (e.target === panel) closeSettings();
  });
  window.addEventListener('keydown', onKey);
  document.body.appendChild(panel);
}

function showText(text: string): void {
  if (!panel) return;
  let area = panel.querySelector<HTMLTextAreaElement>('.settings__dump');
  if (!area) {
    area = document.createElement('textarea');
    area.className = 'settings__dump';
    area.readOnly = true;
    panel.querySelector('.settings__actions')!.before(area);
  }
  area.value = text;
  area.select();
}
