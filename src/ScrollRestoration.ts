type ScrollPosition = { x: number; y: number };

const STORAGE_KEY = "reactolith-scroll-positions";

/**
 * Walk up from `root` to find the nearest ancestor with
 * `overflow-y: auto | scroll` (excluding body / html, which are
 * covered by `window` scroll).  Returns `null` when the document
 * itself is the scroll container.
 */
export function detectScrollContainer(
  root: Element,
  doc: Document,
): Element | null {
  const win = doc.defaultView;
  if (!win) return null;

  let el = root.parentElement;
  while (el && el !== doc.body && el !== doc.documentElement) {
    const { overflowY } = win.getComputedStyle(el);
    if (overflowY === "auto" || overflowY === "scroll") {
      return el;
    }
    el = el.parentElement;
  }
  return null;
}

export class ScrollRestoration {
  private positions = new Map<string, ScrollPosition>();
  private currentId: string;
  private readonly win: Window;
  private readonly scrollElement: Element | null;

  constructor(win: Window, scrollElement: Element | null = null) {
    this.win = win;
    this.scrollElement = scrollElement;

    // Disable browser-native scroll restoration
    if ("scrollRestoration" in win.history) {
      win.history.scrollRestoration = "manual";
    }

    // Initialise the current entry's restoration id
    this.currentId =
      win.history.state?.restorationId ?? this.generateId();
    win.history.replaceState(
      { ...win.history.state, restorationId: this.currentId },
      "",
    );

    // Hydrate positions from a previous page-load within the same tab
    this.hydrate();

    // Flush to sessionStorage before the tab/page closes
    win.addEventListener("beforeunload", () => this.persist());
  }

  /* ------------------------------------------------------------------ */
  /*  Public API (called by Router)                                      */
  /* ------------------------------------------------------------------ */

  /** Save the current scroll position for the *current* history entry. */
  save(): void {
    this.positions.set(this.currentId, this.getPosition());
  }

  /**
   * Advance to a new history entry.
   * Returns the state object that must be passed to `history.pushState`.
   */
  push(): Record<string, unknown> {
    this.currentId = this.generateId();
    return { restorationId: this.currentId };
  }

  /** Sync `currentId` with the entry the browser just navigated to (popstate). */
  pop(): void {
    this.currentId =
      this.win.history.state?.restorationId ?? this.currentId;
  }

  /**
   * Execute the appropriate scroll action after a navigation has rendered.
   *
   * Priority:
   * 1. Hash in URL → scroll to that element
   * 2. Pop navigation → restore saved position
   * 3. Push with `"preserve"` → do nothing
   * 4. Push (default) → scroll to top
   */
  scroll(
    isPush: boolean,
    behavior: "top" | "preserve" | undefined,
    url: string,
  ): void {
    // 1. Hash takes priority
    const hash = this.extractHash(url);
    if (hash) {
      const target = this.win.document.getElementById(hash);
      if (target) {
        target.scrollIntoView();
        return;
      }
    }

    // 2. Pop → restore
    if (!isPush) {
      const pos = this.positions.get(this.currentId);
      if (pos) {
        this.doScroll(pos.x, pos.y);
      }
      return;
    }

    // 3. Push with preserve → keep current position
    if (behavior === "preserve") return;

    // 4. Default push → top
    this.doScroll(0, 0);
  }

  /* ------------------------------------------------------------------ */
  /*  Private helpers                                                    */
  /* ------------------------------------------------------------------ */

  private generateId(): string {
    return Math.random().toString(36).slice(2);
  }

  private extractHash(url: string): string {
    const i = url.indexOf("#");
    return i === -1 ? "" : url.slice(i + 1);
  }

  private getPosition(): ScrollPosition {
    if (this.scrollElement) {
      return {
        x: this.scrollElement.scrollLeft,
        y: this.scrollElement.scrollTop,
      };
    }
    return { x: this.win.scrollX, y: this.win.scrollY };
  }

  private doScroll(x: number, y: number): void {
    if (this.scrollElement) {
      this.scrollElement.scrollTo(x, y);
    } else {
      this.win.scrollTo(x, y);
    }
  }

  private hydrate(): void {
    try {
      const raw = this.win.sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const entries: [string, ScrollPosition][] = JSON.parse(raw);
        for (const [key, pos] of entries) {
          this.positions.set(key, pos);
        }
      }
    } catch {
      // sessionStorage blocked or data corrupt – silently ignore
    }
  }

  private persist(): void {
    try {
      this.save(); // capture latest position before unload
      const entries = Array.from(this.positions.entries());
      this.win.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch {
      // sessionStorage blocked or full – silently ignore
    }
  }
}
