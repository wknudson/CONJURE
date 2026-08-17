/**
 * A single floating tooltip, shared by every element that wants one.
 *
 * Elements opt in by carrying a `data-tip` attribute (a glossary key) or by calling
 * `showAt` directly for board-space hovers. Keeping one node avoids the churn of
 * creating and destroying elements on every mouse move.
 */

import type { GlossaryEntry } from './glossary.js';
import { lookup } from './glossary.js';

export class Tooltip {
  private el: HTMLElement;
  private hideTimer: number | null = null;

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'tooltip';
    parent.appendChild(this.el);
  }

  /** Wires up delegated hover handling for any [data-tip] inside `root`. */
  attach(root: HTMLElement): void {
    root.addEventListener(
      'mouseover',
      (ev) => {
        const target = (ev.target as HTMLElement | null)?.closest<HTMLElement>('[data-tip]');
        if (!target) return;
        const entry = resolve(target.dataset.tip ?? '');
        if (!entry) return;
        this.show(entry, target);
      },
      true,
    );

    root.addEventListener(
      'mouseout',
      (ev) => {
        const target = (ev.target as HTMLElement | null)?.closest<HTMLElement>('[data-tip]');
        if (target) this.hide();
      },
      true,
    );
  }

  show(entry: GlossaryEntry, anchor: HTMLElement): void {
    if (this.hideTimer !== null) {
      window.clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }

    this.el.innerHTML = `
      <div class="tooltip__title">${escapeHtml(entry.title)}</div>
      <div class="tooltip__body">${escapeHtml(entry.body)}</div>
      ${entry.detail ? `<div class="tooltip__detail">${escapeHtml(entry.detail)}</div>` : ''}
    `;
    this.el.classList.add('is-shown');

    const rect = anchor.getBoundingClientRect();
    this.position(rect.left + rect.width / 2, rect.top);
  }

  /** Shows a tooltip anchored to an arbitrary screen point (used for board hovers). */
  showAt(entry: GlossaryEntry, x: number, y: number): void {
    if (this.hideTimer !== null) {
      window.clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
    this.el.innerHTML = `
      <div class="tooltip__title">${escapeHtml(entry.title)}</div>
      <div class="tooltip__body">${escapeHtml(entry.body)}</div>
      ${entry.detail ? `<div class="tooltip__detail">${escapeHtml(entry.detail)}</div>` : ''}
    `;
    this.el.classList.add('is-shown');
    this.position(x, y);
  }

  /** Shows arbitrary pre-built HTML (unit inspection cards). */
  showHtml(html: string, x: number, y: number): void {
    if (this.hideTimer !== null) {
      window.clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
    this.el.innerHTML = html;
    this.el.classList.add('is-shown');
    this.position(x, y);
  }

  private position(x: number, y: number): void {
    // Measure first, then clamp inside the viewport so nothing runs off an edge.
    const w = this.el.offsetWidth;
    const h = this.el.offsetHeight;
    const margin = 10;

    let left = x - w / 2;
    left = Math.max(margin, Math.min(left, window.innerWidth - w - margin));

    let top = y - h - 14;
    if (top < margin) top = y + 26; // flip below when there is no room above

    this.el.style.left = `${left}px`;
    this.el.style.top = `${top}px`;
  }

  hide(): void {
    this.el.classList.remove('is-shown');
  }

  destroy(): void {
    this.el.remove();
  }
}

function resolve(key: string): GlossaryEntry | undefined {
  // A raw "title|body" pair lets callers write one-off tips without a glossary entry.
  if (key.includes('|')) {
    const [title, body, detail] = key.split('|');
    return { title: title ?? '', body: body ?? '', ...(detail ? { detail } : {}) };
  }
  return lookup(key);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
