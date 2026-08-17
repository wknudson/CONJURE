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
}
