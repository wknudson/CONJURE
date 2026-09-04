/**
 * What a browser without WebGL is told, instead of nothing.
 *
 * The district is drawn with three.js and is the mandatory way into the game, and
 * `new THREE.WebGLRenderer` throws when a context cannot be had — a blocklisted driver, a
 * virtual machine, hardware acceleration switched off, a locked-down browser. Before this
 * that throw left a blank page. The 2D board would have run fine for those players; they
 * never reached it.
 *
 * Two halves: a cheap probe the host runs before it builds the district, and a plain screen
 * that says what is missing and what to try. Plain on purpose — it must render where nothing
 * else could.
 */

import { buildLabel } from './build.js';

/** Whether this browser can hand out a WebGL context right now. */
export function webglAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    if (!gl) return false;
    // Give the context straight back; the district will want its own.
    (gl as WebGLRenderingContext).getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

/**
 * Renders the message into `root`, replacing whatever is there.
 *
 * `detail` is the renderer's own error when the probe passed but the renderer still failed,
 * which does happen — a context can exist and still be refused for the size or the
 * attributes asked for.
 */
export function renderUnsupported(root: HTMLElement, detail?: string, onRetry?: () => void): void {
  root.replaceChildren();
  const el = document.createElement('div');
  el.className = 'screen screen--unsupported';
  el.innerHTML = `
    <div class="unsupported__card">
      <div class="unsupported__title">CONJURE needs WebGL to draw the city</div>
      <p class="unsupported__body">
        This browser could not open a 3D drawing context, so the streets cannot be shown.
        Nothing is wrong with your save.
      </p>
      <ul class="unsupported__list">
        <li>Turn on hardware acceleration in the browser's settings, then reload.</li>
        <li>Update the graphics driver, or try a current Chrome, Edge or Firefox.</li>
        <li>If this is a virtual machine or a remote desktop, try a local browser.</li>
      </ul>
      ${detail ? `<pre class="unsupported__detail">${escape(detail)}</pre>` : ''}
      <div class="unsupported__actions">
        <button class="unsupported__retry" type="button">Try again</button>
      </div>
      <div class="unsupported__build">${buildLabel()}</div>
    </div>`;
  el.querySelector('.unsupported__retry')!.addEventListener('click', () => {
    if (onRetry) onRetry();
    else location.reload();
  });
  root.appendChild(el);
}

function escape(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] ?? c);
}
