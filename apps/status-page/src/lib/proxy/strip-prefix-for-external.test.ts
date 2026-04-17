import { describe, expect, test } from "bun:test";
import { stripPrefixForExternal } from "./strip-prefix-for-external";

describe("stripPrefixForExternal", () => {
  test("pathname routing: path unchanged", () => {
    expect(
      stripPrefixForExternal(
        { type: "pathname", prefix: "acme" },
        "/acme/en/events",
      ),
    ).toBe("/acme/en/events");
  });

  test("hostname routing: strips first occurrence of /prefix", () => {
    expect(
      stripPrefixForExternal(
        { type: "hostname", prefix: "acme" },
        "/acme/en/events",
      ),
    ).toBe("/en/events");
  });

  test("hostname routing: strips at root (no trailing segments)", () => {
    expect(
      stripPrefixForExternal({ type: "hostname", prefix: "acme" }, "/acme/en"),
    ).toBe("/en");
  });

  test("hostname routing: custom-domain prefix", () => {
    expect(
      stripPrefixForExternal(
        { type: "hostname", prefix: "status.acme.com" },
        "/status.acme.com/en",
      ),
    ).toBe("/en");
  });
});
