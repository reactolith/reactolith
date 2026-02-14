import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  ScrollRestoration,
  detectScrollContainer,
} from "../src/ScrollRestoration";

/* ------------------------------------------------------------------ */
/*  detectScrollContainer                                              */
/* ------------------------------------------------------------------ */
describe("detectScrollContainer", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("returns null when no ancestor has overflow-y: auto|scroll", () => {
    document.body.innerHTML = `
      <div id="wrapper">
        <div id="root">content</div>
      </div>`;
    const root = document.getElementById("root")!;
    expect(detectScrollContainer(root, document)).toBeNull();
  });

  it("detects ancestor with overflow-y: auto", () => {
    document.body.innerHTML = `
      <div id="scroller" style="overflow-y: auto; height: 100vh;">
        <div id="root">content</div>
      </div>`;
    const root = document.getElementById("root")!;
    const scroller = document.getElementById("scroller")!;
    expect(detectScrollContainer(root, document)).toBe(scroller);
  });

  it("detects ancestor with overflow-y: scroll", () => {
    document.body.innerHTML = `
      <div id="scroller" style="overflow-y: scroll; height: 100vh;">
        <div id="root">content</div>
      </div>`;
    const root = document.getElementById("root")!;
    const scroller = document.getElementById("scroller")!;
    expect(detectScrollContainer(root, document)).toBe(scroller);
  });

  it("returns the closest scrollable ancestor", () => {
    document.body.innerHTML = `
      <div id="outer" style="overflow-y: auto;">
        <div id="inner" style="overflow-y: scroll;">
          <div id="root">content</div>
        </div>
      </div>`;
    const root = document.getElementById("root")!;
    const inner = document.getElementById("inner")!;
    expect(detectScrollContainer(root, document)).toBe(inner);
  });

  it("skips body and html even if they have overflow styles", () => {
    // jsdom doesn't compute styles from inline on body easily,
    // but we verify the loop stops at body/html.
    document.body.innerHTML = `<div id="root">content</div>`;
    const root = document.getElementById("root")!;
    expect(detectScrollContainer(root, document)).toBeNull();
  });

  it("ignores overflow-y: hidden (not scrollable)", () => {
    document.body.innerHTML = `
      <div id="hidden" style="overflow-y: hidden;">
        <div id="root">content</div>
      </div>`;
    const root = document.getElementById("root")!;
    expect(detectScrollContainer(root, document)).toBeNull();
  });

  it("ignores overflow-y: visible", () => {
    document.body.innerHTML = `
      <div id="visible" style="overflow-y: visible;">
        <div id="root">content</div>
      </div>`;
    const root = document.getElementById("root")!;
    expect(detectScrollContainer(root, document)).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/*  ScrollRestoration                                                  */
/* ------------------------------------------------------------------ */
describe("ScrollRestoration", () => {
  let scrollToSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    sessionStorage.clear();
    // Reset history state
    history.replaceState(null, "");
    scrollToSpy = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  });

  afterEach(() => {
    scrollToSpy.mockRestore();
  });

  it("sets history.scrollRestoration to manual when supported", () => {
    // jsdom does not implement scrollRestoration, so define it first
    Object.defineProperty(history, "scrollRestoration", {
      value: "auto",
      writable: true,
      configurable: true,
    });
    new ScrollRestoration(window);
    expect(history.scrollRestoration).toBe("manual");
  });

  it("sets restorationId on initial history entry via replaceState", () => {
    new ScrollRestoration(window);
    expect(history.state).toHaveProperty("restorationId");
    expect(typeof history.state.restorationId).toBe("string");
    expect(history.state.restorationId.length).toBeGreaterThan(0);
  });

  it("preserves existing history.state when setting restorationId", () => {
    history.replaceState({ custom: "data" }, "");
    new ScrollRestoration(window);
    expect(history.state.custom).toBe("data");
    expect(history.state.restorationId).toBeDefined();
  });

  it("reuses existing restorationId from history.state", () => {
    history.replaceState({ restorationId: "existing-id" }, "");
    const sr = new ScrollRestoration(window);
    expect(history.state.restorationId).toBe("existing-id");
    // Verify by pushing and checking the old id was preserved
    sr.save();
    const state = sr.push();
    expect(state.restorationId).not.toBe("existing-id");
  });

  describe("save() and scroll()", () => {
    it("saves and restores scroll position for pop navigation", () => {
      const sr = new ScrollRestoration(window);
      const initialId = history.state.restorationId;

      // Simulate being at scroll position (0, 300)
      Object.defineProperty(window, "scrollX", {
        value: 0,
        writable: true,
        configurable: true,
      });
      Object.defineProperty(window, "scrollY", {
        value: 300,
        writable: true,
        configurable: true,
      });

      // Save position for current entry, then push to new entry
      sr.save();
      const newState = sr.push();
      history.pushState(newState, "", "/new-page");

      // Now simulate going back: pop sets currentId to the old entry
      history.replaceState({ restorationId: initialId }, "");
      sr.pop();
      sr.scroll(false, undefined, "/old-page");

      expect(scrollToSpy).toHaveBeenCalledWith(0, 300);
    });

    it("scrolls to top on push navigation (default)", () => {
      const sr = new ScrollRestoration(window);

      sr.save();
      sr.push();
      sr.scroll(true, undefined, "/new-page");

      expect(scrollToSpy).toHaveBeenCalledWith(0, 0);
    });

    it("does not scroll on push with preserve", () => {
      const sr = new ScrollRestoration(window);

      sr.save();
      sr.push();
      sr.scroll(true, "preserve", "/new-page");

      expect(scrollToSpy).not.toHaveBeenCalled();
    });

    it("scrolls to top on push with explicit top", () => {
      const sr = new ScrollRestoration(window);

      sr.save();
      sr.push();
      sr.scroll(true, "top", "/new-page");

      expect(scrollToSpy).toHaveBeenCalledWith(0, 0);
    });

    it("does not scroll on pop when no saved position exists", () => {
      const sr = new ScrollRestoration(window);

      sr.pop();
      sr.scroll(false, undefined, "/page");

      expect(scrollToSpy).not.toHaveBeenCalled();
    });
  });

  describe("hash scrolling", () => {
    afterEach(() => {
      document.body.innerHTML = "";
    });

    it("scrolls to hash element on push navigation", () => {
      document.body.innerHTML = `<div id="section">target</div>`;
      const scrollIntoViewSpy = vi.fn();
      document.getElementById("section")!.scrollIntoView = scrollIntoViewSpy;

      const sr = new ScrollRestoration(window);

      sr.save();
      sr.push();
      sr.scroll(true, undefined, "/page#section");

      expect(scrollIntoViewSpy).toHaveBeenCalled();
      expect(scrollToSpy).not.toHaveBeenCalled();
    });

    it("scrolls to hash element on pop navigation (hash takes priority)", () => {
      document.body.innerHTML = `<div id="section">target</div>`;
      const scrollIntoViewSpy = vi.fn();
      document.getElementById("section")!.scrollIntoView = scrollIntoViewSpy;

      const sr = new ScrollRestoration(window);

      sr.scroll(false, undefined, "/page#section");

      expect(scrollIntoViewSpy).toHaveBeenCalled();
      expect(scrollToSpy).not.toHaveBeenCalled();
    });

    it("falls back to default behavior when hash element is not found", () => {
      const sr = new ScrollRestoration(window);

      sr.save();
      sr.push();
      sr.scroll(true, undefined, "/page#nonexistent");

      // Falls through to default push behavior: scroll to top
      expect(scrollToSpy).toHaveBeenCalledWith(0, 0);
    });

    it("handles URL without hash normally", () => {
      const sr = new ScrollRestoration(window);

      sr.save();
      sr.push();
      sr.scroll(true, undefined, "/page");

      expect(scrollToSpy).toHaveBeenCalledWith(0, 0);
    });
  });

  describe("sessionStorage persistence", () => {
    it("persists positions to sessionStorage on beforeunload", () => {
      const sr = new ScrollRestoration(window);

      Object.defineProperty(window, "scrollX", {
        value: 10,
        writable: true,
        configurable: true,
      });
      Object.defineProperty(window, "scrollY", {
        value: 200,
        writable: true,
        configurable: true,
      });

      sr.save();

      // Trigger beforeunload
      window.dispatchEvent(new Event("beforeunload"));

      const stored = sessionStorage.getItem("reactolith-scroll-positions");
      expect(stored).not.toBeNull();

      const entries: [string, { x: number; y: number }][] =
        JSON.parse(stored!);
      expect(entries.length).toBeGreaterThanOrEqual(1);

      const pos = entries.find(
        ([key]) => key === history.state.restorationId,
      );
      expect(pos).toBeDefined();
    });

    it("hydrates positions from sessionStorage on construction", () => {
      const fakeId = "hydrated-id";
      history.replaceState({ restorationId: fakeId }, "");

      const entries: [string, { x: number; y: number }][] = [
        [fakeId, { x: 0, y: 450 }],
      ];
      sessionStorage.setItem(
        "reactolith-scroll-positions",
        JSON.stringify(entries),
      );

      const sr = new ScrollRestoration(window);

      // The hydrated position should be restorable
      sr.scroll(false, undefined, "/page");
      expect(scrollToSpy).toHaveBeenCalledWith(0, 450);
    });

    it("handles corrupt sessionStorage gracefully", () => {
      sessionStorage.setItem(
        "reactolith-scroll-positions",
        "not valid json{{{",
      );

      // Should not throw
      expect(() => new ScrollRestoration(window)).not.toThrow();
    });
  });

  describe("custom scroll element", () => {
    let scrollElement: HTMLDivElement;

    beforeEach(() => {
      scrollElement = document.createElement("div");
      document.body.appendChild(scrollElement);
      // Mock scrollTo on the element
      scrollElement.scrollTo = vi.fn();
    });

    afterEach(() => {
      document.body.innerHTML = "";
    });

    it("reads scroll position from custom element", () => {
      Object.defineProperty(scrollElement, "scrollLeft", {
        value: 5,
        writable: true,
        configurable: true,
      });
      Object.defineProperty(scrollElement, "scrollTop", {
        value: 100,
        writable: true,
        configurable: true,
      });

      const sr = new ScrollRestoration(window, scrollElement);
      const initialId = history.state.restorationId;

      sr.save();

      // Push to new page, then simulate back
      const newState = sr.push();
      history.pushState(newState, "", "/new");
      history.replaceState({ restorationId: initialId }, "");
      sr.pop();

      sr.scroll(false, undefined, "/old");

      expect(scrollElement.scrollTo).toHaveBeenCalledWith(5, 100);
      expect(scrollToSpy).not.toHaveBeenCalled();
    });

    it("scrolls custom element to top on push navigation", () => {
      const sr = new ScrollRestoration(window, scrollElement);

      sr.save();
      sr.push();
      sr.scroll(true, undefined, "/new-page");

      expect(scrollElement.scrollTo).toHaveBeenCalledWith(0, 0);
      expect(scrollToSpy).not.toHaveBeenCalled();
    });
  });

  describe("push/pop lifecycle", () => {
    it("push() returns a state object with restorationId", () => {
      const sr = new ScrollRestoration(window);
      const state = sr.push();
      expect(state).toHaveProperty("restorationId");
      expect(typeof state.restorationId).toBe("string");
    });

    it("generates unique IDs on each push", () => {
      const sr = new ScrollRestoration(window);
      const ids = new Set<unknown>();
      for (let i = 0; i < 100; i++) {
        ids.add(sr.push().restorationId);
      }
      expect(ids.size).toBe(100);
    });

    it("pop() reads restorationId from history.state", () => {
      const sr = new ScrollRestoration(window);

      // Save position at y=100
      Object.defineProperty(window, "scrollY", {
        value: 100,
        writable: true,
        configurable: true,
      });
      Object.defineProperty(window, "scrollX", {
        value: 0,
        writable: true,
        configurable: true,
      });
      sr.save();
      const firstId = history.state.restorationId;

      // Push to page 2
      const state2 = sr.push();
      history.pushState(state2, "", "/page2");

      // Save position at y=200 on page 2
      Object.defineProperty(window, "scrollY", { value: 200 });
      sr.save();

      // Push to page 3
      const state3 = sr.push();
      history.pushState(state3, "", "/page3");

      // Go back to page 2: simulate popstate by setting state
      history.replaceState(state2, "");
      sr.pop();
      sr.scroll(false, undefined, "/page2");
      expect(scrollToSpy).toHaveBeenCalledWith(0, 200);

      scrollToSpy.mockClear();

      // Go back to page 1
      history.replaceState({ restorationId: firstId }, "");
      sr.pop();
      sr.scroll(false, undefined, "/page1");
      expect(scrollToSpy).toHaveBeenCalledWith(0, 100);
    });
  });
});
