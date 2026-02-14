import { screen, waitFor, fireEvent } from "@testing-library/dom";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { App } from "../src";
import { ReactNode, act } from "react";
import { useRouter } from "../src/provider/RouterProvider";

function testComponent({ is, children }: { is: string; children: ReactNode }) {
  const { loading } = useRouter();
  return (
    <pre data-is={is} data-loading={loading}>
      {children}
    </pre>
  );
}

const createFetchMock = (html: string) =>
  vi.fn(() =>
    Promise.resolve({
      ok: true,
      redirected: false,
      url: "/api/data",
      text: () => Promise.resolve(html),
    }),
  );

const responseHtml = `<div id="reactolith-app" data-testid="reactolith-app">
  <my-component>Bar</my-component>
  <a href="/page">Link</a>
</div>`;

describe("Router scroll restoration", () => {
  let scrollToSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    history.replaceState(null, "");
    scrollToSpy = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  });

  afterEach(() => {
    scrollToSpy.mockRestore();
    document.body.innerHTML = "";
  });

  it("scrolls to top after forward navigation (navigate)", async () => {
    document.body.innerHTML = `<div id="reactolith-app" data-testid="reactolith-app">
      <my-component>Foo</my-component>
    </div>`;

    const fetchMock = createFetchMock(responseHtml);
    global.fetch = fetchMock as any;

    const app = new App(testComponent);
    await act(async () => {});

    await app.router.navigate("/page");

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
      expect(scrollToSpy).toHaveBeenCalledWith(0, 0);
    });
  });

  it("scrolls to top after forward navigation (link click)", async () => {
    document.body.innerHTML = `<div id="reactolith-app" data-testid="reactolith-app">
      <my-component>Foo</my-component>
      <a href="/page">Link</a>
    </div>`;

    const fetchMock = createFetchMock(responseHtml);
    global.fetch = fetchMock as any;

    const app = new App(testComponent);
    await act(async () => {});

    const root = await screen.findByTestId("reactolith-app");
    await waitFor(() => {
      expect(root.querySelector("pre")).not.toBeNull();
    });

    // Use the same reliable pattern as Router.links.test.tsx
    const link = root.querySelector("a")!;
    const clickEvent = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      button: 0,
    });
    Object.defineProperty(clickEvent, "target", { value: link });
    await app.router.onClick(clickEvent);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
      expect(scrollToSpy).toHaveBeenCalledWith(0, 0);
    });
  });

  it("does not scroll to top when link has data-scroll='preserve'", async () => {
    document.body.innerHTML = `<div id="reactolith-app" data-testid="reactolith-app">
      <my-component>Foo</my-component>
      <a href="/page" data-scroll="preserve">Link</a>
    </div>`;

    const fetchMock = createFetchMock(responseHtml);
    global.fetch = fetchMock as any;

    const app = new App(testComponent);
    await act(async () => {});

    const root = await screen.findByTestId("reactolith-app");
    await waitFor(() => {
      expect(root.querySelector("pre")).not.toBeNull();
    });

    const link = root.querySelector("a")!;
    const clickEvent = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      button: 0,
    });
    Object.defineProperty(clickEvent, "target", { value: link });
    await app.router.onClick(clickEvent);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });

    // scrollTo should not be called for "preserve"
    expect(scrollToSpy).not.toHaveBeenCalled();
  });

  it("does not scroll to top when form has data-scroll='preserve'", async () => {
    document.body.innerHTML = `<div id="reactolith-app" data-testid="reactolith-app">
      <my-component>Foo</my-component>
      <form action="/search" method="GET" data-scroll="preserve">
        <input type="text" name="q" default-value="test" read-only />
        <button type="submit">Go</button>
      </form>
    </div>`;

    const fetchMock = createFetchMock(responseHtml);
    global.fetch = fetchMock as any;

    const app = new App(testComponent);
    await act(async () => {});

    const root = await screen.findByTestId("reactolith-app");
    await waitFor(() => {
      expect(root.querySelector("pre")).not.toBeNull();
    });

    const form = root.querySelector("form")!;
    const submitEvent = new Event("submit", {
      bubbles: true,
      cancelable: true,
    }) as SubmitEvent;
    Object.defineProperty(submitEvent, "target", { value: form });
    Object.defineProperty(submitEvent, "submitter", { value: null });
    await app.router.onSubmit(submitEvent);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });

    expect(scrollToSpy).not.toHaveBeenCalled();
  });

  it("navigate with { scroll: 'preserve' } does not scroll", async () => {
    document.body.innerHTML = `<div id="reactolith-app" data-testid="reactolith-app">
      <my-component>Foo</my-component>
    </div>`;

    const fetchMock = createFetchMock(responseHtml);
    global.fetch = fetchMock as any;

    const app = new App(testComponent);
    await act(async () => {});

    await app.router.navigate("/page", { scroll: "preserve" });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });

    expect(scrollToSpy).not.toHaveBeenCalled();
  });

  it("stores restorationId in history.state on push", async () => {
    document.body.innerHTML = `<div id="reactolith-app" data-testid="reactolith-app">
      <my-component>Foo</my-component>
    </div>`;

    const fetchMock = createFetchMock(responseHtml);
    global.fetch = fetchMock as any;

    const app = new App(testComponent);
    await act(async () => {});

    // Initial entry should have a restorationId (set by ScrollRestoration constructor)
    expect(history.state).toHaveProperty("restorationId");
    const initialId = history.state.restorationId;

    await app.router.navigate("/page");

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });

    // After navigation, history.state should have a new restorationId
    expect(history.state).toHaveProperty("restorationId");
    expect(history.state.restorationId).not.toBe(initialId);
  });

  it("restores scroll position on pop navigation (back)", async () => {
    document.body.innerHTML = `<div id="reactolith-app" data-testid="reactolith-app">
      <my-component>Foo</my-component>
    </div>`;

    const fetchMock = createFetchMock(responseHtml);
    global.fetch = fetchMock as any;

    const app = new App(testComponent);
    await act(async () => {});

    // Simulate scroll position on initial page
    Object.defineProperty(window, "scrollX", {
      value: 0,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(window, "scrollY", {
      value: 500,
      writable: true,
      configurable: true,
    });

    const initialId = history.state.restorationId;

    // Navigate forward (push)
    await app.router.navigate("/page");

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });

    scrollToSpy.mockClear();

    // Simulate pop (back): visit with pushState=false and the old restorationId
    history.replaceState({ restorationId: initialId }, "");
    await app.router.visit("/original", { method: "GET" }, false);

    await waitFor(() => {
      expect(scrollToSpy).toHaveBeenCalledWith(0, 500);
    });
  });

  it("scrolls to hash element when URL contains #fragment", async () => {
    document.body.innerHTML = `<div id="reactolith-app" data-testid="reactolith-app">
      <my-component>Foo</my-component>
    </div>`;

    // First set up a target element in the document
    const target = document.createElement("div");
    target.id = "target";
    document.body.appendChild(target);
    const scrollIntoViewSpy = vi.fn();
    target.scrollIntoView = scrollIntoViewSpy;

    const fetchMock = createFetchMock(responseHtml);
    global.fetch = fetchMock as any;

    const app = new App(testComponent);
    await act(async () => {});

    // Navigate to a URL with hash - test via visit() directly
    await app.router.visit("/page#target", { method: "GET" }, true);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });

    // Hash element scroll takes priority over scroll-to-top
    expect(scrollIntoViewSpy).toHaveBeenCalled();
    expect(scrollToSpy).not.toHaveBeenCalled();
  });

  it("falls back to scroll-to-top when hash element is not found", async () => {
    document.body.innerHTML = `<div id="reactolith-app" data-testid="reactolith-app">
      <my-component>Foo</my-component>
    </div>`;

    const fetchMock = createFetchMock(responseHtml);
    global.fetch = fetchMock as any;

    const app = new App(testComponent);
    await act(async () => {});

    await app.router.visit("/page#nonexistent", { method: "GET" }, true);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
      expect(scrollToSpy).toHaveBeenCalledWith(0, 0);
    });
  });

  it("does not scroll when render fails", async () => {
    document.body.innerHTML = `<div id="reactolith-app" data-testid="reactolith-app">
      <my-component>Foo</my-component>
    </div>`;

    // Return HTML without reactolith-app → render fails
    const fetchMock = createFetchMock(`<div id="other">Bar</div>`);
    global.fetch = fetchMock as any;

    const app = new App(testComponent);
    await act(async () => {});

    scrollToSpy.mockClear();

    await app.router.visit("/page", { method: "GET" }, true);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });

    // No scrolling should happen on failed render
    expect(scrollToSpy).not.toHaveBeenCalled();
  });

  it("uses data-scroll-container for explicit scroll container", async () => {
    const scrollDiv = document.createElement("div");
    scrollDiv.id = "main-scroll";
    scrollDiv.style.overflowY = "auto";
    scrollDiv.style.height = "100vh";
    document.body.appendChild(scrollDiv);

    scrollDiv.innerHTML = `<div id="reactolith-app" data-testid="reactolith-app"
      data-scroll-container="#main-scroll">
      <my-component>Foo</my-component>
    </div>`;

    const fetchMock = createFetchMock(
      `<div id="reactolith-app" data-testid="reactolith-app"
        data-scroll-container="#main-scroll">
        <my-component>Bar</my-component>
      </div>`,
    );
    global.fetch = fetchMock as any;

    const scrollElSpy = vi.fn();
    scrollDiv.scrollTo = scrollElSpy;

    const app = new App(testComponent);
    await act(async () => {});

    await app.router.navigate("/page");

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
      expect(scrollElSpy).toHaveBeenCalledWith(0, 0);
    });

    // window.scrollTo should NOT have been called
    expect(scrollToSpy).not.toHaveBeenCalled();
  });

  it("auto-detects scroll container from DOM", async () => {
    const scrollDiv = document.createElement("div");
    scrollDiv.id = "auto-scroller";
    scrollDiv.style.overflowY = "auto";
    scrollDiv.style.height = "100vh";
    document.body.appendChild(scrollDiv);

    scrollDiv.innerHTML = `<div id="reactolith-app" data-testid="reactolith-app">
      <my-component>Foo</my-component>
    </div>`;

    const fetchMock = createFetchMock(responseHtml);
    global.fetch = fetchMock as any;

    const scrollElSpy = vi.fn();
    scrollDiv.scrollTo = scrollElSpy;

    const app = new App(testComponent);
    await act(async () => {});

    await app.router.navigate("/page");

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
      expect(scrollElSpy).toHaveBeenCalledWith(0, 0);
    });

    expect(scrollToSpy).not.toHaveBeenCalled();
  });

  it("saves scroll position before navigation begins", async () => {
    document.body.innerHTML = `<div id="reactolith-app" data-testid="reactolith-app">
      <my-component>Foo</my-component>
    </div>`;

    const fetchMock = createFetchMock(responseHtml);
    global.fetch = fetchMock as any;

    const app = new App(testComponent);
    await act(async () => {});

    Object.defineProperty(window, "scrollX", {
      value: 0,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(window, "scrollY", {
      value: 777,
      writable: true,
      configurable: true,
    });

    const savedId = history.state.restorationId;

    // Push navigation
    await app.router.navigate("/page");

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });

    scrollToSpy.mockClear();

    // Simulate back navigation - position should be restored
    history.replaceState({ restorationId: savedId }, "");
    await app.router.visit("/original", { method: "GET" }, false);

    await waitFor(() => {
      expect(scrollToSpy).toHaveBeenCalledWith(0, 777);
    });
  });

  it("visit with explicit scroll='top' scrolls to top", async () => {
    document.body.innerHTML = `<div id="reactolith-app" data-testid="reactolith-app">
      <my-component>Foo</my-component>
    </div>`;

    const fetchMock = createFetchMock(responseHtml);
    global.fetch = fetchMock as any;

    const app = new App(testComponent);
    await act(async () => {});

    await app.router.visit("/page", { method: "GET" }, true, "top");

    await waitFor(() => {
      expect(scrollToSpy).toHaveBeenCalledWith(0, 0);
    });
  });
});
