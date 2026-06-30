import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import { matchMarkdownRoute, parseMarkdownPath } from "./match-route";

describe("parseMarkdownPath", () => {
  test("missing slug → null", () => {
    expect(parseMarkdownPath([])).toBeNull();
  });

  test("slug only → overview rest", () => {
    expect(parseMarkdownPath(["acme"])).toEqual({ slug: "acme", rest: [] });
  });

  test("drops a present locale segment", () => {
    expect(parseMarkdownPath(["acme", "de", "monitors", "123"])).toEqual({
      slug: "acme",
      rest: ["monitors", "123"],
    });
  });

  test("keeps a non-locale second segment (locale-less request)", () => {
    expect(parseMarkdownPath(["acme", "monitors", "123"])).toEqual({
      slug: "acme",
      rest: ["monitors", "123"],
    });
  });

  test("locale only, no rest", () => {
    expect(parseMarkdownPath(["acme", "fr"])).toEqual({
      slug: "acme",
      rest: [],
    });
  });
});

describe("matchMarkdownRoute", () => {
  test("empty → overview", () => {
    expect(matchMarkdownRoute([])).toEqual({ kind: "overview" });
  });

  test("monitors list", () => {
    expect(matchMarkdownRoute(["monitors"])).toEqual({ kind: "monitors" });
  });

  test("monitor detail with numeric id", () => {
    expect(matchMarkdownRoute(["monitors", "123"])).toEqual({
      kind: "monitor",
      id: 123,
    });
  });

  test("events list", () => {
    expect(matchMarkdownRoute(["events"])).toEqual({ kind: "events" });
  });

  test("report detail", () => {
    expect(matchMarkdownRoute(["events", "report", "7"])).toEqual({
      kind: "report",
      id: 7,
    });
  });

  test("maintenance detail", () => {
    expect(matchMarkdownRoute(["events", "maintenance", "42"])).toEqual({
      kind: "maintenance",
      id: 42,
    });
  });

  test("non-numeric monitor id → null", () => {
    expect(matchMarkdownRoute(["monitors", "abc"])).toBeNull();
  });

  test("report missing id → null", () => {
    expect(matchMarkdownRoute(["events", "report"])).toBeNull();
  });

  test("report with trailing extra segment → null", () => {
    expect(matchMarkdownRoute(["events", "report", "1", "extra"])).toBeNull();
  });

  test("unknown tail → null", () => {
    expect(matchMarkdownRoute(["foo"])).toBeNull();
  });

  test("monitor id zero → null", () => {
    expect(matchMarkdownRoute(["monitors", "0"])).toBeNull();
  });

  test("unknown event subtype → null", () => {
    expect(matchMarkdownRoute(["events", "incident", "1"])).toBeNull();
  });
});
