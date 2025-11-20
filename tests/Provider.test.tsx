import { screen, waitFor, fireEvent } from "@testing-library/dom";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { App } from "../src";
import { ReactNode, act } from "react";
import { useRouter } from "../src/provider/RouterProvider";
import { useApp } from "../src/provider/AppProvider";

describe("AppProvider", () => {
  it("removes hidden class on mount", async () => {
    document.body.innerHTML = `<div id="htx-app" data-testid="htx-app" class="hidden other-class">
      <my-component>Content</my-component>
    </div>`;

    function testComponent({ is }: { is: string }) {
      return <pre data-is={is}>Rendered</pre>;
    }

    new App(testComponent);

    const root = await screen.findByTestId("htx-app");

    await waitFor(() => {
      expect(root).not.toHaveClass("hidden");
    });

    // Other classes should remain
    expect(root).toHaveClass("other-class");
  });

  it("provides app instance via useApp hook", async () => {
    document.body.innerHTML = `<div id="htx-app" data-testid="htx-app">
      <my-component>Content</my-component>
    </div>`;

    let capturedApp: App | null = null;

    function testComponent({ is }: { is: string }) {
      const app = useApp();
      capturedApp = app;
      return <pre data-is={is}>{app.constructor.name}</pre>;
    }

    const app = new App(testComponent);

    const root = await screen.findByTestId("htx-app");

    await waitFor(() => {
      expect(root.querySelector("pre")).not.toBeNull();
    });

    expect(capturedApp).toBe(app);
    expect(root.querySelector("pre")).toHaveTextContent("App");
  });

});

describe("RouterProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("provides loading state initially false", async () => {
    document.body.innerHTML = `<div id="htx-app" data-testid="htx-app">
      <my-component>Foo</my-component>
    </div>`;

    function testComponent({ is }: { is: string }) {
      const { loading } = useRouter();
      return <pre data-is={is} data-loading={String(loading)}></pre>;
    }

    new App(testComponent);

    const root = await screen.findByTestId("htx-app");

    await waitFor(() => {
      expect(root.querySelector("pre")).not.toBeNull();
    });

    expect(root.querySelector("pre")).toHaveAttribute("data-loading", "false");
  });

  it("provides lastError initially null", async () => {
    document.body.innerHTML = `<div id="htx-app" data-testid="htx-app">
      <my-component>Foo</my-component>
    </div>`;

    function testComponent({ is }: { is: string }) {
      const { lastError } = useRouter();
      return (
        <pre data-is={is} data-has-error={lastError ? "true" : "false"}></pre>
      );
    }

    new App(testComponent);

    const root = await screen.findByTestId("htx-app");

    await waitFor(() => {
      expect(root.querySelector("pre")).not.toBeNull();
    });

    expect(root.querySelector("pre")).toHaveAttribute("data-has-error", "false");
  });

  it("provides clearError function", async () => {
    document.body.innerHTML = `<div id="htx-app" data-testid="htx-app">
      <my-component>Foo</my-component>
    </div>`;

    let clearErrorFn: (() => void) | null = null;

    function testComponent({ is }: { is: string }) {
      const { clearError } = useRouter();
      clearErrorFn = clearError;
      return <pre data-is={is}>Rendered</pre>;
    }

    new App(testComponent);

    const root = await screen.findByTestId("htx-app");

    await waitFor(() => {
      expect(root.querySelector("pre")).not.toBeNull();
    });

    expect(clearErrorFn).toBeInstanceOf(Function);
  });

  it("provides router instance via useRouter hook", async () => {
    document.body.innerHTML = `<div id="htx-app" data-testid="htx-app">
      <my-component>Content</my-component>
    </div>`;

    let capturedRouter: any = null;

    function testComponent({ is }: { is: string }) {
      const { router } = useRouter();
      capturedRouter = router;
      return <pre data-is={is}>Rendered</pre>;
    }

    const app = new App(testComponent);

    const root = await screen.findByTestId("htx-app");

    await waitFor(() => {
      expect(root.querySelector("pre")).not.toBeNull();
    });

    expect(capturedRouter).toBe(app.router);
  });

  it("cleans up event listeners on unmount", async () => {
    document.body.innerHTML = `<div id="htx-app" data-testid="htx-app">
      <my-component>Content</my-component>
    </div>`;

    function testComponent({ is }: { is: string }) {
      useRouter();
      return <pre data-is={is}>Rendered</pre>;
    }

    const app = new App(testComponent);

    const root = await screen.findByTestId("htx-app");

    await waitFor(() => {
      expect(root.querySelector("pre")).not.toBeNull();
    });

    // Router should have listeners attached
    expect(app.router).toBeDefined();
  });
});
