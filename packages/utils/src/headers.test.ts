import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import { headerPairSchema } from "./headers";

describe("headerPairSchema", () => {
  test("trims surrounding whitespace from the value only", () => {
    expect(
      headerPairSchema.parse({ key: "Content-Type", value: " text/plain " }),
    ).toEqual({ key: "Content-Type", value: "text/plain" });
  });

  test("rejects surrounding whitespace in the key instead of trimming it", () => {
    for (const key of [" Content-Type", "Content-Type ", " "]) {
      expect(headerPairSchema.safeParse({ key, value: "x" }).success).toBe(
        false,
      );
    }
  });

  test("keeps an empty row so the form can hold an unfilled header", () => {
    expect(headerPairSchema.parse({ key: "", value: "" })).toEqual({
      key: "",
      value: "",
    });
  });

  test("rejects a name that is not a header token", () => {
    for (const key of ["Content Type", "X-Trace:", "Ünicode", "a\tb"]) {
      expect(headerPairSchema.safeParse({ key, value: "x" }).success).toBe(
        false,
      );
    }
  });
});
