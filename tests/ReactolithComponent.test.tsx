import { screen, waitFor } from "@testing-library/dom";
import { describe, it, expect } from "vitest";
import { App } from "../src";
import { ReactNode } from "react";

function testComponent({ is, children }: { is: string; children: ReactNode }) {
  return <pre data-is={is}>{children}</pre>;
}

describe("ReactolithComponent HTML to React transformation", () => {
  describe("Native HTML elements", () => {
    it("renders native HTML elements without transformation", async () => {
      document.body.innerHTML = `<div id="reactolith-app" data-testid="reactolith-app">
        <div class="container">
          <h1>Title</h1>
          <p>Paragraph</p>
        </div>
      </div>`;

      new App(testComponent);

      const root = await screen.findByTestId("reactolith-app");

      await waitFor(() => {
        expect(root.querySelector("div.container")).not.toBeNull();
      });

      expect(root.querySelector("h1")).toHaveTextContent("Title");
      expect(root.querySelector("p")).toHaveTextContent("Paragraph");
    });

    it("transforms class to className for native elements", async () => {
      document.body.innerHTML = `<div id="reactolith-app" data-testid="reactolith-app">
        <div class="my-class another-class">Content</div>
      </div>`;

      new App(testComponent);

      const root = await screen.findByTestId("reactolith-app");

      await waitFor(() => {
        expect(root.querySelector(".my-class")).not.toBeNull();
      });

      expect(root.querySelector("div.my-class")).toHaveClass("another-class");
    });

    it("passes data-* attributes to native elements", async () => {
      document.body.innerHTML = `<div id="reactolith-app" data-testid="reactolith-app">
        <button data-action="submit" data-id="123">Click</button>
      </div>`;

      new App(testComponent);

      const root = await screen.findByTestId("reactolith-app");

      await waitFor(() => {
        expect(root.querySelector("button")).not.toBeNull();
      });

      expect(root.querySelector("button")).toHaveAttribute(
        "data-action",
        "submit",
      );
      expect(root.querySelector("button")).toHaveAttribute("data-id", "123");
    });
  });

  describe("Custom elements", () => {
    it("detects custom elements by hyphen in tag name", async () => {
      document.body.innerHTML = `<div id="reactolith-app" data-testid="reactolith-app">
        <custom-button>Click</custom-button>
      </div>`;

      new App(testComponent);

      const root = await screen.findByTestId("reactolith-app");

      await waitFor(() => {
        expect(root.querySelector('pre[data-is="custom-button"]')).not.toBeNull();
      });
    });

    it("converts empty attributes to boolean true", async () => {
      document.body.innerHTML = `<div id="reactolith-app" data-testid="reactolith-app">
        <my-button disabled>Click</my-button>
      </div>`;

      function boolTestComponent({
        is,
        disabled,
      }: {
        is: string;
        disabled: boolean;
      }) {
        return (
          <button data-is={is} disabled={disabled}>
            {disabled ? "Disabled" : "Enabled"}
          </button>
        );
      }

      new App(boolTestComponent);

      const root = await screen.findByTestId("reactolith-app");

      await waitFor(() => {
        expect(root.querySelector("button")).not.toBeNull();
      });

      expect(root.querySelector("button")).toHaveTextContent("Disabled");
      expect(root.querySelector("button")).toBeDisabled();
    });

    it("parses json-* attributes as JSON", async () => {
      document.body.innerHTML = `<div id="reactolith-app" data-testid="reactolith-app">
        <my-list json-items='["a", "b", "c"]'>List</my-list>
      </div>`;

      function listComponent({
        is,
        items,
      }: {
        is: string;
        items: string[];
      }) {
        return (
          <ul data-is={is}>
            {items.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        );
      }

      new App(listComponent);

      const root = await screen.findByTestId("reactolith-app");

      await waitFor(() => {
        expect(root.querySelector("ul")).not.toBeNull();
      });

      expect(root.querySelectorAll("li").length).toBe(3);
      expect(root.querySelectorAll("li")[0]).toHaveTextContent("a");
    });

    it("normalizes attribute names to camelCase", async () => {
      document.body.innerHTML = `<div id="reactolith-app" data-testid="reactolith-app">
        <my-input place-holder="Enter text" max-length="100">Input</my-input>
      </div>`;

      function inputComponent({
        is,
        placeHolder,
        maxLength,
      }: {
        is: string;
        placeHolder: string;
        maxLength: string;
      }) {
        return (
          <div data-is={is}>
            <span data-placeholder={placeHolder}></span>
            <span data-maxlength={maxLength}></span>
          </div>
        );
      }

      new App(inputComponent);

      const root = await screen.findByTestId("reactolith-app");

      await waitFor(() => {
        expect(root.querySelector('[data-placeholder="Enter text"]')).not.toBeNull();
      });

      expect(root.querySelector('[data-maxlength="100"]')).not.toBeNull();
    });

    it("handles component references via as={...} syntax", async () => {
      document.body.innerHTML = `<div id="reactolith-app" data-testid="reactolith-app">
        <my-wrapper as="{custom-component}">Content</my-wrapper>
      </div>`;

      function wrapperComponent({
        is,
        as: AsComponent,
        children,
      }: {
        is: string;
        as: ReactNode;
        children: ReactNode;
      }) {
        return (
          <div data-is={is}>
            {AsComponent}
            {children}
          </div>
        );
      }

      new App(wrapperComponent);

      const root = await screen.findByTestId("reactolith-app");

      await waitFor(() => {
        expect(root.querySelector('[data-is="my-wrapper"]')).not.toBeNull();
      });

      // The as prop should be transformed to a component reference
      expect(root.querySelector('[data-is="custom-component"]')).not.toBeNull();
    });
  });

  describe("Slots", () => {
    it("handles named slots from regular elements", async () => {
      document.body.innerHTML = `<div id="reactolith-app" data-testid="reactolith-app">
        <my-card>
          <h1 slot="title">Card Title</h1>
          <p>Card content</p>
        </my-card>
      </div>`;

      function cardComponent({
        is,
        title,
        children,
      }: {
        is: string;
        title: ReactNode[];
        children: ReactNode;
      }) {
        return (
          <article data-is={is}>
            <header>{title}</header>
            <main>{children}</main>
          </article>
        );
      }

      new App(cardComponent);

      const root = await screen.findByTestId("reactolith-app");

      await waitFor(() => {
        expect(root.querySelector("article")).not.toBeNull();
      });

      // Slots extract the content of the slot element, so the h1 content is in header
      expect(root.querySelector("header")).toHaveTextContent("Card Title");
      expect(root.querySelector("main p")).toHaveTextContent("Card content");
    });

    it("handles template slots with multiple children", async () => {
      document.body.innerHTML = `<div id="reactolith-app" data-testid="reactolith-app">
        <my-modal>
          <template slot="footer">
            <button>Cancel</button>
            <button>OK</button>
          </template>
          <p>Modal content</p>
        </my-modal>
      </div>`;

      function modalComponent({
        is,
        footer,
        children,
      }: {
        is: string;
        footer: ReactNode[];
        children: ReactNode;
      }) {
        return (
          <div data-is={is}>
            <div className="content">{children}</div>
            <div className="footer">{footer}</div>
          </div>
        );
      }

      new App(modalComponent);

      const root = await screen.findByTestId("reactolith-app");

      await waitFor(() => {
        expect(root.querySelector('[data-is="my-modal"]')).not.toBeNull();
      });

      expect(root.querySelectorAll(".footer button").length).toBe(2);
      expect(root.querySelector(".content p")).toHaveTextContent("Modal content");
    });
  });

  describe("Children and text nodes", () => {
    it("handles text nodes correctly", async () => {
      document.body.innerHTML = `<div id="reactolith-app" data-testid="reactolith-app">
        <my-text>
          Some text
          <span>and element</span>
          more text
        </my-text>
      </div>`;

      function textComponent({
        is,
        children,
      }: {
        is: string;
        children: ReactNode;
      }) {
        return <div data-is={is}>{children}</div>;
      }

      new App(textComponent);

      const root = await screen.findByTestId("reactolith-app");

      await waitFor(() => {
        expect(root.querySelector('[data-is="my-text"]')).not.toBeNull();
      });

      const textDiv = root.querySelector('[data-is="my-text"]')!;
      expect(textDiv.textContent).toContain("Some text");
      expect(textDiv.textContent).toContain("and element");
      expect(textDiv.textContent).toContain("more text");
    });

    it("handles nested custom elements", async () => {
      document.body.innerHTML = `<div id="reactolith-app" data-testid="reactolith-app">
        <my-outer>
          <my-inner>Nested</my-inner>
        </my-outer>
      </div>`;

      new App(testComponent);

      const root = await screen.findByTestId("reactolith-app");

      await waitFor(() => {
        expect(root.querySelector('[data-is="my-outer"]')).not.toBeNull();
      });

      expect(root.querySelector('[data-is="my-inner"]')).not.toBeNull();
      expect(root.querySelector('[data-is="my-inner"]')).toHaveTextContent(
        "Nested",
      );
    });

    it("uses key attribute when provided", async () => {
      document.body.innerHTML = `<div id="reactolith-app" data-testid="reactolith-app">
        <my-list>
          <my-item key="item-1">First</my-item>
          <my-item key="item-2">Second</my-item>
        </my-list>
      </div>`;

      new App(testComponent);

      const root = await screen.findByTestId("reactolith-app");

      await waitFor(() => {
        expect(root.querySelectorAll('[data-is="my-item"]').length).toBe(2);
      });
    });

    it("ignores attributes starting with #", async () => {
      document.body.innerHTML = `<div id="reactolith-app" data-testid="reactolith-app">
        <my-component #internal="value" name="test">Content</my-component>
      </div>`;

      function propsComponent({
        is,
        name,
        internal,
      }: {
        is: string;
        name: string;
        internal?: string;
      }) {
        return (
          <div data-is={is} data-name={name} data-internal={internal || "none"}>
            Content
          </div>
        );
      }

      new App(propsComponent);

      const root = await screen.findByTestId("reactolith-app");

      await waitFor(() => {
        expect(root.querySelector('[data-is="my-component"]')).not.toBeNull();
      });

      expect(root.querySelector('[data-name="test"]')).not.toBeNull();
      expect(root.querySelector('[data-internal="none"]')).not.toBeNull();
    });
  });

  describe("Edge cases", () => {
    it("handles empty element", async () => {
      document.body.innerHTML = `<div id="reactolith-app" data-testid="reactolith-app">
        <my-empty></my-empty>
      </div>`;

      new App(testComponent);

      const root = await screen.findByTestId("reactolith-app");

      await waitFor(() => {
        expect(root.querySelector('[data-is="my-empty"]')).not.toBeNull();
      });

      expect(root.querySelector('[data-is="my-empty"]')).toBeEmptyDOMElement();
    });

    it("handles self-closing native elements", async () => {
      document.body.innerHTML = `<div id="reactolith-app" data-testid="reactolith-app">
        <div>
          <img src="test.jpg" alt="Test" />
          <br />
          <input type="text" />
        </div>
      </div>`;

      new App(testComponent);

      const root = await screen.findByTestId("reactolith-app");

      await waitFor(() => {
        expect(root.querySelector("img")).not.toBeNull();
      });

      expect(root.querySelector("img")).toHaveAttribute("src", "test.jpg");
      expect(root.querySelector("input")).toHaveAttribute("type", "text");
    });

    it("returns null when element is undefined", async () => {
      document.body.innerHTML = `<div id="reactolith-app" data-testid="reactolith-app">
        <my-component>Content</my-component>
      </div>`;

      new App(testComponent);

      const root = await screen.findByTestId("reactolith-app");

      await waitFor(() => {
        expect(root.querySelector("pre")).not.toBeNull();
      });
    });
  });
});
