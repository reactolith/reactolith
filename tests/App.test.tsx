import { screen, waitFor } from "@testing-library/dom";
import { App } from "../src";
import { ReactNode, ElementType } from "react";

function testComponent({ is, children }: { is: string; children: ReactNode }) {
  return <pre data-is={is}>{children}</pre>;
}

function testRoot({ app }: { app: App }) {
  return <div>{app.constructor.name}</div>;
}

function testPropAndSlotComponent({
  enabled,
  name,
  dataFoo,
  rows,
  header,
  footer,
  as,
}: {
  name: string;
  dataFoo: string;
  enabled: boolean;
  rows: { label: string; value: string }[];
  header: ReactNode;
  footer: ReactNode;
}) {
  return (
    <article name={name} foo={dataFoo}>
      {header}
      {enabled && <h2>ENABLED</h2>}
      <dl>
        {rows.map((row, index) => (
          <div key={index}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
      <footer>{footer}</footer>
    </article>
  );
}

describe("Test mounting an app", () => {
  it("Maps every custom html element to a pre-tag", async () => {
    document.body.innerHTML = `
<div id="htx-app" data-testid="htx-app">

    <h1>My test react app</h1>
    <ui-button>Test Button 1</ui-button>
    <ui-custom></ui-custom>
</div>`;

    new App(testComponent);
    const root = await screen.findByTestId("htx-app");

    await waitFor(() => {
      expect(root.querySelector("pre")).not.toBeNull();
    });

    expect(root.querySelector('pre[data-is="ui-button"]')).not.toBeNull();
    expect(root.querySelector('pre[data-is="ui-custom"]')).not.toBeNull();
    expect(root.querySelector('pre[data-is="ui-button"]')).toHaveTextContent(
      "Test Button 1",
    );
    expect(
      root.querySelector('pre[data-is="ui-custom"]'),
    ).toBeEmptyDOMElement();
  });

  it("Renders just a custom root element", async () => {
    document.body.innerHTML = '<div data-testid="htx-app"></div>';

    new App(testComponent, testRoot, '[data-testid="htx-app"]');
    const root = await screen.findByTestId("htx-app");

    await waitFor(() => {
      expect(root).not.toBeEmptyDOMElement();
    });

    expect(root.querySelector("div")).toHaveTextContent("App");
  });

  it("Maps all props as expected", async () => {
    document.body.innerHTML = `
<div id="htx-app" data-testid="htx-app" class="hidden">
    <my-comp key="fo" enabled name="test" data-foo="baa" as="{div}" json-rows='[{ "label": "Foo", "value": "Baa" }, { "label": "Foo1", "value": "Baa1" }]'>
        This text will be discarded.
        <h1 slot="header">HEADER</h1>
        <template slot="footer"><h4>FOOTER!</h4><h5>Other element</h5></template>
    </my-comp>
</div>`;

    new App(testPropAndSlotComponent);
    const root = await screen.findByTestId("htx-app");
    expect(root).toHaveAttribute("class", "hidden");

    await waitFor(() => {
      expect(root.querySelector("article")).not.toBeNull();
      expect(root).not.toHaveAttribute("class", "hidden");
    });

    expect(root.querySelector("article")).toHaveAttribute("name", "test");
    expect(root.querySelector("article")).toHaveAttribute("foo", "baa");
    expect(root.querySelector("article h2")).not.toBeNull();
    expect(root.querySelector("article dl")).not.toBeNull();
    expect(
      root.querySelector("article dl div:first-child dt"),
    ).toHaveTextContent("Foo");
    expect(
      root.querySelector("article dl div:last-child dd"),
    ).toHaveTextContent("Baa1");

    expect(root.querySelector("article h1")).toBeNull();
    expect(root.querySelector("article")).toHaveTextContent("HEADER");
    expect(root.querySelector("article footer h4")).toHaveTextContent(
      "FOOTER!",
    );
  });
});
