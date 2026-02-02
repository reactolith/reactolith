import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { generateWebTypes } from "../src/cli/GenerateWebTypes";
import fs from "fs";
import path from "path";

describe("generateWebTypes", () => {
  const fixturesDir = path.join(__dirname, "fixtures");
  const componentsDir = path.join(fixturesDir, "components");
  const outFile = path.join(fixturesDir, "test-web-types.json");
  const tsconfig = path.join(fixturesDir, "tsconfig.json");

  afterEach(() => {
    // Clean up generated file after each test
    if (fs.existsSync(outFile)) {
      fs.unlinkSync(outFile);
    }
  });

  it("generates web-types.json file", () => {
    generateWebTypes({
      componentsDir,
      outFile,
      tsconfig,
      libraryName: "test-components",
      libraryVersion: "1.0.0",
    });

    expect(fs.existsSync(outFile)).toBe(true);
  });

  it("generates correct structure", () => {
    generateWebTypes({
      componentsDir,
      outFile,
      tsconfig,
      libraryName: "test-components",
      libraryVersion: "1.0.0",
    });

    const content = JSON.parse(fs.readFileSync(outFile, "utf-8"));

    expect(content).toHaveProperty("$schema");
    expect(content).toHaveProperty("name", "test-components");
    expect(content).toHaveProperty("version", "1.0.0");
    expect(content).toHaveProperty("contributions");
    expect(content.contributions).toHaveProperty("html");
    expect(content.contributions.html).toHaveProperty("elements");
    expect(Array.isArray(content.contributions.html.elements)).toBe(true);
  });

  it("extracts components from exported Props types", () => {
    generateWebTypes({
      componentsDir,
      outFile,
      tsconfig,
    });

    const content = JSON.parse(fs.readFileSync(outFile, "utf-8"));
    const elements = content.contributions.html.elements;

    const button = elements.find((el: any) => el.name === "button");
    expect(button).toBeDefined();
    expect(button.description).toContain("Button");
  });

  it("extracts components from arrow functions", () => {
    generateWebTypes({
      componentsDir,
      outFile,
      tsconfig,
    });

    const content = JSON.parse(fs.readFileSync(outFile, "utf-8"));
    const elements = content.contributions.html.elements;

    const card = elements.find((el: any) => el.name === "card");
    expect(card).toBeDefined();
  });

  it("extracts components from default exports", () => {
    generateWebTypes({
      componentsDir,
      outFile,
      tsconfig,
    });

    const content = JSON.parse(fs.readFileSync(outFile, "utf-8"));
    const elements = content.contributions.html.elements;

    const input = elements.find((el: any) => el.name === "input");
    expect(input).toBeDefined();
  });

  it("converts component names to kebab-case", () => {
    generateWebTypes({
      componentsDir,
      outFile,
      tsconfig,
    });

    const content = JSON.parse(fs.readFileSync(outFile, "utf-8"));
    const elements = content.contributions.html.elements;

    expect(elements.some((el: any) => el.name === "button")).toBe(true);
    expect(elements.some((el: any) => el.name === "card")).toBe(true);
  });

  it("extracts attributes from props", () => {
    generateWebTypes({
      componentsDir,
      outFile,
      tsconfig,
    });

    const content = JSON.parse(fs.readFileSync(outFile, "utf-8"));
    const elements = content.contributions.html.elements;

    const button = elements.find((el: any) => el.name === "button");
    expect(button.attributes).toBeDefined();
    expect(Array.isArray(button.attributes)).toBe(true);

    const variant = button.attributes.find((attr: any) => attr.name === "variant");
    expect(variant).toBeDefined();
    expect(variant.required).toBe(false);
  });

  it("handles boolean attributes correctly", () => {
    generateWebTypes({
      componentsDir,
      outFile,
      tsconfig,
    });

    const content = JSON.parse(fs.readFileSync(outFile, "utf-8"));
    const elements = content.contributions.html.elements;

    const button = elements.find((el: any) => el.name === "button");
    const disabled = button.attributes.find((attr: any) => attr.name === "disabled");

    expect(disabled).toBeDefined();
    expect(disabled.value.kind).toBe("no-value");
    expect(disabled.value.type).toBe("boolean");
  });

  it("handles union types with enum values", () => {
    generateWebTypes({
      componentsDir,
      outFile,
      tsconfig,
    });

    const content = JSON.parse(fs.readFileSync(outFile, "utf-8"));
    const elements = content.contributions.html.elements;

    const button = elements.find((el: any) => el.name === "button");
    const variant = button.attributes.find((attr: any) => attr.name === "variant");

    expect(variant).toBeDefined();
    expect(variant.values).toBeDefined();
    expect(Array.isArray(variant.values)).toBe(true);
    expect(variant.values.length).toBeGreaterThan(0);
    expect(variant.values.some((v: any) => v.name === "primary")).toBe(true);
  });

  it("marks required props correctly", () => {
    generateWebTypes({
      componentsDir,
      outFile,
      tsconfig,
    });

    const content = JSON.parse(fs.readFileSync(outFile, "utf-8"));
    const elements = content.contributions.html.elements;

    const card = elements.find((el: any) => el.name === "card");
    const title = card.attributes.find((attr: any) => attr.name === "title");

    expect(title).toBeDefined();
    expect(title.required).toBe(true);
  });

  it("extracts slots from ReactNode props", () => {
    generateWebTypes({
      componentsDir,
      outFile,
      tsconfig,
    });

    const content = JSON.parse(fs.readFileSync(outFile, "utf-8"));
    const elements = content.contributions.html.elements;

    const card = elements.find((el: any) => el.name === "card");
    expect(card.slots).toBeDefined();
    expect(Array.isArray(card.slots)).toBe(true);
    expect(card.slots.length).toBeGreaterThan(0);
  });

  it("converts children prop to default slot", () => {
    generateWebTypes({
      componentsDir,
      outFile,
      tsconfig,
    });

    const content = JSON.parse(fs.readFileSync(outFile, "utf-8"));
    const elements = content.contributions.html.elements;

    const card = elements.find((el: any) => el.name === "card");
    const defaultSlot = card.slots.find((slot: any) => slot.name === "default");

    expect(defaultSlot).toBeDefined();
  });

  it("extracts named slots from ReactNode props", () => {
    generateWebTypes({
      componentsDir,
      outFile,
      tsconfig,
    });

    const content = JSON.parse(fs.readFileSync(outFile, "utf-8"));
    const elements = content.contributions.html.elements;

    const card = elements.find((el: any) => el.name === "card");
    const headerSlot = card.slots.find((slot: any) => slot.name === "header");
    const footerSlot = card.slots.find((slot: any) => slot.name === "footer");

    expect(headerSlot).toBeDefined();
    expect(footerSlot).toBeDefined();
  });

  it("converts attribute names to kebab-case", () => {
    generateWebTypes({
      componentsDir,
      outFile,
      tsconfig,
    });

    const content = JSON.parse(fs.readFileSync(outFile, "utf-8"));
    const elements = content.contributions.html.elements;

    const button = elements.find((el: any) => el.name === "button");
    const onClick = button.attributes.find((attr: any) => attr.name === "on-click");

    expect(onClick).toBeDefined();
  });

  it("applies prefix to element names", () => {
    generateWebTypes({
      componentsDir,
      outFile,
      tsconfig,
      prefix: "ui-",
    });

    const content = JSON.parse(fs.readFileSync(outFile, "utf-8"));
    const elements = content.contributions.html.elements;

    expect(elements.some((el: any) => el.name === "ui-button")).toBe(true);
    expect(elements.some((el: any) => el.name === "ui-card")).toBe(true);
  });

  it("includes JSDoc descriptions for attributes", () => {
    generateWebTypes({
      componentsDir,
      outFile,
      tsconfig,
    });

    const content = JSON.parse(fs.readFileSync(outFile, "utf-8"));
    const elements = content.contributions.html.elements;

    const button = elements.find((el: any) => el.name === "button");
    const variant = button.attributes.find((attr: any) => attr.name === "variant");

    expect(variant.description).toBeDefined();
    expect(variant.description).toContain("variant");
  });

  it("sorts elements alphabetically", () => {
    generateWebTypes({
      componentsDir,
      outFile,
      tsconfig,
    });

    const content = JSON.parse(fs.readFileSync(outFile, "utf-8"));
    const elements = content.contributions.html.elements;

    const names = elements.map((el: any) => el.name);
    const sortedNames = [...names].sort();

    expect(names).toEqual(sortedNames);
  });

  it("omits slots property when there are no slots", () => {
    generateWebTypes({
      componentsDir,
      outFile,
      tsconfig,
    });

    const content = JSON.parse(fs.readFileSync(outFile, "utf-8"));
    const elements = content.contributions.html.elements;

    const button = elements.find((el: any) => el.name === "button");
    expect(button.slots).toBeUndefined();
  });
});
