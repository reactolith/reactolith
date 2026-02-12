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

describe("Router form submission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("handles GET form submission with query params", async () => {
    document.body.innerHTML = `<div id="reactolith-app" data-testid="reactolith-app">
      <my-component>Foo</my-component>
      <form action="/search" method="GET">
        <input type="text" name="query" default-value="test" read-only />
        <button type="submit">Search</button>
      </form>
    </div>`;

    const fetchMock = createFetchMock(`<div id="reactolith-app" data-testid="reactolith-app">
      <my-component>Results</my-component>
    </div>`);
    global.fetch = fetchMock as any;

    new App(testComponent);

    await act(async () => {});

    const root = await screen.findByTestId("reactolith-app");
    await waitFor(() => {
      expect(root.querySelector("pre")).not.toBeNull();
    });

    const form = root.querySelector("form")!;
    await fireEvent.submit(form);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/search?query=test", {
        method: "GET",
        body: null,
      });
    });
  });

  it("handles POST form submission with FormData body", async () => {
    document.body.innerHTML = `<div id="reactolith-app" data-testid="reactolith-app">
      <my-component>Foo</my-component>
      <form action="/submit" method="POST">
        <input type="text" name="username" default-value="john" read-only />
        <button type="submit">Submit</button>
      </form>
    </div>`;

    const fetchMock = createFetchMock(`<div id="reactolith-app" data-testid="reactolith-app">
      <my-component>Submitted</my-component>
    </div>`);
    global.fetch = fetchMock as any;

    new App(testComponent);

    await act(async () => {});

    const root = await screen.findByTestId("reactolith-app");
    await waitFor(() => {
      expect(root.querySelector("pre")).not.toBeNull();
    });

    const form = root.querySelector("form")!;
    await fireEvent.submit(form);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("/submit");
      expect(init.method).toBe("POST");
      expect(init.body).toBeInstanceOf(FormData);
      expect((init.body as FormData).get("username")).toBe("john");
    });
  });

  it("appends form action to existing query params", async () => {
    document.body.innerHTML = `<div id="reactolith-app" data-testid="reactolith-app">
      <my-component>Foo</my-component>
      <form action="/search?page=1" method="GET">
        <input type="text" name="query" default-value="test" read-only />
        <button type="submit">Search</button>
      </form>
    </div>`;

    const fetchMock = createFetchMock(`<div id="reactolith-app" data-testid="reactolith-app">
      <my-component>Results</my-component>
    </div>`);
    global.fetch = fetchMock as any;

    new App(testComponent);

    await act(async () => {});

    const root = await screen.findByTestId("reactolith-app");
    await waitFor(() => {
      expect(root.querySelector("pre")).not.toBeNull();
    });

    const form = root.querySelector("form")!;
    await fireEvent.submit(form);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/search?page=1&query=test", {
        method: "GET",
        body: null,
      });
    });
  });

  it("includes submitter button value in form data", async () => {
    document.body.innerHTML = `<div id="reactolith-app" data-testid="reactolith-app">
      <my-component>Foo</my-component>
      <form action="/action" method="POST">
        <input type="text" name="data" default-value="test" read-only />
        <button type="submit" name="action" value="save">Save</button>
        <button type="submit" name="action" value="delete">Delete</button>
      </form>
    </div>`;

    const fetchMock = createFetchMock(`<div id="reactolith-app" data-testid="reactolith-app">
      <my-component>Done</my-component>
    </div>`);
    global.fetch = fetchMock as any;

    new App(testComponent);

    await act(async () => {});

    const root = await screen.findByTestId("reactolith-app");
    await waitFor(() => {
      expect(root.querySelector("pre")).not.toBeNull();
    });

    const form = root.querySelector("form")!;
    const saveButton = root.querySelector(
      'button[value="save"]',
    ) as HTMLButtonElement;

    // Create a submit event with the submitter
    const submitEvent = new Event("submit", {
      bubbles: true,
      cancelable: true,
    }) as SubmitEvent;
    Object.defineProperty(submitEvent, "submitter", { value: saveButton });

    form.dispatchEvent(submitEvent);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
      const [, init] = fetchMock.mock.calls[0];
      const formData = init.body as FormData;
      expect(formData.get("action")).toBe("save");
    });
  });

  it("uses current location for forms without action", async () => {
    document.body.innerHTML = `<div id="reactolith-app" data-testid="reactolith-app">
      <my-component>Foo</my-component>
      <form method="GET">
        <input type="text" name="query" default-value="test" read-only />
        <button type="submit">Search</button>
      </form>
    </div>`;

    const fetchMock = createFetchMock(`<div id="reactolith-app" data-testid="reactolith-app">
      <my-component>Results</my-component>
    </div>`);
    global.fetch = fetchMock as any;

    new App(testComponent);

    await act(async () => {});

    const root = await screen.findByTestId("reactolith-app");
    await waitFor(() => {
      expect(root.querySelector("pre")).not.toBeNull();
    });

    const form = root.querySelector("form")!;
    await fireEvent.submit(form);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
      // Should use empty string which becomes current location
      const [url] = fetchMock.mock.calls[0];
      expect(url).toBe("?query=test");
    });
  });

  it("ignores forms with target other than _self", async () => {
    document.body.innerHTML = `<div id="reactolith-app" data-testid="reactolith-app">
      <my-component>Foo</my-component>
      <form action="/external" method="POST" target="_blank">
        <button type="submit">Submit</button>
      </form>
    </div>`;

    const fetchMock = createFetchMock(`<div id="reactolith-app">
      <my-component>Done</my-component>
    </div>`);
    global.fetch = fetchMock as any;

    new App(testComponent);

    await act(async () => {});

    const root = await screen.findByTestId("reactolith-app");
    await waitFor(() => {
      expect(root.querySelector("pre")).not.toBeNull();
    });

    const form = root.querySelector("form")!;

    // Form should not be intercepted due to target="_blank"
    const submitEvent = new Event("submit", {
      bubbles: true,
      cancelable: true,
    });
    form.dispatchEvent(submitEvent);

    // fetchMock should not be called because form has target="_blank"
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("ignores forms with absolute action URLs", async () => {
    document.body.innerHTML = `<div id="reactolith-app" data-testid="reactolith-app">
      <my-component>Foo</my-component>
      <form action="https://external.com/submit" method="POST">
        <button type="submit">Submit</button>
      </form>
    </div>`;

    const fetchMock = createFetchMock(`<div id="reactolith-app">
      <my-component>Done</my-component>
    </div>`);
    global.fetch = fetchMock as any;

    new App(testComponent);

    await act(async () => {});

    const root = await screen.findByTestId("reactolith-app");
    await waitFor(() => {
      expect(root.querySelector("pre")).not.toBeNull();
    });

    const form = root.querySelector("form")!;
    const submitEvent = new Event("submit", {
      bubbles: true,
      cancelable: true,
    });
    form.dispatchEvent(submitEvent);

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
