import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import { parseDeclare, parseTarget } from "./incident-commands";

describe("parseDeclare", () => {
  test("title with a severity flag anywhere", () => {
    expect(parseDeclare(["API", "down", "--sev", "critical"])).toEqual({
      title: "API down",
      severity: "critical",
    });
    expect(parseDeclare(["--severity", "MINOR", "Slow", "search"])).toEqual({
      title: "Slow search",
      severity: "minor",
    });
  });

  test("defaults to major and ignores an unknown severity", () => {
    expect(parseDeclare(["Checkout", "--sev", "huge"])).toEqual({
      title: "Checkout",
      severity: "major",
    });
  });
});

describe("parseTarget", () => {
  test("leading #id or number names the incident", () => {
    expect(parseTarget(["#12", "rolled", "back"])).toEqual({
      id: 12,
      rest: "rolled back",
    });
    expect(parseTarget(["7"])).toEqual({ id: 7, rest: "" });
  });

  test("otherwise everything is the note", () => {
    expect(parseTarget(["rolled", "back"])).toEqual({
      id: null,
      rest: "rolled back",
    });
  });
});
