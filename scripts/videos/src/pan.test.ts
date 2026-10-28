import { describe, expect, test } from "vitest";

import { panFor } from "./pan";

describe("panFor", () => {
  test("leaves a span that already shows alone", () => {
    expect(panFor(100, 200, 1440, 900)).toBe(0);
  });

  test("shifts just enough to show the end with a margin", () => {
    expect(panFor(1000, 200, 1440, 900)).toBe(1000 + 200 + 48 - 900);
  });

  test("never shifts past the edge of the screenshot", () => {
    expect(panFor(1300, 120, 1440, 900)).toBe(1440 - 900);
  });

  test("does not shift for a wide span whose start already shows", () => {
    // The URL input of the monitor form: starts mid-view, runs to the edge.
    expect(panFor(580, 810, 1440, 945)).toBe(0);
  });

  test("brings the start of a wide span into view", () => {
    expect(panFor(1000, 1000, 1440, 900)).toBe(1000 + 300 + 48 - 900);
  });
});
