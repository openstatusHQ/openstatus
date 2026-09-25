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

  test("rejects an empty name so a placeholder row is never persisted", () => {
    const result = headerPairSchema.safeParse({ key: "", value: "" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Header name is required");
  });

  test("allows an empty value", () => {
    expect(headerPairSchema.parse({ key: "X-Empty", value: "" })).toEqual({
      key: "X-Empty",
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
