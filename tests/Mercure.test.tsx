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

  beforeEach(() => {
    // Mock EventSource globally
    global.EventSource = vi.fn((url: string, options?: { withCredentials?: boolean }) => {
      mockEventSource = new MockEventSource(url, options);
      return mockEventSource;
    }) as any;
    (global.EventSource as any).CONNECTING = 0;
    (global.EventSource as any).OPEN = 1;
    (global.EventSource as any).CLOSED = 2;
  });

  afterEach(() => {
    global.EventSource = originalEventSource;
    mockEventSource = null;
  });

  it("creates a Mercure instance", async () => {
    document.body.innerHTML = `<div id="htx-app" data-testid="htx-app">
      <my-component>Initial</my-component>
    </div>`;

    const app = new App(testComponent);
    const mercure = new Mercure(app);

    expect(mercure).toBeInstanceOf(Mercure);
    expect(mercure.connected).toBe(false);
  });

  it("subscribes to a Mercure hub", async () => {
    document.body.innerHTML = `<div id="htx-app" data-testid="htx-app">
      <my-component>Initial</my-component>
    </div>`;

    const app = new App(testComponent);
    const mercure = new Mercure(app);

    mercure.subscribe({
      hubUrl: "https://example.com/.well-known/mercure",
      topics: "/updates",
    });

    expect(global.EventSource).toHaveBeenCalledWith(
      "https://example.com/.well-known/mercure?topic=%2Fupdates",
      { withCredentials: false },
    );
  });

  it("subscribes to multiple topics", async () => {
    document.body.innerHTML = `<div id="htx-app" data-testid="htx-app">
      <my-component>Initial</my-component>
    </div>`;

    const app = new App(testComponent);
    const mercure = new Mercure(app);

    mercure.subscribe({
      hubUrl: "https://example.com/.well-known/mercure",
      topics: ["/updates", "/notifications"],
    });

    const calledUrl = (global.EventSource as any).mock.calls[0][0];
    expect(calledUrl).toContain("topic=%2Fupdates");
    expect(calledUrl).toContain("topic=%2Fnotifications");
  });

  it("emits sse:connected when connection opens", async () => {
    document.body.innerHTML = `<div id="htx-app" data-testid="htx-app">
      <my-component>Initial</my-component>
    </div>`;

    const app = new App(testComponent);
    const mercure = new Mercure(app);
    const connectedHandler = vi.fn();

    mercure.on("sse:connected", connectedHandler);

    mercure.subscribe({
      hubUrl: "https://example.com/.well-known/mercure",
      topics: "/updates",
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
    const mercure = new Mercure(app);

    mercure.subscribe({
      hubUrl: "https://example.com/.well-known/mercure",
      topics: "/updates",
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
    const mercure = new Mercure(app);
    const successHandler = vi.fn();

    mercure.on("render:success", successHandler);

    mercure.subscribe({
      hubUrl: "https://example.com/.well-known/mercure",
      topics: "/updates",
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
    const mercure = new Mercure(app);
    const failedHandler = vi.fn();

    mercure.on("render:failed", failedHandler);

    mercure.subscribe({
      hubUrl: "https://example.com/.well-known/mercure",
      topics: "/updates",
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
    const mercure = new Mercure(app);
    const messageHandler = vi.fn();

    mercure.on("sse:message", messageHandler);

    mercure.subscribe({
      hubUrl: "https://example.com/.well-known/mercure",
      topics: "/updates",
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
    const mercure = new Mercure(app);
    const errorHandler = vi.fn();

    mercure.on("sse:error", errorHandler);

    mercure.subscribe({
      hubUrl: "https://example.com/.well-known/mercure",
      topics: "/updates",
    });

    mockEventSource!.simulateError();

    expect(errorHandler).toHaveBeenCalledTimes(1);
  });

  it("closes connection and emits sse:disconnected", async () => {
    document.body.innerHTML = `<div id="htx-app" data-testid="htx-app">
      <my-component>Initial</my-component>
    </div>`;

    const app = new App(testComponent);
    const mercure = new Mercure(app);
    const disconnectedHandler = vi.fn();

    mercure.on("sse:disconnected", disconnectedHandler);

    mercure.subscribe({
      hubUrl: "https://example.com/.well-known/mercure",
      topics: "/updates",
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
    const mercure = new Mercure(app);
    const handler = vi.fn();

    mercure.on("sse:connected", handler);
    mercure.off("sse:connected", handler);

    mercure.subscribe({
      hubUrl: "https://example.com/.well-known/mercure",
      topics: "/updates",
    });

    mockEventSource!.simulateOpen();

    expect(handler).not.toHaveBeenCalled();
  });

  it("can unsubscribe using returned cleanup function", async () => {
    document.body.innerHTML = `<div id="htx-app" data-testid="htx-app">
      <my-component>Initial</my-component>
    </div>`;

    const app = new App(testComponent);
    const mercure = new Mercure(app);
    const handler = vi.fn();

    const unsubscribe = mercure.on("sse:connected", handler);
    unsubscribe();

    mercure.subscribe({
      hubUrl: "https://example.com/.well-known/mercure",
      topics: "/updates",
    });

    mockEventSource!.simulateOpen();

    expect(handler).not.toHaveBeenCalled();
  });

  it("closes previous connection when subscribing again", async () => {
    document.body.innerHTML = `<div id="htx-app" data-testid="htx-app">
      <my-component>Initial</my-component>
    </div>`;

    const app = new App(testComponent);
    const mercure = new Mercure(app);
    const disconnectedHandler = vi.fn();

    mercure.on("sse:disconnected", disconnectedHandler);

    mercure.subscribe({
      hubUrl: "https://example.com/.well-known/mercure",
      topics: "/updates",
    });

    const firstEventSource = mockEventSource;
    mockEventSource!.simulateOpen();

    // Subscribe again
    mercure.subscribe({
      hubUrl: "https://example.com/.well-known/mercure",
      topics: "/other",
    });

    expect(firstEventSource!.readyState).toBe(MockEventSource.CLOSED);
    expect(disconnectedHandler).toHaveBeenCalledTimes(1);
  });

  it("includes withCredentials option", async () => {
    document.body.innerHTML = `<div id="htx-app" data-testid="htx-app">
      <my-component>Initial</my-component>
    </div>`;

    const app = new App(testComponent);
    const mercure = new Mercure(app);

    mercure.subscribe({
      hubUrl: "https://example.com/.well-known/mercure",
      topics: "/updates",
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
    const mercure = new Mercure(app);

    mercure.subscribe({
      hubUrl: "https://example.com/.well-known/mercure",
      topics: "/updates",
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
    const mercure = new Mercure(app);

    expect(mercure.url).toBeNull();

    mercure.subscribe({
      hubUrl: "https://example.com/.well-known/mercure",
      topics: "/updates",
    });

    expect(mercure.url).toContain("example.com");
    expect(mercure.url).toContain("topic=%2Fupdates");
  });
});
