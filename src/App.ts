import { createRoot, Root } from "react-dom/client";
import React, { ElementType, PropsWithChildren } from "react";
import { AppProvider } from "./provider/AppProvider";
import { FetchLike, Router } from "./Router";
import { ReactolithComponent } from "./ReactolithComponent";

export type MercureConfig = {
  hubUrl: string;
  withCredentials?: boolean;
};

export class App {
  public readonly element: HTMLElement;
  public readonly router: Router;
  public readonly component: ElementType;
  public mercureConfig?: MercureConfig;
  private readonly appProvider: ElementType<PropsWithChildren<{ app: App }>>;
  private readonly selector: (doc: Document) => HTMLElement | null;
  private readonly root: Root;
  private readonly doc: Document;

  constructor(
    component: ElementType,
    appProvider: ElementType<PropsWithChildren<{ app: App }>> = AppProvider,
    selector: ((doc: Document) => HTMLElement | null) | string = "#reactolith-app",
    root?: Root,
    doc: Document = document,
    fetchImp: FetchLike = fetch,
  ) {
    this.router = new Router(this, doc, fetchImp);
    this.component = component;
    this.appProvider = appProvider;
    this.doc = doc;

    if (typeof selector === "string") {
      const selStr = selector;
      selector = (doc) => doc.querySelector(selStr);
    }
    this.selector = selector;

    const element = this.selector(doc);
    if (!element) {
      throw new Error(
        "Could not find root element in document. Please check your selector!",
      );
    }

    this.element = element;
    this.root = root || createRoot(this.element);

    // Auto-configure Mercure from data-mercure-hub-url attribute
    const mercureHubUrl = this.element.getAttribute("data-mercure-hub-url");
    if (mercureHubUrl) {
      this.mercureConfig = {
        hubUrl: mercureHubUrl,
        withCredentials: this.element.hasAttribute(
          "data-mercure-with-credentials",
        ),
      };
    }

    this.renderElement(this.element);
  }

  public render(document: string | Document): boolean {
    if (typeof document === "string") {
      const parser = new DOMParser();
      document = parser.parseFromString(document, "text/html");
    }

    // Try to find the root element in the document
    const element = this.selector(document);

    if (!element) {
      return false;
    }

    this.renderElement(element);

    return true;
  }

  public renderElement(element: HTMLElement): void {
    this.root.render(
      React.createElement(
        this.appProvider,
        {
          app: this,
        },
        Array.from(element.children)
          .filter((child) => child instanceof HTMLElement)
          .map((element, key) =>
            React.createElement(ReactolithComponent, {
              key,
              element,
              component: this.component,
            }),
          ),
      ),
    );
  }

  public unmount(): void {
    this.root.unmount();
  }
}
