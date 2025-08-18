import { screen, waitFor, fireEvent } from "@testing-library/dom";
import { vi } from "vitest";
import { App } from "../src";
import { ReactNode } from "react";

function testComponent({ is, children }: { is: string; children: ReactNode }) {
  return <pre data-is={is}>{children}</pre>;
}

describe("Test app router", () => {
  it("clicking on a link should fetch the content", async () => {
    document.body.innerHTML = `<div id="htx-app" data-testid="htx-app">
<my-component>Foo</my-component>
<a href="/api/data">Link</a>
</div>`;

    const fetchMock = vi.fn(() =>
      Promise.resolve({
        ok: true,
        text: () =>
          Promise.resolve(`<div id="htx-app" data-testid="htx-app">
<my-component>Baa</my-component>
<a href="/api/data">Link</a>
</div>`),
      }),
    );
    global.fetch = fetchMock as any;

    new App(testComponent);
    const root = await screen.findByTestId("htx-app");

    await waitFor(() => {
      expect(root.querySelector("pre")).not.toBeNull();
    });

    expect(root.querySelector("pre")).toHaveTextContent("Foo");

    fireEvent.click(root.querySelector("a"));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
      expect(root.querySelector("pre")).toHaveTextContent("Baa");
    });

    expect(root.querySelector("pre")).toHaveTextContent("Baa");
  });
});
