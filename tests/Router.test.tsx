import { screen, waitFor, fireEvent } from "@testing-library/dom";
import { vi } from "vitest";
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

    // Give React a tick so the Provider's useEffect subscribes
    await act(async () => {});

    await waitFor(() => {
      expect(root.querySelector("pre")).not.toBeNull();
    });

    expect(root.querySelector("pre")).toHaveTextContent("Foo");
    expect(root.querySelector("pre")).toHaveAttribute("data-loading", "false");

    await fireEvent.click(root.querySelector("a"));

    expect(root.querySelector("pre")).toHaveAttribute("data-loading", "true");

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
      expect(root.querySelector("pre")).toHaveTextContent("Baa");
    });

    expect(root.querySelector("pre")).toHaveAttribute("data-loading", "false");
    expect(root.querySelector("pre")).toHaveTextContent("Baa");
  });
});
