import { describe, expect, test } from "bun:test";
import { parseThreadTs } from "./bot";

describe("parseThreadTs", () => {
  test("extracts ts from SDK thread ID format", () => {
    expect(parseThreadTs("slack:C12345:1234567890.123456")).toBe(
      "1234567890.123456",
    );
  });

  test("handles thread IDs with colons in ts", () => {
    expect(parseThreadTs("slack:C12345:some:complex:id")).toBe(
      "some:complex:id",
    );
  });

  test("returns input unchanged when not SDK format", () => {
    expect(parseThreadTs("1234567890.123456")).toBe("1234567890.123456");
  });

  test("returns input for empty string", () => {
    expect(parseThreadTs("")).toBe("");
  });
});
