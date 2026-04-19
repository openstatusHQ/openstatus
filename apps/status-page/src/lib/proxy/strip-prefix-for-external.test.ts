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

  test("hostname routing: prefix recurs in deeper path — only the leading occurrence is stripped", () => {
    expect(
      stripPrefixForExternal(
        { type: "hostname", prefix: "acme" },
        "/acme/en/acme/more",
      ),
    ).toBe("/en/acme/more");
  });

  test("hostname routing: path does not start with /prefix → returned unchanged", () => {
    expect(
      stripPrefixForExternal(
        { type: "hostname", prefix: "acme" },
        "/other/en/acme",
      ),
    ).toBe("/other/en/acme");
  });
});
