import { describe, expect, test } from "bun:test";
import { buildExternalPath } from "./build-external-path";

describe("buildExternalPath", () => {
  test("hostname routing: suffix stands alone", () => {
    expect(
      buildExternalPath({ type: "hostname", prefix: "acme" }, "/login"),
    ).toBe("/login");
  });

  test("hostname routing: empty suffix → page root", () => {
    expect(buildExternalPath({ type: "hostname", prefix: "acme" }, "")).toBe(
      "",
    );
  });

  test("pathname routing: prefix prepended to suffix", () => {
    expect(
      buildExternalPath({ type: "pathname", prefix: "acme" }, "/login"),
    ).toBe("/acme/login");
  });

  test("pathname routing: empty suffix → page root with prefix", () => {
    expect(buildExternalPath({ type: "pathname", prefix: "acme" }, "")).toBe(
      "/acme",
    );
  });

  test("pathname routing: /restricted suffix", () => {
    expect(
      buildExternalPath({ type: "pathname", prefix: "status" }, "/restricted"),
    ).toBe("/status/restricted");
  });

  test("hostname routing: custom-domain prefix", () => {
    expect(
      buildExternalPath(
        { type: "hostname", prefix: "status.acme.com" },
        "/login",
      ),
    ).toBe("/login");
  });
});
