import { describe, expect, it } from "vitest";

import { compareStatusPages } from "./status-pages.client";

describe("compareStatusPages", () => {
  it("puts pages with an open report first, then by title", () => {
    const sorted = [
      { title: "b", hasActiveStatusReport: false },
      { title: "c", hasActiveStatusReport: true },
      { title: "a", hasActiveStatusReport: false },
    ].sort(compareStatusPages);
    expect(sorted.map((p) => p.title)).toEqual(["c", "a", "b"]);
  });
});
