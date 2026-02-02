import { screen, waitFor } from "@testing-library/dom";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { App, useMercureTopic } from "../src";
import React, { ReactNode } from "react";

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

describe("useMercureTopic", () => {
  let mockEventSource: MockEventSource | null = null;
  const originalEventSource = global.EventSource;
  let eventSourceCalls: Array<[string, any?]> = [];

  beforeEach(() => {
    eventSourceCalls = [];

    // Mock EventSource globally with a proper constructor function
    const TrackedEventSource: any = class extends MockEventSource {
      constructor(url: string, options?: { withCredentials?: boolean }) {
        super(url, options);
        mockEventSource = this;
        eventSourceCalls.push([url, options]);
      }
    };
    TrackedEventSource.CONNECTING = 0;
    TrackedEventSource.OPEN = 1;
    TrackedEventSource.CLOSED = 2;

    global.EventSource = TrackedEventSource;
  });

  afterEach(() => {
    // Don't reset global.EventSource here - let each test's beforeEach handle it
    mockEventSource = null;
  });

  it("returns initial value before receiving updates", async () => {
    function TestComponent({ is }: { is: string }) {
      const count = useMercureTopic("/notifications/count", 0);
      return <div data-testid="count" data-is={is}>{count}</div>;
    }

    document.body.innerHTML = `<div id="htx-app">
      <test-component></test-component>
    </div>`;

    const app = new App(TestComponent);
    app.mercureConfig = {
      hubUrl: "https://example.com/.well-known/mercure",
      withCredentials: false,
    };

    const countElement = await screen.findByTestId("count");
    expect(countElement.textContent).toBe("0");
  });

  it("sets up onmessage handler", async () => {
    function TestComponent({ is }: { is: string }) {
      const count = useMercureTopic("/notifications/count", 0);
      return <div data-testid="count" data-is={is}>{count}</div>;
    }

    document.body.innerHTML = `<div id="htx-app">
      <test-component></test-component>
    </div>`;

    const app = new App(TestComponent);
    app.mercureConfig = {
      hubUrl: "https://example.com/.well-known/mercure",
      withCredentials: false,
    };

    await screen.findByTestId("count");

    // Verify that EventSource was created with onmessage handler
    await waitFor(() => {
      expect(mockEventSource).not.toBeNull();
      expect(mockEventSource?.onmessage).not.toBeNull();
    });
  });

  it("subscribes to correct topic with correct URL", async () => {
    function TestComponent({ is }: { is: string }) {
      useMercureTopic("/notifications/count", 0);
      return <div data-is={is}>Test</div>;
    }

    const div = document.createElement('div');
    div.id = 'htx-app';
    div.setAttribute('data-mercure-hub-url', 'https://example.com/.well-known/mercure');
    div.setAttribute('data-mercure-with-credentials', '');
    div.innerHTML = '<test-component></test-component>';
    document.body.innerHTML = '';
    document.body.appendChild(div);

    const app = new App(TestComponent);

    await waitFor(() => {
      // Find the call for this specific test with the correct withCredentials value
      const relevantCall = eventSourceCalls.find(call =>
        call[0].includes('topic=%2Fnotifications%2Fcount') &&
        call[1]?.withCredentials === true
      );

      expect(relevantCall).toBeDefined();
      expect(relevantCall![0]).toContain("topic=%2Fnotifications%2Fcount");
      expect(relevantCall![1]).toEqual({ withCredentials: true });
    });
  });

  it("handles complex types with type parameter", async () => {
    interface Stats {
      visitors: number;
      sales: number;
    }

    function TestComponent({ is }: { is: string }) {
      const stats = useMercureTopic<Stats>("/stats", { visitors: 0, sales: 0 });
      return (
        <div data-is={is}>
          <span data-testid="visitors">{stats.visitors}</span>
          <span data-testid="sales">{stats.sales}</span>
        </div>
      );
    }

    document.body.innerHTML = `<div id="htx-app">
      <test-component></test-component>
    </div>`;

    const app = new App(TestComponent);
    app.mercureConfig = {
      hubUrl: "https://example.com/.well-known/mercure",
    };

    // Verify initial values are rendered
    const visitorsElement = await screen.findByTestId("visitors");
    const salesElement = await screen.findByTestId("sales");

    expect(visitorsElement.textContent).toBe("0");
    expect(salesElement.textContent).toBe("0");
  });

  it("sets up onerror handler", async () => {
    function TestComponent({ is }: { is: string }) {
      const count = useMercureTopic("/notifications/count", 0);
      return <div data-testid="count" data-is={is}>{count}</div>;
    }

    document.body.innerHTML = `<div id="htx-app">
      <test-component></test-component>
    </div>`;

    const app = new App(TestComponent);
    app.mercureConfig = {
      hubUrl: "https://example.com/.well-known/mercure",
    };

    await screen.findByTestId("count");

    // Verify that EventSource was created with onerror handler
    await waitFor(() => {
      expect(mockEventSource).not.toBeNull();
      expect(mockEventSource?.onerror).not.toBeNull();
    });
  });

  it("creates EventSource with correct config", async () => {
    function TestComponent({ is }: { is: string }) {
      const count = useMercureTopic("/count", 0);
      return <div data-testid="count" data-is={is}>{count}</div>;
    }

    document.body.innerHTML = `<div id="htx-app">
      <test-component></test-component>
    </div>`;

    const app = new App(TestComponent);
    app.mercureConfig = {
      hubUrl: "https://example.com/.well-known/mercure",
      withCredentials: true,
    };

    await waitFor(() => {
      expect(mockEventSource).not.toBeNull();
      expect(mockEventSource?.withCredentials).toBe(true);
    });
  });

  it("does nothing when mercureConfig is not set", async () => {
    function TestComponent({ is }: { is: string }) {
      const count = useMercureTopic("/count", 42);
      return <div data-testid="count" data-is={is}>{count}</div>;
    }

    document.body.innerHTML = `<div id="htx-app">
      <test-component></test-component>
    </div>`;

    const app = new App(TestComponent);
    // Don't set mercureConfig

    const countElement = await screen.findByTestId("count");
    expect(countElement.textContent).toBe("42");

    // EventSource should not be created
    expect(eventSourceCalls.length).toBe(0);
  });
});
