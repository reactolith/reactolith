import { screen, waitFor } from "@testing-library/dom";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { App } from "../src";
import { ReactNode } from "react";

function testComponent({ is, children }: { is: string; children: ReactNode }) {
  return <pre data-is={is}>{children}</pre>;
}

describe("App error handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws error when root element is not found", () => {
    document.body.innerHTML = `<div id="other-app">
      <h1>Not the app</h1>
    </div>`;

    expect(() => {
      new App(testComponent);
    }).toThrow(
      "Could not find root element in document. Please check your selector!",
    );
  });

  it("throws error with custom selector that doesn't match", () => {
    document.body.innerHTML = `<div id="reactolith-app">
      <h1>App</h1>
    </div>`;

    expect(() => {
      new App(testComponent, undefined, "#non-existent");
    }).toThrow(
      "Could not find root element in document. Please check your selector!",
    );
  });

  it("works with custom selector function", async () => {
    document.body.innerHTML = `<div data-app="custom" data-testid="custom-app">
      <my-component>Custom</my-component>
    </div>`;

    new App(testComponent, undefined, (doc) =>
      doc.querySelector('[data-app="custom"]'),
    );

    const root = await screen.findByTestId("custom-app");

    await waitFor(() => {
      expect(root.querySelector("pre")).not.toBeNull();
    });

    expect(root.querySelector("pre")).toHaveTextContent("Custom");
  });

  it("render() returns false when new document has no root", async () => {
    document.body.innerHTML = `<div id="reactolith-app" data-testid="reactolith-app">
      <my-component>Original</my-component>
    </div>`;

    const app = new App(testComponent);

    const root = await screen.findByTestId("reactolith-app");
    await waitFor(() => {
      expect(root.querySelector("pre")).not.toBeNull();
    });

    // Try to render HTML without the root element
    const result = app.render(`<div id="other">
      <my-component>New</my-component>
    </div>`);

    expect(result).toBe(false);
    // Original content should remain
    expect(root.querySelector("pre")).toHaveTextContent("Original");
  });

  it("render() returns true when successful", async () => {
    document.body.innerHTML = `<div id="reactolith-app" data-testid="reactolith-app">
      <my-component>Original</my-component>
    </div>`;

    const app = new App(testComponent);

    const root = await screen.findByTestId("reactolith-app");
    await waitFor(() => {
      expect(root.querySelector("pre")).not.toBeNull();
    });

    const result = app.render(`<div id="reactolith-app">
      <my-component>Updated</my-component>
    </div>`);

    expect(result).toBe(true);

    await waitFor(() => {
      expect(root.querySelector("pre")).toHaveTextContent("Updated");
    });
  });

  it("render() accepts Document object", async () => {
    document.body.innerHTML = `<div id="reactolith-app" data-testid="reactolith-app">
      <my-component>Original</my-component>
    </div>`;

    const app = new App(testComponent);

    const root = await screen.findByTestId("reactolith-app");
    await waitFor(() => {
      expect(root.querySelector("pre")).not.toBeNull();
    });

    // Create a new document
    const parser = new DOMParser();
    const newDoc = parser.parseFromString(
      `<html><body><div id="reactolith-app"><my-component>FromDoc</my-component></div></body></html>`,
      "text/html",
    );

    const result = app.render(newDoc);
    expect(result).toBe(true);

    await waitFor(() => {
      expect(root.querySelector("pre")).toHaveTextContent("FromDoc");
    });
  });

  it("filters out non-HTMLElement children", async () => {
    document.body.innerHTML = `<div id="reactolith-app" data-testid="reactolith-app">
      <!-- This is a comment -->
      <my-component>Content</my-component>
      Text node here
    </div>`;

    new App(testComponent);

    const root = await screen.findByTestId("reactolith-app");

    await waitFor(() => {
      expect(root.querySelector("pre")).not.toBeNull();
    });

    // Only the my-component should be rendered
    expect(root.querySelectorAll("pre").length).toBe(1);
  });
});
