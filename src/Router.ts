import { App } from "./App";
import { Href } from "@react-types/shared";

export type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export type Handler<Args extends readonly unknown[]> = (...args: Args) => void;

export type RouterEventMap = {
  "nav:started": [input: URL | string, init: RequestInit, pushState: boolean];
  "nav:ended": [
    input: URL | string,
    init: RequestInit,
    pushState: boolean,
    response: Response,
    html: string,
  ];
};

export class Router {
  private readonly app: App;
  private readonly fetch: FetchLike;
  private listeners: Partial<
    Record<
      keyof RouterEventMap,
      Set<Handler<RouterEventMap[keyof RouterEventMap]>>
    >
  > = {};

  constructor(
    app: App,
    doc: Document = document,
    fetchImpl: FetchLike = fetch,
  ) {
    this.app = app;
    this.fetch = (input, init) => fetchImpl(input, init);

    if (doc.defaultView) {
      doc.defaultView.addEventListener("popstate", async () => {
        await this.visit(
          location.pathname + location.search,
          { method: "GET" },
          false,
        );
      });
    }

    doc.addEventListener("click", async (event) => {
      const link = (event.target as HTMLElement).closest("a");
      if (!link) {
        return;
      }
      const href = link.getAttribute("href");
      if (
        !href ||
        href.startsWith("http") ||
        href.startsWith("#") ||
        link.target === "_blank"
      ) {
        return;
      }
      event.preventDefault();
      await this.visit(href);
    });

    doc.addEventListener("submit", async (event) => {
      const form = event.target as HTMLFormElement;
      if (!form.action || form.target === "_blank") {
        return;
      }

      event.preventDefault();
      const formData = new FormData(form);
      const method = (form.method || "GET").toUpperCase();
      let body: BodyInit | null = null;
      let url = form.action;

      if (method === "GET") {
        const params = new URLSearchParams(
          Array.from(formData.entries()) as [string, string][],
        ).toString();
        url = url.includes("?") ? `${url}&${params}` : `${url}?${params}`;
      } else {
        body = formData;
      }

      await this.visit(url, { method, body });
    });
  }

  private ensureSet<K extends keyof RouterEventMap>(
    type: K,
  ): Set<Handler<RouterEventMap[K]>> {
    const existing = this.listeners[type] as
      | Set<Handler<RouterEventMap[K]>>
      | undefined;
    if (existing) return existing;

    const created = new Set<Handler<RouterEventMap[K]>>();
    // Upcast to the union that the field allows; no `any`.
    this.listeners[type] = created as unknown as Set<
      Handler<RouterEventMap[keyof RouterEventMap]>
    >;
    return created;
  }

  protected emit<K extends keyof RouterEventMap>(
    type: K,
    ...args: RouterEventMap[K]
  ): void {
    this.listeners[type]?.forEach((h) => h(...args));
  }

  on<K extends keyof RouterEventMap>(
    type: K,
    handler: Handler<RouterEventMap[K]>,
  ): () => void {
    const set = this.ensureSet(type);
    set.add(handler);
    return () => this.off(type, handler);
  }

  off<K extends keyof RouterEventMap>(
    type: K,
    handler: Handler<RouterEventMap[K]>,
  ): void {
    this.listeners[type]?.delete(
      handler as Handler<RouterEventMap[keyof RouterEventMap]>,
    );
  }

  public async visit(
    input: URL | string,
    init: RequestInit = { method: "GET" },
    pushState: boolean = true,
  ): Promise<boolean> {
    this.emit("nav:started", input, init, pushState);
    const response = await this.fetch(input, init);
    const html = await response.text();

    const original = typeof input === "string" ? input : input.toString();
    const finalUrl = response.redirected ? response.url : original;

    if (pushState) {
      history.pushState({}, "", finalUrl);
    }

    const result = this.app.render(html);
    this.emit("nav:ended", input, init, pushState, response, html);
    return result;
  }

  public async navigate(path: Href): Promise<void> {
    await this.visit(path);
  }
}
