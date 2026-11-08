import { describe, expect, test } from "vitest";

import { wwwCounterpart } from "./domain";

describe("wwwCounterpart", () => {
  test("adds www to an apex", () => {
    expect(wwwCounterpart("Acme.com")).toBe("www.acme.com");
  });

  test("strips www", () => {
    expect(wwwCounterpart("WWW.acme.com")).toBe("acme.com");
  });

  test("refuses to strip down to a bare TLD", () => {
    expect(wwwCounterpart("www.com")).toBeNull();
  });
});
