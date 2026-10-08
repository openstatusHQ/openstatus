import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";

import { lenientEnum } from "./schemas";

describe("lenientEnum", () => {
  const schema = lenientEnum(["a", "b"]);

  it("keeps known values", () => {
    expect(schema.parse("a")).toBe("a");
  });

  it("parses unknown strings to unknown", () => {
    expect(schema.parse("brand_new_status")).toBe("unknown");
  });

  it("still rejects non-strings", () => {
    expect(() => schema.parse(42)).toThrow();
  });
});
