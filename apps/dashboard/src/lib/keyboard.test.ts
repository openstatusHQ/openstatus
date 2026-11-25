import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getModifierKey, isKeyboardOwned, isResetShortcut } from "./keyboard";

// No DOM under deno test: a minimal HTMLElement that answers matches/closest.
class FakeElement {
  constructor(
    private tag: string,
    private role?: string,
    public isContentEditable = false,
  ) {}
  matches(selector: string) {
    return selector.split(", ").includes(this.tag);
  }
  closest(selector: string) {
    return this.role && selector.includes(`[role="${this.role}"]`)
      ? this
      : null;
  }
}

const original = Object.getOwnPropertyDescriptor(globalThis, "HTMLElement");
beforeAll(() => {
  Object.defineProperty(globalThis, "HTMLElement", {
    value: FakeElement,
    configurable: true,
  });
});
afterAll(() => {
  if (original) Object.defineProperty(globalThis, "HTMLElement", original);
  else delete (globalThis as { HTMLElement?: unknown }).HTMLElement;
});

const el = (...args: ConstructorParameters<typeof FakeElement>) =>
  new FakeElement(...args) as unknown as EventTarget;

describe("isKeyboardOwned", () => {
  it("is owned by form fields and contenteditable", () => {
    expect(isKeyboardOwned(el("input"))).toBe(true);
    expect(isKeyboardOwned(el("textarea"))).toBe(true);
    expect(isKeyboardOwned(el("select"))).toBe(true);
    expect(isKeyboardOwned(el("div", undefined, true))).toBe(true);
  });

  it("is owned inside an open overlay", () => {
    expect(isKeyboardOwned(el("button", "dialog"))).toBe(true);
    expect(isKeyboardOwned(el("div", "menu"))).toBe(true);
    expect(isKeyboardOwned(el("div", "listbox"))).toBe(true);
  });

  it("is free on the page and for non-elements", () => {
    expect(isKeyboardOwned(el("button"))).toBe(false);
    expect(isKeyboardOwned(el("div", "row"))).toBe(false);
    expect(isKeyboardOwned(null)).toBe(false);
    expect(isKeyboardOwned({} as EventTarget)).toBe(false);
  });
});

describe("isResetShortcut", () => {
  const event = (
    overrides: Partial<Parameters<typeof isResetShortcut>[0]>,
  ) => ({
    key: "Escape",
    metaKey: false,
    ctrlKey: false,
    repeat: false,
    target: el("body"),
    ...overrides,
  });

  it("fires on ⌘+Esc and Ctrl+Esc", () => {
    expect(isResetShortcut(event({ metaKey: true }))).toBe(true);
    expect(isResetShortcut(event({ ctrlKey: true }))).toBe(true);
  });

  it("ignores bare Esc, other keys and repeats", () => {
    expect(isResetShortcut(event({}))).toBe(false);
    expect(isResetShortcut(event({ metaKey: true, key: "k" }))).toBe(false);
    expect(isResetShortcut(event({ metaKey: true, repeat: true }))).toBe(false);
  });

  it("leaves Esc to a focused field or open overlay", () => {
    expect(isResetShortcut(event({ metaKey: true, target: el("input") }))).toBe(
      false,
    );
    expect(
      isResetShortcut(event({ ctrlKey: true, target: el("div", "dialog") })),
    ).toBe(false);
  });
});

describe("getModifierKey", () => {
  it("shows ⌘ on Apple platforms and Ctrl elsewhere", () => {
    expect(
      getModifierKey("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"),
    ).toBe("⌘");
    expect(getModifierKey("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)")).toBe(
      "⌘",
    );
    expect(getModifierKey("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe(
      "Ctrl",
    );
    expect(getModifierKey("Mozilla/5.0 (X11; Linux x86_64)")).toBe("Ctrl");
  });
});
