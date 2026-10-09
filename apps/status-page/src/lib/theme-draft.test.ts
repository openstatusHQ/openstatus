import { THEMES } from "@openstatus/theme-store";
import { expect } from "@std/expect";
import { afterEach, describe, it } from "@std/testing/bdd";

import {
  THEME_DRAFT_STORAGE_KEY,
  clearThemeDraft,
  readThemeDraft,
  saveThemeDraft,
} from "./theme-draft";

afterEach(() => sessionStorage.clear());

const theme = Object.values(THEMES)[0];

describe("theme draft storage", () => {
  it("returns null when nothing is stored", () => {
    expect(readThemeDraft()).toBeNull();
  });

  it("round-trips a saved theme", () => {
    saveThemeDraft(theme);
    expect(readThemeDraft()).toEqual(theme);
  });

  it("clears the draft", () => {
    saveThemeDraft(theme);
    clearThemeDraft();
    expect(readThemeDraft()).toBeNull();
  });

  it("fills in id, name and author for bare CSS variables", () => {
    sessionStorage.setItem(
      THEME_DRAFT_STORAGE_KEY,
      "--background: oklch(1 0 0);",
    );
    expect(readThemeDraft()).toEqual({
      id: "draft",
      name: "Draft",
      author: { name: "", url: "" },
      light: { "--background": "oklch(1 0 0)" },
      dark: {},
    });
  });

  it("rejects an entry without supported variables", () => {
    sessionStorage.setItem(THEME_DRAFT_STORAGE_KEY, "garbage");
    expect(readThemeDraft()).toBeNull();
  });

  it("does not let a hand-edited value break out of the declaration", () => {
    sessionStorage.setItem(
      THEME_DRAFT_STORAGE_KEY,
      JSON.stringify({
        light: { "--background": "red;}</style><script>alert(1)</script>" },
        dark: {},
      }),
    );
    const draft = readThemeDraft();
    const values = draft
      ? [...Object.values(draft.light), ...Object.values(draft.dark)]
      : [];
    expect(values.some((v) => /[;{}<>]/.test(String(v)))).toBe(false);
  });
});
