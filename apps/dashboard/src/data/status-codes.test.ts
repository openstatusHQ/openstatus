import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";

import { getStatusCodeVariant } from "./status-codes";

describe("getStatusCodeVariant", () => {
  for (const [code, variant] of [
    [200, "success"],
    [204, "success"],
    [301, "info"],
    [404, "warning"],
    [429, "warning"],
    [500, "destructive"],
    [503, "destructive"],
    [100, "muted"],
    [0, "muted"],
    [null, "muted"],
    [undefined, "muted"],
  ] as const) {
    it(`${code} -> ${variant}`, () => {
      expect(getStatusCodeVariant(code)).toBe(variant);
    });
  }
});
