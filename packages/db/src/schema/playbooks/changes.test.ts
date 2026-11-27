import { describe, expect, test } from "vitest";

import { playbookLineChanges } from "./changes";

describe("playbookLineChanges", () => {
  test("a changed line near the end shows as removed and added", () => {
    const before = ["# Title", "", "one", "two", "three"].join("\n");
    const after = ["# Title", "", "one", "two", "four"].join("\n");
    expect(playbookLineChanges(before, after)).toEqual({
      removed: ["three"],
      added: ["four"],
    });
  });

  test("an inserted line leaves its neighbours alone", () => {
    expect(playbookLineChanges("a\nc", "a\nb\nc")).toEqual({
      removed: [],
      added: ["b"],
    });
  });

  test("the same text has no changes, and blank lines never count", () => {
    expect(playbookLineChanges("a\nb", "a\nb")).toEqual({
      removed: [],
      added: [],
    });
    expect(playbookLineChanges("a\nb", "a\n\nb")).toEqual({
      removed: [],
      added: [],
    });
  });
});
