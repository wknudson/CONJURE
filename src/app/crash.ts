/**
 * The last screen: what the player sees when something throws that nothing caught.
 *
 * Before this there was nothing. `ScreenManager.go` empties the page before it mounts the
 * next screen, so a throw in any `mount` left a blank page with the stack in a console the
 * player never opens; a rejected promise from the animation pipeline left a board that no
 * longer agreed with the engine, silently. In both cases the report that came back was
 * "it went black", with no build, no screen and no error to go on.
 *
 * Now a panel comes up over whatever is left, says plainly that the game broke, and offers
 * two things: **copy a report** — build stamp, the error and its stack, the screen, the open
 * profile and its last fight — and **reload**. Nothing here touches the save; progress is
 * written as it happens, so a reload is safe.
 *
 * The panel is built with plain DOM and appended to `document.body`, not to the app root:
 * the app root is exactly what may be empty or half-torn-down when this runs. Only the first
 * crash raises the panel; later ones append to the same report, since an error cascade is
 * one incident to the person reading it.
 */

import { BUILD, buildLabel, type BuildStamp } from './build.js';

/** Whatever the host knows that a report should carry. Every field is optional. */
export interface CrashContext {
  /** A class name or label for the screen that was up. */
  screen?: string;
  /** The open save slot, if any. */
  profile?: string | null;
  /** The last fight the profile started — enough to find the exact game again. */
  lastRun?: { encounterId: string; seed: number; companionId: string } | undefined;
}

export interface CrashRecord {
  /** Where it came from: an uncaught throw, a rejected promise, or an explicit report. */
  source: 'error' | 'unhandledrejection' | 'report';
  message: string;
  stack?: string;
  /** Milliseconds since the page loaded. */
  at: number;
}

/** The plain-text report the button copies. Pure, so a test can read it. */
export function formatReport(
  build: BuildStamp,
  records: readonly CrashRecord[],
  context: CrashContext,
  env: { userAgent: string; viewport: string } = {
    userAgent: navigator.userAgent,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
  },
): string {
  const lines: string[] = [
    `CONJURE crash report — ${buildLabel(build)}`,
    `screen: ${context.screen ?? 'unknown'}`,
    `profile: ${context.profile ?? 'none'}`,
  ];
  if (context.lastRun) {
    const { encounterId, seed, companionId } = context.lastRun;
    lines.push(`last fight: ${encounterId} seed ${seed} with ${companionId}`);
  }
  lines.push(`browser: ${env.userAgent}`, `viewport: ${env.viewport}`, '');
  records.forEach((r, i) => {
    lines.push(`[${i + 1}] ${r.source} at +${(r.at / 1000).toFixed(1)}s: ${r.message}`);
    if (r.stack) lines.push(r.stack);
    lines.push('');
  });
  return lines.join('\n').trimEnd();
}

/** One line for a thrown value of any shape. */
export function describeThrown(value: unknown): { message: string; stack?: string } {
  if (value instanceof Error) {
    const cause = value.cause instanceof Error ? `\ncaused by: ${value.cause.stack ?? value.cause.message}` : '';
    return { message: value.message, stack: (value.stack ?? '') + cause };
  }
  if (typeof value === 'string') return { message: value };
  try {
    return { message: JSON.stringify(value) };
  } catch {
    return { message: String(value) };
  }
}

export interface CrashHandlers {
  /** Raise the panel for an error the caller caught itself. */
  report(value: unknown): void;
  /** What has been recorded, for a test or a debugger. */
  readonly records: readonly CrashRecord[];
}

/**
 * Installs the two global listeners and returns a handle for explicit reports.
 *
 * `context` is read when a crash happens, not when this is installed, so the host can pass a
 * closure over state it has not built yet.
 */
export function installCrashHandlers(
  context: () => CrashContext,
  build: BuildStamp = BUILD,
): CrashHandlers {
  const records: CrashRecord[] = [];
  let panel: HTMLElement | null = null;
  let report: HTMLTextAreaElement | null = null;

  const safeContext = (): CrashContext => {
    try {
      return context();
    } catch {
      return {};
    }
  };

  const refresh = (): void => {
    if (report) report.value = formatReport(build, records, safeContext());
  };

  const raise = (): void => {
    if (panel) {
      refresh();
      return;
    }
    panel = document.createElement('div');
    panel.className = 'crash';
    panel.setAttribute('role', 'alertdialog');
    panel.innerHTML = `
      <div class="crash__card">
        <div class="crash__title">Something in CONJURE broke</div>
        <p class="crash__body">
          The game hit an error it could not recover from. Your progress is saved as you play,
          so reloading is safe. If you can spare a moment, copy the report below and send it
          with a line about what you were doing.
        </p>
        <textarea class="crash__report" readonly spellcheck="false"></textarea>
        <div class="crash__actions">
          <button class="crash__copy" type="button">Copy report</button>
          <button class="crash__reload" type="button">Reload the game</button>
        </div>
        <div class="crash__build">${buildLabel(build)}</div>
      </div>`;
    report = panel.querySelector<HTMLTextAreaElement>('.crash__report');
    const copy = panel.querySelector<HTMLButtonElement>('.crash__copy')!;
    copy.addEventListener('click', () => {
      const text = report?.value ?? '';
      const done = (): void => {
        copy.textContent = 'Copied';
        setTimeout(() => (copy.textContent = 'Copy report'), 1500);
      };
      // The clipboard API needs a secure context and a gesture; both hold here, but if it
      // refuses, the text is selected so a plain Ctrl+C still works.
      const clip = navigator.clipboard;
      if (clip?.writeText) {
        clip.writeText(text).then(done, () => report?.select());
      } else {
        report?.select();
      }
    });
    panel.querySelector('.crash__reload')!.addEventListener('click', () => location.reload());
    document.body.appendChild(panel);
    refresh();
  };

  const record = (source: CrashRecord['source'], value: unknown): void => {
    const { message, stack } = describeThrown(value);
    records.push({ source, message, stack, at: performance.now() });
    try {
      raise();
    } catch {
      // The panel itself failing must not recurse into the error handler.
    }
  };

  window.addEventListener('error', (e) => record('error', e.error ?? e.message));
  window.addEventListener('unhandledrejection', (e) => record('unhandledrejection', e.reason));

  return {
    report: (value) => record('report', value),
    records,
  };
}
