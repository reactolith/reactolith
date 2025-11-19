import { describe, it, expect } from "vitest";
import { isRelativeHref, hasNavBypassModifiers } from "../src/Router";

describe("isRelativeHref", () => {
  it("returns true for relative paths", () => {
    expect(isRelativeHref("/api/data")).toBe(true);
    expect(isRelativeHref("/")).toBe(true);
    expect(isRelativeHref("page.html")).toBe(true);
    expect(isRelativeHref("./relative")).toBe(true);
    expect(isRelativeHref("../parent")).toBe(true);
    expect(isRelativeHref("path/to/page")).toBe(true);
  });

  it("returns false for null or empty href", () => {
    expect(isRelativeHref(null)).toBe(false);
    expect(isRelativeHref("")).toBe(false);
  });

  it("returns false for hash links", () => {
    expect(isRelativeHref("#section")).toBe(false);
    expect(isRelativeHref("#")).toBe(false);
  });

  it("returns false for protocol-relative URLs", () => {
    expect(isRelativeHref("//example.com/path")).toBe(false);
  });

  it("returns false for absolute URLs with protocols", () => {
    expect(isRelativeHref("http://example.com")).toBe(false);
    expect(isRelativeHref("https://example.com")).toBe(false);
    expect(isRelativeHref("mailto:test@example.com")).toBe(false);
    expect(isRelativeHref("tel:+123456789")).toBe(false);
    expect(isRelativeHref("javascript:void(0)")).toBe(false);
    expect(isRelativeHref("ftp://files.example.com")).toBe(false);
    expect(isRelativeHref("data:text/html,<h1>Test</h1>")).toBe(false);
  });

  it("handles edge cases with colons in paths", () => {
    // Paths that contain colons but are not protocols
    expect(isRelativeHref("/path:with:colons")).toBe(true);
    expect(isRelativeHref("path:8080")).toBe(false); // This looks like a protocol
  });
});

describe("hasNavBypassModifiers", () => {
  const createMouseEvent = (overrides: Partial<MouseEvent> = {}): MouseEvent => {
    return {
      defaultPrevented: false,
      button: 0,
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      ...overrides,
    } as MouseEvent;
  };

  it("returns false for normal left click", () => {
    const event = createMouseEvent();
    expect(hasNavBypassModifiers(event)).toBe(false);
  });

  it("returns true when defaultPrevented is true", () => {
    const event = createMouseEvent({ defaultPrevented: true });
    expect(hasNavBypassModifiers(event)).toBe(true);
  });

  it("returns true for non-left button clicks", () => {
    expect(hasNavBypassModifiers(createMouseEvent({ button: 1 }))).toBe(true); // middle
    expect(hasNavBypassModifiers(createMouseEvent({ button: 2 }))).toBe(true); // right
  });

  it("returns true when metaKey is pressed", () => {
    const event = createMouseEvent({ metaKey: true });
    expect(hasNavBypassModifiers(event)).toBe(true);
  });

  it("returns true when ctrlKey is pressed", () => {
    const event = createMouseEvent({ ctrlKey: true });
    expect(hasNavBypassModifiers(event)).toBe(true);
  });

  it("returns true when shiftKey is pressed", () => {
    const event = createMouseEvent({ shiftKey: true });
    expect(hasNavBypassModifiers(event)).toBe(true);
  });

  it("returns true when altKey is pressed", () => {
    const event = createMouseEvent({ altKey: true });
    expect(hasNavBypassModifiers(event)).toBe(true);
  });

  it("returns true with multiple modifiers", () => {
    const event = createMouseEvent({ ctrlKey: true, shiftKey: true });
    expect(hasNavBypassModifiers(event)).toBe(true);
  });
});
