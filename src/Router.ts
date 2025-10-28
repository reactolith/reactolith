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
    finalUrl: string,
  ];
  "render:success": [
    input: URL | string,
    init: RequestInit,
    pushState: boolean,
    response: Response,
    html: string,
    finalUrl: string,
  ];
  "render:failed": [
    input: URL | string,
    init: RequestInit,
    pushState: boolean,
    response: Response,
    html: string,
    finalUrl: string,
  ];
};

export const isRelativeHref = (href: string | null): href is string => {
  if (!href) return false;
  if (href.startsWith("#")) return false;
  if (href.startsWith("//")) return false;
  return !/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(href);
};

export const hasNavBypassModifiers = (e: MouseEvent) =>
  e.defaultPrevented ||
  e.button !== 0 ||
  e.metaKey ||
  e.ctrlKey ||
  e.shiftKey ||
  e.altKey;

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

    doc.addEventListener("click", (e) => this.onClick(e));
    doc.addEventListener("submit", (e) => this.onSubmit(e));
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
  ): Promise<{
    result: boolean;
    response: Response;
    html: string;
    finalUrl: string;
  }> {
    this.emit("nav:started", input, init, pushState);
    const response = await this.fetch(input, init);
    const html = await response.text();

    const original = typeof input === "string" ? input : input.toString();
    const finalUrl = response.redirected ? response.url : original;
    const result = this.app.render(html);

    if (result && pushState) {
      history.pushState({}, "", finalUrl);
    }

    const event = result ? "render:success" : "render:failed";
    this.emit(event, input, init, pushState, response, html, finalUrl);
    this.emit("nav:ended", input, init, pushState, response, html, finalUrl);
    return { result, response, html, finalUrl };
  }

  public async onClick(event: MouseEvent) {
    // Ignore modified clicks, right/middle clicks, already-handled events
    if (hasNavBypassModifiers(event)) return;

    const link = (event.target as HTMLElement | null)?.closest("a");
    if (!link) return;

    const hrefAttr = link.getAttribute("href");
    if (!isRelativeHref(hrefAttr)) return;

    // Respect targets like _blank or any non-_self
    if (link.target && link.target.toLowerCase() !== "_self") return;

    // Respect downloads and explicit external hints
    if (link.hasAttribute("download")) return;
    const rel = link.getAttribute("rel") || "";
    if (/\bexternal\b/i.test(rel)) return;

    event.preventDefault();
    event.stopPropagation();

    await this.visit(hrefAttr);
  }

  public async onSubmit(event: SubmitEvent) {
    const form = event.target as HTMLFormElement;
    if (!form) return;

    const actionAttr = form.getAttribute("action");
    const isRelativeAction = actionAttr === null || isRelativeHref(actionAttr);

    if (form.target && form.target.toLowerCase() !== "_self") return;
    if (!isRelativeAction) return;

    event.preventDefault();
    event.stopPropagation();

    const formData = new FormData(form);

    if (event.submitter instanceof HTMLButtonElement && event.submitter.name) {
      formData.append(event.submitter.name, event.submitter.value || "");
    }

    const method = (form.method || "GET").toUpperCase();
    let body: BodyInit | null = null;
    let url = actionAttr ?? "";

    if (method === "GET") {
      const params = new URLSearchParams();
      formData.forEach((value, key) => {
        if (typeof value === "string") params.append(key, value);
      });
      const q = params.toString();
      const sep = url.includes("?") ? (q ? "&" : "") : q ? "?" : "";
      url = `${url}${sep}${q}`;
    } else {
      body = formData;
    }

    await this.visit(url || location.pathname + location.search, {
      method,
      body,
    });
  }

  public async navigate(path: Href): Promise<void> {
    await this.visit(path);
  }
}
