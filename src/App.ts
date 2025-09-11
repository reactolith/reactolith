import { createRoot, Root } from "react-dom/client";
import React, { ElementType, PropsWithChildren } from "react";
import { AppProvider } from "./provider/AppProvider";
import { FetchLike, Router } from "./Router";
import { HtxComponent } from "./HtxComponent";

export class App {
  public readonly element: HTMLElement;
  public readonly router: Router;
  public readonly component: ElementType;
  private readonly appProvider: ElementType<PropsWithChildren<{ app: App }>>;
  private readonly selector: (doc: Document) => HTMLElement | null;
  private readonly root: Root;

  constructor(
    component: ElementType,
    appProvider: ElementType<PropsWithChildren<{ app: App }>> = AppProvider,
    selector: ((doc: Document) => HTMLElement | null) | string = "#htx-app",
    root?: Root,
    doc: Document = document,
    fetchImp: FetchLike = fetch,
  ) {
    this.router = new Router(this, doc, fetchImp);
    this.component = component;
    this.appProvider = appProvider;

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
            React.createElement(HtxComponent, {
              key,
              element,
              component: this.component,
            }),
          ),
      ),
    );
  }
}
