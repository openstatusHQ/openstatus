import { Code, ConnectError } from "@connectrpc/connect";
import { describe, expect, test } from "vitest";

import { parseDate, parseId } from "./parse";

const invalid = () => new ConnectError("invalid", Code.InvalidArgument);

describe("parseDate", () => {
  test("accepts RFC 3339 with Z, offsets and fractions", () => {
    expect(parseDate("2024-02-29T10:30:00Z", invalid).toISOString()).toBe(
      "2024-02-29T10:30:00.000Z",
    );
    expect(
      parseDate("2024-03-15T10:30:00.123+02:00", invalid).toISOString(),
    ).toBe("2024-03-15T08:30:00.123Z");
  });

  test("rejects impossible calendar values instead of rolling over", () => {
    for (const value of [
      "2024-02-31T10:30:00Z",
      "2023-02-29T10:30:00Z",
      "2024-13-01T10:30:00Z",
      "2024-03-15T24:00:00Z",
      "2024-03-15T10:60:00Z",
      "2024-03-15T10:30:00+24:00",
    ]) {
      expect(() => parseDate(value, invalid)).toThrow(ConnectError);
    }
  });

  test("rejects non RFC 3339 strings", () => {
    for (const value of ["2024-03-15", "March 15, 2024", ""]) {
      expect(() => parseDate(value, invalid)).toThrow(ConnectError);
    }
  });
});

describe("parseId", () => {
  test("accepts decimal digits", () => {
    expect(parseId(" 42 ", invalid)).toBe(42);
  });

  test("rejects anything else", () => {
    for (const value of ["", "1e3", "0x10", "1.5", "9007199254740993"]) {
      expect(() => parseId(value, invalid)).toThrow(ConnectError);
    }
  });
});
