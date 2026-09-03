/**
 * A plain DOM screen swapper. No router, no framework — three screens do not need one.
 */

export interface Screen {
  mount(root: HTMLElement): void;
  unmount(): void;
}

export class ScreenManager {
  private current: Screen | null = null;

  constructor(private readonly root: HTMLElement) {}

  go(screen: Screen): void {
    this.current?.unmount();
    this.root.replaceChildren();
    this.root.classList.remove('is-fading-in');
    void this.root.offsetWidth;
    this.root.classList.add('is-fading-in');
    this.current = screen;
    screen.mount(this.root);
  }

  /**
   * Tears the current screen down without putting another up.
   *
   * For the caller that has to change state *between* two screens: leaving a character for
   * the title wall closes the profile, and the district writes the hour and the player's
   * position back to that profile as it unmounts. Closing first, then clearing, then going
   * to the wall is the only order in which nothing writes to a profile that is no longer
   * open.
   */
  close(): void {
    this.current?.unmount();
    this.current = null;
    this.root.replaceChildren();
  }
}
