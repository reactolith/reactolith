import { screen, waitFor } from "@testing-library/dom";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { App, MercureLive } from "../src";
import React from "react";

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

// Helper component factory
function createTestComponent() {
  return ({ is, children, topic, open }: { is: string; children?: React.ReactNode; topic?: string; open?: boolean }) => {
    if (is === "mercure-live" && topic) {
      return <MercureLive topic={topic}>{children}</MercureLive>;
    }
    if (is === "test-component") {
      return <div data-testid="test-component" data-is={is}>{children}</div>;
    }
    if (is === "child-component") {
      return <span data-testid="child" data-is={is}>{children}</span>;
    }
    if (is === "ui-panel") {
      return <div data-testid="ui-panel" data-is={is} data-open={open?.toString()}>{children}</div>;
    }
    return <div data-is={is}>{children}</div>;
  };
}

describe("MercureLive", () => {
  let mockEventSource: MockEventSource | null = null;
  const originalEventSource = global.EventSource;

  beforeEach(() => {
    // Mock EventSource globally
    global.EventSource = vi.fn(
      (url: string, options?: { withCredentials?: boolean }) => {
        mockEventSource = new MockEventSource(url, options);
        return mockEventSource;
      },
    ) as any;
    (global.EventSource as any).CONNECTING = 0;
    (global.EventSource as any).OPEN = 1;
    (global.EventSource as any).CLOSED = 2;
  });

  afterEach(() => {
    global.EventSource = originalEventSource;
    mockEventSource = null;
  });

  it("renders initial children before receiving updates", async () => {
    document.body.innerHTML = `<div id="htx-app">
      <mercure-live topic="/sidebar">
        <test-component>Initial content</test-component>
      </mercure-live>
    </div>`;

    const app = new App(createTestComponent());
    app.mercureConfig = {
      hubUrl: "https://example.com/.well-known/mercure",
      withCredentials: false,
    };

    const element = await screen.findByTestId("test-component");
    expect(element.textContent).toBe("Initial content");
  });

  it("subscribes to correct topic with correct URL", async () => {
    document.body.innerHTML = `<div id="htx-app">
      <mercure-live topic="/sidebar">
        <test-component>Test</test-component>
      </mercure-live>
    </div>`;

    const app = new App(createTestComponent());
    app.mercureConfig = {
      hubUrl: "https://example.com/.well-known/mercure",
      withCredentials: true,
    };

    await waitFor(() => {
      expect(global.EventSource).toHaveBeenCalledWith(
        expect.stringContaining("topic=%2Fsidebar"),
        { withCredentials: true },
      );
    });
  });

  it("sets up onmessage handler", async () => {
    document.body.innerHTML = `<div id="htx-app">
      <mercure-live topic="/test">
        <test-component>Test</test-component>
      </mercure-live>
    </div>`;

    const app = new App(createTestComponent());
    app.mercureConfig = {
      hubUrl: "https://example.com/.well-known/mercure",
      withCredentials: false,
    };

    // Wait for component to mount and EventSource to be created
    await waitFor(() => {
      expect(mockEventSource).not.toBeNull();
      expect(mockEventSource?.onmessage).not.toBeNull();
    });
  });

  it("sets up onerror handler", async () => {
    document.body.innerHTML = `<div id="htx-app">
      <mercure-live topic="/test">
        <test-component>Test</test-component>
      </mercure-live>
    </div>`;

    const app = new App(createTestComponent());
    app.mercureConfig = {
      hubUrl: "https://example.com/.well-known/mercure",
      withCredentials: false,
    };

    // Wait for component to mount and EventSource to be created
    await waitFor(() => {
      expect(mockEventSource).not.toBeNull();
      expect(mockEventSource?.onerror).not.toBeNull();
    });
  });

  it("updates content when receiving HTML message", async () => {
    document.body.innerHTML = `<div id="htx-app">
      <mercure-live topic="/test">
        <test-component>Initial</test-component>
      </mercure-live>
    </div>`;

    const app = new App(createTestComponent());
    app.mercureConfig = {
      hubUrl: "https://example.com/.well-known/mercure",
      withCredentials: false,
    };

    // Wait for initial render
    let element = await screen.findByTestId("test-component");
    expect(element.textContent).toBe("Initial");

    // Wait for EventSource to be created
    await waitFor(() => {
      expect(mockEventSource).not.toBeNull();
      expect(mockEventSource?.onmessage).not.toBeNull();
    });

    // Simulate receiving an HTML update
    mockEventSource?.simulateMessage("<test-component>Updated</test-component>");

    // Wait for content to update
    await waitFor(() => {
      element = screen.getByTestId("test-component");
      expect(element.textContent).toBe("Updated");
    });
  });

  it("handles messages with multiple children", async () => {
    document.body.innerHTML = `<div id="htx-app">
      <mercure-live topic="/test">
        <test-component></test-component>
      </mercure-live>
    </div>`;

    const app = new App(createTestComponent());
    app.mercureConfig = {
      hubUrl: "https://example.com/.well-known/mercure",
      withCredentials: false,
    };

    // Wait for EventSource to be created
    await waitFor(() => {
      expect(mockEventSource).not.toBeNull();
      expect(mockEventSource?.onmessage).not.toBeNull();
    });

    // Simulate receiving an HTML update with children
    mockEventSource?.simulateMessage(
      "<test-component><child-component>Child 1</child-component><child-component>Child 2</child-component></test-component>",
    );

    // Wait for content to update
    await waitFor(() => {
      const children = screen.getAllByTestId("child");
      expect(children).toHaveLength(2);
      expect(children[0].textContent).toBe("Child 1");
      expect(children[1].textContent).toBe("Child 2");
    });
  });

  it("closes EventSource on unmount", async () => {
    document.body.innerHTML = `<div id="htx-app">
      <mercure-live topic="/test">
        <test-component>Test</test-component>
      </mercure-live>
    </div>`;

    const app = new App(createTestComponent());
    app.mercureConfig = {
      hubUrl: "https://example.com/.well-known/mercure",
      withCredentials: false,
    };

    // Wait for EventSource to be created
    await waitFor(() => {
      expect(mockEventSource).not.toBeNull();
    });

    const closeSpy = vi.spyOn(mockEventSource!, "close");

    // Unmount by clearing the DOM
    document.body.innerHTML = `<div id="htx-app"></div>`;
    app.render(document);

    // EventSource should be closed
    await waitFor(() => {
      expect(closeSpy).toHaveBeenCalled();
    });
  });

  it("does nothing when mercureConfig is not set", async () => {
    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    document.body.innerHTML = `<div id="htx-app">
      <mercure-live topic="/test">
        <test-component>Initial</test-component>
      </mercure-live>
    </div>`;

    const app = new App(createTestComponent());
    // Don't set mercureConfig

    const element = await screen.findByTestId("test-component");
    expect(element.textContent).toBe("Initial");

    // EventSource should not be created
    expect(global.EventSource).not.toHaveBeenCalled();

    // Should warn about missing config
    await waitFor(() => {
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("mercureConfig is not set"),
      );
    });

    consoleWarnSpy.mockRestore();
  });

  it("handles invalid HTML gracefully", async () => {
    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    document.body.innerHTML = `<div id="htx-app">
      <mercure-live topic="/test">
        <test-component>Initial</test-component>
      </mercure-live>
    </div>`;

    const app = new App(createTestComponent());
    app.mercureConfig = {
      hubUrl: "https://example.com/.well-known/mercure",
      withCredentials: false,
    };

    // Wait for initial render
    let element = await screen.findByTestId("test-component");
    expect(element.textContent).toBe("Initial");

    // Wait for EventSource to be created
    await waitFor(() => {
      expect(mockEventSource).not.toBeNull();
      expect(mockEventSource?.onmessage).not.toBeNull();
    });

    // Simulate receiving empty HTML (no element in body)
    mockEventSource?.simulateMessage("");

    // Should log a warning
    await waitFor(() => {
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("No element found"),
      );
    });

    // Content should remain unchanged
    element = screen.getByTestId("test-component");
    expect(element.textContent).toBe("Initial");

    consoleWarnSpy.mockRestore();
  });

  it("handles parse errors gracefully", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    document.body.innerHTML = `<div id="htx-app">
      <mercure-live topic="/test">
        <test-component>Initial</test-component>
      </mercure-live>
    </div>`;

    const app = new App(createTestComponent());
    app.mercureConfig = {
      hubUrl: "https://example.com/.well-known/mercure",
      withCredentials: false,
    };

    // Wait for initial render
    let element = await screen.findByTestId("test-component");
    expect(element.textContent).toBe("Initial");

    // Wait for EventSource to be created
    await waitFor(() => {
      expect(mockEventSource).not.toBeNull();
      expect(mockEventSource?.onmessage).not.toBeNull();
    });

    // Mock DOMParser to throw an error
    const originalDOMParser = global.DOMParser;
    global.DOMParser = class {
      parseFromString() {
        throw new Error("Parse error");
      }
    } as any;

    // Simulate receiving a message
    mockEventSource?.simulateMessage("<test-component>Updated</test-component>");

    // Should log an error
    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Failed to parse message"),
        expect.any(Error),
      );
    });

    // Content should remain unchanged
    element = screen.getByTestId("test-component");
    expect(element.textContent).toBe("Initial");

    // Restore
    global.DOMParser = originalDOMParser;
    consoleErrorSpy.mockRestore();
  });

  it("creates EventSource with correct config", async () => {
    document.body.innerHTML = `<div id="htx-app">
      <mercure-live topic="/test">
        <test-component>Test</test-component>
      </mercure-live>
    </div>`;

    const app = new App(createTestComponent());
    app.mercureConfig = {
      hubUrl: "https://example.com/.well-known/mercure",
      withCredentials: true,
    };

    await waitFor(() => {
      expect(mockEventSource).not.toBeNull();
      expect(mockEventSource?.withCredentials).toBe(true);
    });
  });

  it("handles nested MercureLive components", async () => {
    let eventSources: MockEventSource[] = [];

    // Track all EventSource instances
    global.EventSource = vi.fn(
      (url: string, options?: { withCredentials?: boolean }) => {
        const es = new MockEventSource(url, options);
        eventSources.push(es);
        mockEventSource = es; // Keep reference to latest
        return es;
      },
    ) as any;

    document.body.innerHTML = `<div id="htx-app">
      <mercure-live topic="/outer">
        <test-component>Outer initial</test-component>
      </mercure-live>
    </div>`;

    const app = new App(createTestComponent());
    app.mercureConfig = {
      hubUrl: "https://example.com/.well-known/mercure",
      withCredentials: false,
    };

    // Wait for initial render
    let element = await screen.findByTestId("test-component");
    expect(element.textContent).toBe("Outer initial");

    // Wait for first EventSource to be created (for /outer topic)
    await waitFor(() => {
      expect(eventSources.length).toBe(1);
      expect(eventSources[0].url).toContain("topic=%2Fouter");
    });

    // Push an update that contains a nested mercure-live component
    eventSources[0].simulateMessage(
      `<test-component>
        Outer updated
        <mercure-live topic="/inner">
          <test-component>Inner initial</test-component>
        </mercure-live>
      </test-component>`
    );

    // Wait for the nested EventSource to be created (for /inner topic)
    await waitFor(() => {
      expect(eventSources.length).toBe(2);
      expect(eventSources[1].url).toContain("topic=%2Finner");
    }, { timeout: 2000 });

    // Verify both components are rendered
    const components = screen.getAllByTestId("test-component");
    expect(components.length).toBeGreaterThanOrEqual(2);

    // Now push an update to the inner topic
    eventSources[1].simulateMessage("<test-component>Inner updated</test-component>");

    // Verify inner content updated
    await waitFor(() => {
      const innerComponents = screen.getAllByTestId("test-component");
      const hasInnerUpdated = innerComponents.some(
        comp => comp.textContent?.includes("Inner updated")
      );
      expect(hasInnerUpdated).toBe(true);
    });
  });

  it("updates children when navigation changes props (without Mercure messages)", async () => {
    document.body.innerHTML = `<div id="htx-app">
      <mercure-live topic="/panel">
        <ui-panel open="true">Panel content</ui-panel>
      </mercure-live>
    </div>`;

    const app = new App(createTestComponent());
    app.mercureConfig = {
      hubUrl: "https://example.com/.well-known/mercure",
      withCredentials: false,
    };

    // Wait for initial render
    let panel = await screen.findByTestId("ui-panel");
    expect(panel.getAttribute("data-open")).toBe("true");
    expect(panel.textContent).toBe("Panel content");

    // Simulate navigation that changes the open prop (like router navigation)
    const newDocument = new DOMParser().parseFromString(
      `<html><body><div id="htx-app">
        <mercure-live topic="/panel">
          <ui-panel open="false">Panel content</ui-panel>
        </mercure-live>
      </div></body></html>`,
      "text/html"
    );

    // Trigger app.render to simulate navigation
    app.render(newDocument);

    // Wait for the prop to update
    await waitFor(() => {
      panel = screen.getByTestId("ui-panel");
      expect(panel.getAttribute("data-open")).toBe("false");
    });

    // Content should remain the same
    expect(panel.textContent).toBe("Panel content");
  });
});
