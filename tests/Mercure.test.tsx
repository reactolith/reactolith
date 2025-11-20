import { screen, waitFor } from "@testing-library/dom";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { App, Mercure } from "../src";
import { ReactNode } from "react";

function testComponent({ is, children }: { is: string; children: ReactNode }) {
  return <pre data-is={is}>{children}</pre>;
}

// Mock EventSource
class MockEventSource {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 2;

  url: string;
  withCredentials: boolean;
  readyState: number = MockEventSource.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  constructor(url: string, options?: { withCredentials?: boolean }) {
    this.url = url;
    this.withCredentials = options?.withCredentials || false;
  }

  close() {
    this.readyState = MockEventSource.CLOSED;
  }

  // Helper methods for testing
  simulateOpen() {
    this.readyState = MockEventSource.OPEN;
    if (this.onopen) {
      this.onopen(new Event("open"));
    }
  }

  simulateMessage(data: string, id?: string) {
    if (this.onmessage) {
      const event = new MessageEvent("message", {
        data,
        lastEventId: id,
      });
      this.onmessage(event);
    }
  }

  simulateError() {
    if (this.onerror) {
      this.onerror(new Event("error"));
    }
  }
}

describe("Mercure SSE integration", () => {
  let mockEventSource: MockEventSource | null = null;
  const originalEventSource = global.EventSource;
  const originalLocation = window.location;
  let appInstances: App[] = [];

  beforeEach(() => {
    appInstances = [];

    // Mock EventSource globally
    global.EventSource = vi.fn((url: string, options?: { withCredentials?: boolean }) => {
      mockEventSource = new MockEventSource(url, options);
      return mockEventSource;
    }) as any;
    (global.EventSource as any).CONNECTING = 0;
    (global.EventSource as any).OPEN = 1;
    (global.EventSource as any).CLOSED = 2;

    // Mock window.location
    Object.defineProperty(window, "location", {
      value: { pathname: "/dashboard" },
      writable: true,
    });
  });

  afterEach(() => {
    // Clean up all app instances
    appInstances.forEach(app => {
      try {
        app.unmount();
      } catch (e) {
        // Ignore unmount errors in cleanup
      }
    });
    appInstances = [];

    global.EventSource = originalEventSource;
    mockEventSource = null;
    Object.defineProperty(window, "location", {
      value: originalLocation,
      writable: true,
    });
  });

  it("creates a Mercure instance", async () => {
    document.body.innerHTML = `<div id="htx-app" data-testid="htx-app">
      <my-component>Initial</my-component>
    </div>`;

    const app = new App(testComponent);
    appInstances.push(app);
    appInstances.push(app);
    const mercure = new Mercure(app);

    expect(mercure).toBeInstanceOf(Mercure);
    expect(mercure.connected).toBe(false);
  });

  it("subscribes to Mercure hub using current pathname", async () => {
    document.body.innerHTML = `<div id="htx-app" data-testid="htx-app">
      <my-component>Initial</my-component>
    </div>`;

    const app = new App(testComponent);
    appInstances.push(app);
    const mercure = new Mercure(app);

    mercure.subscribe({
      hubUrl: "https://example.com/.well-known/mercure",
    });

    expect(global.EventSource).toHaveBeenCalledWith(
      "https://example.com/.well-known/mercure?topic=%2Fdashboard",
      { withCredentials: false },
    );
  });

  it("uses different pathnames as topics", async () => {
    document.body.innerHTML = `<div id="htx-app" data-testid="htx-app">
      <my-component>Initial</my-component>
    </div>`;

    // Change pathname
    Object.defineProperty(window, "location", {
      value: { pathname: "/users/123" },
      writable: true,
    });

    const app = new App(testComponent);
    appInstances.push(app);
    const mercure = new Mercure(app);

    mercure.subscribe({
      hubUrl: "https://example.com/.well-known/mercure",
    });

    const calledUrl = (global.EventSource as any).mock.calls[0][0];
    expect(calledUrl).toContain("topic=%2Fusers%2F123");
  });

  it("emits sse:connected when connection opens", async () => {
    document.body.innerHTML = `<div id="htx-app" data-testid="htx-app">
      <my-component>Initial</my-component>
    </div>`;

    const app = new App(testComponent);
    appInstances.push(app);
    const mercure = new Mercure(app);
    const connectedHandler = vi.fn();

    mercure.on("sse:connected", connectedHandler);

    mercure.subscribe({
      hubUrl: "https://example.com/.well-known/mercure",
    });

    mockEventSource!.simulateOpen();

    expect(connectedHandler).toHaveBeenCalledTimes(1);
    expect(mercure.connected).toBe(true);
  });

  it("processes incoming HTML and renders it", async () => {
    document.body.innerHTML = `<div id="htx-app" data-testid="htx-app">
      <my-component>Initial</my-component>
    </div>`;

    const app = new App(testComponent);
    appInstances.push(app);
    const mercure = new Mercure(app);

    mercure.subscribe({
      hubUrl: "https://example.com/.well-known/mercure",
    });

    mockEventSource!.simulateOpen();

    const root = await screen.findByTestId("htx-app");
    await waitFor(() => {
      expect(root.querySelector("pre")).not.toBeNull();
    });

    expect(root.querySelector("pre")).toHaveTextContent("Initial");

    // Simulate receiving an SSE message with new HTML
    mockEventSource!.simulateMessage(`<div id="htx-app">
      <my-component>Updated via SSE</my-component>
    </div>`);

    await waitFor(() => {
      expect(root.querySelector("pre")).toHaveTextContent("Updated via SSE");
    });
  });

  it("emits render:success on successful render", async () => {
    document.body.innerHTML = `<div id="htx-app" data-testid="htx-app">
      <my-component>Initial</my-component>
    </div>`;

    const app = new App(testComponent);
    appInstances.push(app);
    const mercure = new Mercure(app);
    const successHandler = vi.fn();

    mercure.on("render:success", successHandler);

    mercure.subscribe({
      hubUrl: "https://example.com/.well-known/mercure",
    });

    mockEventSource!.simulateOpen();

    await screen.findByTestId("htx-app");

    mockEventSource!.simulateMessage(`<div id="htx-app">
      <my-component>Updated</my-component>
    </div>`);

    await waitFor(() => {
      expect(successHandler).toHaveBeenCalledTimes(1);
    });
  });

  it("emits render:failed when root element not found in HTML", async () => {
    document.body.innerHTML = `<div id="htx-app" data-testid="htx-app">
      <my-component>Initial</my-component>
    </div>`;

    const app = new App(testComponent);
    appInstances.push(app);
    const mercure = new Mercure(app);
    const failedHandler = vi.fn();

    mercure.on("render:failed", failedHandler);

    mercure.subscribe({
      hubUrl: "https://example.com/.well-known/mercure",
    });

    mockEventSource!.simulateOpen();

    await screen.findByTestId("htx-app");

    // Send HTML without the htx-app root
    mockEventSource!.simulateMessage(`<div id="other-app">
      <my-component>No root</my-component>
    </div>`);

    await waitFor(() => {
      expect(failedHandler).toHaveBeenCalledTimes(1);
    });
  });

  it("emits sse:message for every message", async () => {
    document.body.innerHTML = `<div id="htx-app" data-testid="htx-app">
      <my-component>Initial</my-component>
    </div>`;

    const app = new App(testComponent);
    appInstances.push(app);
    const mercure = new Mercure(app);
    const messageHandler = vi.fn();

    mercure.on("sse:message", messageHandler);

    mercure.subscribe({
      hubUrl: "https://example.com/.well-known/mercure",
    });

    mockEventSource!.simulateOpen();

    const html = `<div id="htx-app"><my-component>Updated</my-component></div>`;
    mockEventSource!.simulateMessage(html);

    expect(messageHandler).toHaveBeenCalledTimes(1);
    expect(messageHandler.mock.calls[0][1]).toBe(html);
  });

  it("emits sse:error on connection error", async () => {
    document.body.innerHTML = `<div id="htx-app" data-testid="htx-app">
      <my-component>Initial</my-component>
    </div>`;

    const app = new App(testComponent);
    appInstances.push(app);
    const mercure = new Mercure(app);
    const errorHandler = vi.fn();

    mercure.on("sse:error", errorHandler);

    mercure.subscribe({
      hubUrl: "https://example.com/.well-known/mercure",
    });

    mockEventSource!.simulateError();

    expect(errorHandler).toHaveBeenCalledTimes(1);
  });

  it("closes connection and emits sse:disconnected", async () => {
    document.body.innerHTML = `<div id="htx-app" data-testid="htx-app">
      <my-component>Initial</my-component>
    </div>`;

    const app = new App(testComponent);
    appInstances.push(app);
    const mercure = new Mercure(app);
    const disconnectedHandler = vi.fn();

    mercure.on("sse:disconnected", disconnectedHandler);

    mercure.subscribe({
      hubUrl: "https://example.com/.well-known/mercure",
    });

    mockEventSource!.simulateOpen();
    expect(mercure.connected).toBe(true);

    mercure.close();

    expect(disconnectedHandler).toHaveBeenCalledTimes(1);
    expect(mercure.connected).toBe(false);
  });

  it("can unsubscribe from events using off()", async () => {
    document.body.innerHTML = `<div id="htx-app" data-testid="htx-app">
      <my-component>Initial</my-component>
    </div>`;

    const app = new App(testComponent);
    appInstances.push(app);
    const mercure = new Mercure(app);
    const handler = vi.fn();

    mercure.on("sse:connected", handler);
    mercure.off("sse:connected", handler);

    mercure.subscribe({
      hubUrl: "https://example.com/.well-known/mercure",
    });

    mockEventSource!.simulateOpen();

    expect(handler).not.toHaveBeenCalled();
  });

  it("can unsubscribe using returned cleanup function", async () => {
    document.body.innerHTML = `<div id="htx-app" data-testid="htx-app">
      <my-component>Initial</my-component>
    </div>`;

    const app = new App(testComponent);
    appInstances.push(app);
    const mercure = new Mercure(app);
    const handler = vi.fn();

    const unsubscribe = mercure.on("sse:connected", handler);
    unsubscribe();

    mercure.subscribe({
      hubUrl: "https://example.com/.well-known/mercure",
    });

    mockEventSource!.simulateOpen();

    expect(handler).not.toHaveBeenCalled();
  });

  it("re-subscribes when router navigates", async () => {
    document.body.innerHTML = `<div id="htx-app" data-testid="htx-app">
      <my-component>Initial</my-component>
    </div>`;

    const app = new App(testComponent);
    appInstances.push(app);
    const mercure = new Mercure(app);
    const disconnectedHandler = vi.fn();

    mercure.on("sse:disconnected", disconnectedHandler);

    mercure.subscribe({
      hubUrl: "https://example.com/.well-known/mercure",
    });

    const firstEventSource = mockEventSource;
    mockEventSource!.simulateOpen();

    // Simulate route change
    Object.defineProperty(window, "location", {
      value: { pathname: "/new-route" },
      writable: true,
    });

    // Emit router's render:success event (cast to any for testing protected method)
    (app.router as any).emit("render:success", "/new-route", {}, true, new Response(), "<html></html>", "/new-route");

    expect(firstEventSource!.readyState).toBe(MockEventSource.CLOSED);
    expect(disconnectedHandler).toHaveBeenCalledTimes(1);

    // Verify new subscription uses new pathname
    const calledUrl = (global.EventSource as any).mock.calls[1][0];
    expect(calledUrl).toContain("topic=%2Fnew-route");
  });

  it("includes withCredentials option", async () => {
    document.body.innerHTML = `<div id="htx-app" data-testid="htx-app">
      <my-component>Initial</my-component>
    </div>`;

    const app = new App(testComponent);
    appInstances.push(app);
    const mercure = new Mercure(app);

    mercure.subscribe({
      hubUrl: "https://example.com/.well-known/mercure",
      withCredentials: true,
    });

    expect(global.EventSource).toHaveBeenCalledWith(
      expect.any(String),
      { withCredentials: true },
    );
  });

  it("includes lastEventId in URL", async () => {
    document.body.innerHTML = `<div id="htx-app" data-testid="htx-app">
      <my-component>Initial</my-component>
    </div>`;

    const app = new App(testComponent);
    appInstances.push(app);
    const mercure = new Mercure(app);

    mercure.subscribe({
      hubUrl: "https://example.com/.well-known/mercure",
      lastEventId: "abc123",
    });

    const calledUrl = (global.EventSource as any).mock.calls[0][0];
    expect(calledUrl).toContain("lastEventID=abc123");
  });

  it("exposes current URL", async () => {
    document.body.innerHTML = `<div id="htx-app" data-testid="htx-app">
      <my-component>Initial</my-component>
    </div>`;

    const app = new App(testComponent);
    appInstances.push(app);
    const mercure = new Mercure(app);

    expect(mercure.url).toBeNull();

    mercure.subscribe({
      hubUrl: "https://example.com/.well-known/mercure",
    });

    expect(mercure.url).toContain("example.com");
    expect(mercure.url).toContain("topic=%2Fdashboard");
  });

  it("cleans up router listener on close", async () => {
    document.body.innerHTML = `<div id="htx-app" data-testid="htx-app">
      <my-component>Initial</my-component>
    </div>`;

    const app = new App(testComponent);
    appInstances.push(app);
    const mercure = new Mercure(app);

    mercure.subscribe({
      hubUrl: "https://example.com/.well-known/mercure",
    });

    mockEventSource!.simulateOpen();
    mercure.close();

    // Simulate route change after close - should not create new connection
    Object.defineProperty(window, "location", {
      value: { pathname: "/new-route" },
      writable: true,
    });

    (app.router as any).emit("render:success", "/new-route", {}, true, new Response(), "<html></html>", "/new-route");

    // Should still only have 1 call (the initial one)
    expect(global.EventSource).toHaveBeenCalledTimes(1);
  });

  it("auto-refetches current route when receiving empty message", async () => {
    document.body.innerHTML = `<div id="htx-app" data-testid="htx-app">
      <my-component>Initial</my-component>
    </div>`;

    // Mock fetch to return updated HTML
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      redirected: false,
      text: async () => `<div id="htx-app">
        <my-component>Refetched content</my-component>
      </div>`,
    });

    const app = new App(testComponent, undefined, undefined, undefined, undefined, mockFetch as any);
    appInstances.push(app);
    const mercure = new Mercure(app);

    const refetchStartedHandler = vi.fn();
    const refetchSuccessHandler = vi.fn();

    mercure.on("refetch:started", refetchStartedHandler);
    mercure.on("refetch:success", refetchSuccessHandler);

    mercure.subscribe({
      hubUrl: "https://example.com/.well-known/mercure",
    });

    mockEventSource!.simulateOpen();

    const root = await screen.findByTestId("htx-app");
    await waitFor(() => {
      expect(root.querySelector("pre")).not.toBeNull();
    });

    expect(root.querySelector("pre")).toHaveTextContent("Initial");

    // Simulate receiving an empty SSE message
    mockEventSource!.simulateMessage("");

    // Should trigger refetch
    await waitFor(() => {
      expect(refetchStartedHandler).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        window.location.pathname + window.location.search,
        { method: "GET" }
      );
    });

    await waitFor(() => {
      expect(refetchSuccessHandler).toHaveBeenCalledTimes(1);
    });

    // Content should be updated
    await waitFor(() => {
      expect(root.querySelector("pre")).toHaveTextContent("Refetched content");
    });
  });

  it("auto-refetches current route when receiving whitespace-only message", async () => {
    document.body.innerHTML = `<div id="htx-app" data-testid="htx-app">
      <my-component>Initial</my-component>
    </div>`;

    // Mock fetch to return updated HTML
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      redirected: false,
      text: async () => `<div id="htx-app">
        <my-component>Refetched content</my-component>
      </div>`,
    });

    const app = new App(testComponent, undefined, undefined, undefined, undefined, mockFetch as any);
    appInstances.push(app);
    const mercure = new Mercure(app);

    const refetchStartedHandler = vi.fn();
    const refetchSuccessHandler = vi.fn();

    mercure.on("refetch:started", refetchStartedHandler);
    mercure.on("refetch:success", refetchSuccessHandler);

    mercure.subscribe({
      hubUrl: "https://example.com/.well-known/mercure",
    });

    mockEventSource!.simulateOpen();

    const root = await screen.findByTestId("htx-app");
    await waitFor(() => {
      expect(root.querySelector("pre")).not.toBeNull();
    });

    expect(root.querySelector("pre")).toHaveTextContent("Initial");

    // Simulate receiving a whitespace-only SSE message
    mockEventSource!.simulateMessage("   \n\t  ");

    // Should trigger refetch
    await waitFor(() => {
      expect(refetchStartedHandler).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalled();
      expect(refetchSuccessHandler).toHaveBeenCalledTimes(1);
    });

    // Content should be updated
    await waitFor(() => {
      expect(root.querySelector("pre")).toHaveTextContent("Refetched content");
    });
  });

  it("emits refetch:failed when refetch fails", async () => {
    document.body.innerHTML = `<div id="htx-app" data-testid="htx-app">
      <my-component>Initial</my-component>
    </div>`;

    // Mock fetch to reject
    const mockFetch = vi.fn().mockRejectedValue(new Error("Network error"));

    const app = new App(testComponent, undefined, undefined, undefined, undefined, mockFetch as any);
    appInstances.push(app);
    const mercure = new Mercure(app);

    const refetchFailedHandler = vi.fn();

    mercure.on("refetch:failed", refetchFailedHandler);

    mercure.subscribe({
      hubUrl: "https://example.com/.well-known/mercure",
    });

    mockEventSource!.simulateOpen();

    // Simulate receiving an empty SSE message
    mockEventSource!.simulateMessage("");

    // Should emit refetch:failed
    await waitFor(() => {
      expect(refetchFailedHandler).toHaveBeenCalledTimes(1);
      expect(refetchFailedHandler.mock.calls[0][1]).toBeInstanceOf(Error);
      expect(refetchFailedHandler.mock.calls[0][1].message).toBe("Network error");
    });
  });

  it("does not refetch when receiving normal HTML content", async () => {
    document.body.innerHTML = `<div id="htx-app" data-testid="htx-app">
      <my-component>Initial</my-component>
    </div>`;

    const mockFetch = vi.fn();

    const app = new App(testComponent, undefined, undefined, undefined, undefined, mockFetch as any);
    appInstances.push(app);
    const mercure = new Mercure(app);

    const refetchStartedHandler = vi.fn();

    mercure.on("refetch:started", refetchStartedHandler);

    mercure.subscribe({
      hubUrl: "https://example.com/.well-known/mercure",
    });

    mockEventSource!.simulateOpen();

    // Simulate receiving normal HTML content
    mockEventSource!.simulateMessage(`<div id="htx-app">
      <my-component>Updated via SSE</my-component>
    </div>`);

    const root = await screen.findByTestId("htx-app");
    await waitFor(() => {
      expect(root.querySelector("pre")).toHaveTextContent("Updated via SSE");
    });

    // Should NOT trigger refetch
    expect(refetchStartedHandler).not.toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
