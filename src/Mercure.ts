import { App } from "./App";

export type Handler<Args extends readonly unknown[]> = (...args: Args) => void;

export type MercureEventMap = {
  "sse:connected": [url: string];
  "sse:disconnected": [url: string];
  "sse:message": [event: MessageEvent, html: string];
  "render:success": [event: MessageEvent, html: string];
  "render:failed": [event: MessageEvent, html: string];
  "refetch:started": [event: MessageEvent];
  "refetch:success": [event: MessageEvent, html: string];
  "refetch:failed": [event: MessageEvent, error: Error];
  "sse:error": [error: Event];
};

export type MercureOptions = {
  /** The Mercure hub URL to connect to */
  hubUrl: string;
  /** Optional: Last-Event-ID for reconnection */
  lastEventId?: string;
  /** Optional: Whether to include credentials (cookies) */
  withCredentials?: boolean;
};

export class Mercure {
  private readonly app: App;
  private eventSource: EventSource | null = null;
  private listeners: Partial<
    Record<
      keyof MercureEventMap,
      Set<Handler<MercureEventMap[keyof MercureEventMap]>>
    >
  > = {};
  private currentUrl: string | null = null;
  private options: MercureOptions | null = null;
  private routerUnsubscribe: (() => void) | null = null;

  constructor(app: App) {
    this.app = app;
  }

  private ensureSet<K extends keyof MercureEventMap>(
    type: K,
  ): Set<Handler<MercureEventMap[K]>> {
    const existing = this.listeners[type] as
      | Set<Handler<MercureEventMap[K]>>
      | undefined;
    if (existing) return existing;

    const created = new Set<Handler<MercureEventMap[K]>>();
    this.listeners[type] = created as unknown as Set<
      Handler<MercureEventMap[keyof MercureEventMap]>
    >;
    return created;
  }

  protected emit<K extends keyof MercureEventMap>(
    type: K,
    ...args: MercureEventMap[K]
  ): void {
    this.listeners[type]?.forEach((h) => h(...args));
  }

  on<K extends keyof MercureEventMap>(
    type: K,
    handler: Handler<MercureEventMap[K]>,
  ): () => void {
    const set = this.ensureSet(type);
    set.add(handler);
    return () => this.off(type, handler);
  }

  off<K extends keyof MercureEventMap>(
    type: K,
    handler: Handler<MercureEventMap[K]>,
  ): void {
    this.listeners[type]?.delete(
      handler as Handler<MercureEventMap[keyof MercureEventMap]>,
    );
  }

  /**
   * Subscribe to a Mercure hub for real-time updates.
   * Automatically subscribes to the current pathname and re-subscribes on route changes.
   */
  subscribe(options: MercureOptions): void {
    // Store options for re-subscription
    this.options = options;

    // Unsubscribe from previous router listener
    if (this.routerUnsubscribe) {
      this.routerUnsubscribe();
    }

    // Listen to router navigation to re-subscribe with new pathname
    this.routerUnsubscribe = this.app.router.on("render:success", () => {
      this.connectToCurrentPath();
    });

    // Connect to current path
    this.connectToCurrentPath();
  }

  /**
   * Connect to EventSource with current pathname as topic
   */
  private connectToCurrentPath(): void {
    if (!this.options) return;

    // Close existing connection if any
    if (this.eventSource) {
      this.eventSource.close();
      if (this.currentUrl) {
        this.emit("sse:disconnected", this.currentUrl);
      }
      this.eventSource = null;
    }

    const { hubUrl, lastEventId, withCredentials = false } = this.options;

    // Build the subscription URL with current pathname as topic
    const url = new URL(hubUrl);
    const topic = window.location.pathname;
    url.searchParams.append("topic", topic);

    if (lastEventId) {
      url.searchParams.set("lastEventID", lastEventId);
    }

    this.currentUrl = url.toString();

    // Create EventSource connection
    this.eventSource = new EventSource(this.currentUrl, {
      withCredentials,
    });

    this.eventSource.onopen = () => {
      this.emit("sse:connected", this.currentUrl!);
    };

    this.eventSource.onmessage = async (event: MessageEvent) => {
      const html = event.data;
      this.emit("sse:message", event, html);

      // If message is empty or only whitespace, refetch the current route
      if (!html || html.trim() === "") {
        this.emit("refetch:started", event);
        try {
          const response = await this.app.router.visit(
            window.location.pathname + window.location.search,
            { method: "GET" },
            false, // Don't push state, we're already on this page
          );

          if (response.result) {
            this.emit("refetch:success", event, response.html);
          } else {
            this.emit("refetch:failed", event, new Error("Failed to render refetched content"));
          }
        } catch (error) {
          this.emit("refetch:failed", event, error as Error);
        }
        return;
      }

      // Process the HTML through the app's render method
      const result = this.app.render(html);

      if (result) {
        this.emit("render:success", event, html);
      } else {
        this.emit("render:failed", event, html);
      }
    };

    this.eventSource.onerror = (error: Event) => {
      this.emit("sse:error", error);

      // If the connection is closed, emit disconnected
      if (this.eventSource?.readyState === EventSource.CLOSED) {
        this.emit("sse:disconnected", this.currentUrl!);
      }
    };
  }

  /**
   * Close the SSE connection
   */
  close(): void {
    // Unsubscribe from router events
    if (this.routerUnsubscribe) {
      this.routerUnsubscribe();
      this.routerUnsubscribe = null;
    }

    if (this.eventSource) {
      this.eventSource.close();
      if (this.currentUrl) {
        this.emit("sse:disconnected", this.currentUrl);
      }
      this.eventSource = null;
      this.currentUrl = null;
    }

    this.options = null;
  }

  /**
   * Check if currently connected
   */
  get connected(): boolean {
    return this.eventSource?.readyState === EventSource.OPEN;
  }

  /**
   * Get the current connection URL
   */
  get url(): string | null {
    return this.currentUrl;
  }

  /**
   * Get the last event ID (useful for reconnection)
   */
  get lastEventId(): string | undefined {
    // EventSource doesn't expose lastEventId directly,
    // but you can track it via sse:message events
    return undefined;
  }
}
