import { screen, waitFor, fireEvent } from "@testing-library/dom";
import { vi, describe, it, expect, beforeEach } from "vitest";
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

describe("Router link handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ignores links with target=_blank", async () => {
    document.body.innerHTML = `<div id="htx-app" data-testid="htx-app">
      <my-component>Foo</my-component>
      <a href="/page" target="_blank">Link</a>
    </div>`;

    const fetchMock = createFetchMock(`<div id="htx-app">
      <my-component>Bar</my-component>
    </div>`);
    global.fetch = fetchMock as any;

    new App(testComponent);

    await act(async () => {});

    const root = await screen.findByTestId("htx-app");
    await waitFor(() => {
      expect(root.querySelector("pre")).not.toBeNull();
    });

    const link = root.querySelector("a")!;
    fireEvent.click(link);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("ignores links with download attribute", async () => {
    document.body.innerHTML = `<div id="htx-app" data-testid="htx-app">
      <my-component>Foo</my-component>
      <a href="/file.pdf" download>Download</a>
    </div>`;

    const fetchMock = createFetchMock(`<div id="htx-app">
      <my-component>Bar</my-component>
    </div>`);
    global.fetch = fetchMock as any;

    new App(testComponent);

    await act(async () => {});

    const root = await screen.findByTestId("htx-app");
    await waitFor(() => {
      expect(root.querySelector("pre")).not.toBeNull();
    });

    const link = root.querySelector("a")!;
    fireEvent.click(link);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("ignores links with rel=external", async () => {
    document.body.innerHTML = `<div id="htx-app" data-testid="htx-app">
      <my-component>Foo</my-component>
      <a href="/page" rel="external">External</a>
    </div>`;

    const fetchMock = createFetchMock(`<div id="htx-app">
      <my-component>Bar</my-component>
    </div>`);
    global.fetch = fetchMock as any;

    const app = new App(testComponent);

    await act(async () => {});

    const root = await screen.findByTestId("htx-app");
    await waitFor(() => {
      expect(root.querySelector("pre")).not.toBeNull();
    });

    const link = root.querySelector("a")!;
    // Create click event with the link as target
    const clickEvent = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
    Object.defineProperty(clickEvent, "target", { value: link });
    await app.router.onClick(clickEvent);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("ignores absolute URLs", async () => {
    document.body.innerHTML = `<div id="htx-app" data-testid="htx-app">
      <my-component>Foo</my-component>
      <a href="https://example.com">External</a>
    </div>`;

    const fetchMock = createFetchMock(`<div id="htx-app">
      <my-component>Bar</my-component>
    </div>`);
    global.fetch = fetchMock as any;

    const app = new App(testComponent);

    await act(async () => {});

    const root = await screen.findByTestId("htx-app");
    await waitFor(() => {
      expect(root.querySelector("pre")).not.toBeNull();
    });

    const link = root.querySelector("a")!;
    // Create click event with the link as target
    const clickEvent = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
    Object.defineProperty(clickEvent, "target", { value: link });
    await app.router.onClick(clickEvent);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("ignores hash links", async () => {
    document.body.innerHTML = `<div id="htx-app" data-testid="htx-app">
      <my-component>Foo</my-component>
      <a href="#section">Jump</a>
    </div>`;

    const fetchMock = createFetchMock(`<div id="htx-app">
      <my-component>Bar</my-component>
    </div>`);
    global.fetch = fetchMock as any;

    const app = new App(testComponent);

    await act(async () => {});

    const root = await screen.findByTestId("htx-app");
    await waitFor(() => {
      expect(root.querySelector("pre")).not.toBeNull();
    });

    const link = root.querySelector("a")!;
    // Create click event with the link as target
    const clickEvent = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
    Object.defineProperty(clickEvent, "target", { value: link });
    await app.router.onClick(clickEvent);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("ignores clicks with modifier keys", async () => {
    document.body.innerHTML = `<div id="htx-app" data-testid="htx-app">
      <my-component>Foo</my-component>
      <a href="/page">Link</a>
    </div>`;

    const fetchMock = createFetchMock(`<div id="htx-app">
      <my-component>Bar</my-component>
    </div>`);
    global.fetch = fetchMock as any;

    const app = new App(testComponent);

    await act(async () => {});

    const root = await screen.findByTestId("htx-app");
    await waitFor(() => {
      expect(root.querySelector("pre")).not.toBeNull();
    });

    const link = root.querySelector("a")!;

    // Test with Ctrl key
    const ctrlEvent = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, ctrlKey: true });
    Object.defineProperty(ctrlEvent, "target", { value: link });
    await app.router.onClick(ctrlEvent);
    expect(fetchMock).not.toHaveBeenCalled();

    // Test with Meta key (Cmd on Mac)
    const metaEvent = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, metaKey: true });
    Object.defineProperty(metaEvent, "target", { value: link });
    await app.router.onClick(metaEvent);
    expect(fetchMock).not.toHaveBeenCalled();

    // Test with Shift key
    const shiftEvent = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, shiftKey: true });
    Object.defineProperty(shiftEvent, "target", { value: link });
    await app.router.onClick(shiftEvent);
    expect(fetchMock).not.toHaveBeenCalled();

    // Test with Alt key
    const altEvent = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, altKey: true });
    Object.defineProperty(altEvent, "target", { value: link });
    await app.router.onClick(altEvent);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("ignores middle and right clicks", async () => {
    document.body.innerHTML = `<div id="htx-app" data-testid="htx-app">
      <my-component>Foo</my-component>
      <a href="/page">Link</a>
    </div>`;

    const fetchMock = createFetchMock(`<div id="htx-app">
      <my-component>Bar</my-component>
    </div>`);
    global.fetch = fetchMock as any;

    const app = new App(testComponent);

    await act(async () => {});

    const root = await screen.findByTestId("htx-app");
    await waitFor(() => {
      expect(root.querySelector("pre")).not.toBeNull();
    });

    const link = root.querySelector("a")!;

    // Test middle click
    const middleEvent = new MouseEvent("click", { bubbles: true, cancelable: true, button: 1 });
    Object.defineProperty(middleEvent, "target", { value: link });
    await app.router.onClick(middleEvent);
    expect(fetchMock).not.toHaveBeenCalled();

    // Test right click
    const rightEvent = new MouseEvent("click", { bubbles: true, cancelable: true, button: 2 });
    Object.defineProperty(rightEvent, "target", { value: link });
    await app.router.onClick(rightEvent);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("handles nested elements inside links", async () => {
    document.body.innerHTML = `<div id="htx-app" data-testid="htx-app">
      <my-component>Foo</my-component>
      <a href="/page"><span data-testid="inner">Click me</span></a>
    </div>`;

    const fetchMock = createFetchMock(`<div id="htx-app" data-testid="htx-app">
      <my-component>Bar</my-component>
    </div>`);
    global.fetch = fetchMock as any;

    const app = new App(testComponent);

    await act(async () => {});

    const root = await screen.findByTestId("htx-app");
    await waitFor(() => {
      expect(root.querySelector("pre")).not.toBeNull();
    });

    // Click on the nested span - the router should find the parent link
    const span = root.querySelector('[data-testid="inner"]')!;
    const clickEvent = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
    Object.defineProperty(clickEvent, "target", { value: span });
    await app.router.onClick(clickEvent);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/page", { method: "GET" });
    });
  });

  it("handles links with target=_self", async () => {
    document.body.innerHTML = `<div id="htx-app" data-testid="htx-app">
      <my-component>Foo</my-component>
      <a href="/page" target="_self">Link</a>
    </div>`;

    const fetchMock = createFetchMock(`<div id="htx-app" data-testid="htx-app">
      <my-component>Bar</my-component>
    </div>`);
    global.fetch = fetchMock as any;

    const app = new App(testComponent);

    await act(async () => {});

    const root = await screen.findByTestId("htx-app");
    await waitFor(() => {
      expect(root.querySelector("pre")).not.toBeNull();
    });

    const link = root.querySelector("a")!;
    // Create click event with the link as target
    const clickEvent = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
    Object.defineProperty(clickEvent, "target", { value: link });
    await app.router.onClick(clickEvent);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/page", { method: "GET" });
    });
  });

  it("uses navigate method correctly", async () => {
    document.body.innerHTML = `<div id="htx-app" data-testid="htx-app">
      <my-component>Foo</my-component>
    </div>`;

    const fetchMock = createFetchMock(`<div id="htx-app" data-testid="htx-app">
      <my-component>Bar</my-component>
    </div>`);
    global.fetch = fetchMock as any;

    const app = new App(testComponent);

    await act(async () => {});

    const root = await screen.findByTestId("htx-app");
    await waitFor(() => {
      expect(root.querySelector("pre")).not.toBeNull();
    });

    await app.router.navigate("/new-page");

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/new-page", { method: "GET" });
    });
  });
});
