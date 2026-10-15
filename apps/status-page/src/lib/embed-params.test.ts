import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import {
  ALL_EMBED_SECTIONS,
  embedParser,
  embedThemeParser,
} from "./embed-params";

const all = [...ALL_EMBED_SECTIONS];

describe("embedParser.parse", () => {
  test("treats an empty value or 'all' as every section", () => {
    expect(embedParser.parse("")).toEqual({ mode: true, sections: all });
    expect(embedParser.parse("ALL")).toEqual({ mode: true, sections: all });
  });

  test("keeps known sections, normalized and deduplicated", () => {
    expect(embedParser.parse(" Banner ,feed,banner,nope")).toEqual({
      mode: true,
      sections: ["banner", "feed"],
    });
  });

  test("falls back to every section when nothing valid is given", () => {
    expect(embedParser.parse(",")).toEqual({ mode: true, sections: all });
    expect(embedParser.parse("unknown")).toEqual({ mode: true, sections: all });
  });
});

describe("embedParser.serialize", () => {
  test("is empty outside embed mode or with every section", () => {
    expect(embedParser.serialize({ mode: false, sections: ["feed"] })).toBe("");
    expect(embedParser.serialize({ mode: true, sections: all })).toBe("");
  });

  test("joins a narrowed section list", () => {
    expect(
      embedParser.serialize({ mode: true, sections: ["title", "feed"] }),
    ).toBe("title,feed");
  });

  test("round-trips a narrowed list", () => {
    const state = { mode: true, sections: ["components", "banner"] as const };
    expect(
      embedParser.parse(
        embedParser.serialize({ ...state, sections: [...state.sections] }),
      ),
    ).toEqual({ mode: true, sections: ["components", "banner"] });
  });
});

describe("embedParser.eq", () => {
  test("ignores section order", () => {
    expect(
      embedParser.eq(
        { mode: true, sections: ["title", "feed"] },
        { mode: true, sections: ["feed", "title"] },
      ),
    ).toBe(true);
  });

  test("differs on mode or sections", () => {
    expect(
      embedParser.eq(
        { mode: true, sections: all },
        { mode: false, sections: all },
      ),
    ).toBe(false);
    expect(
      embedParser.eq(
        { mode: true, sections: ["title"] },
        { mode: true, sections: ["feed"] },
      ),
    ).toBe(false);
  });

  test("defaults to non-embed mode", () => {
    expect(embedParser.defaultValue).toEqual({ mode: false, sections: all });
  });
});

describe("embedThemeParser", () => {
  test("accepts only light and dark", () => {
    expect(embedThemeParser.parse("dark")).toBe("dark");
    expect(embedThemeParser.parse("sepia")).toBeNull();
  });
});
