import { describe, expect, test } from "bun:test";

import type { Scope } from "@openstatus/db/src/schema";

import { matchesScope } from "../matches-scope";

describe("matchesScope", () => {
  // Table-driven sweep over the v1 hierarchy:
  //   '*' ⊇ 'write' ⊇ 'read'
  const cases: ReadonlyArray<{
    name: string;
    held: Scope[];
    required: Scope;
    expected: boolean;
  }> = [
    {
      name: "* held → read required",
      held: ["*"],
      required: "read",
      expected: true,
    },
    {
      name: "* held → write required",
      held: ["*"],
      required: "write",
      expected: true,
    },
    { name: "* held → * required", held: ["*"], required: "*", expected: true },
    {
      name: "write held → read required",
      held: ["write"],
      required: "read",
      expected: true,
    },
    {
      name: "write held → write required",
      held: ["write"],
      required: "write",
      expected: true,
    },
    {
      name: "write held → * required",
      held: ["write"],
      required: "*",
      expected: false,
    },
    {
      name: "read held → read required",
      held: ["read"],
      required: "read",
      expected: true,
    },
    {
      name: "read held → write required",
      held: ["read"],
      required: "write",
      expected: false,
    },
    {
      name: "read held → * required",
      held: ["read"],
      required: "*",
      expected: false,
    },
    {
      name: "empty held matches nothing",
      held: [],
      required: "read",
      expected: false,
    },
    {
      name: "empty held matches nothing (write)",
      held: [],
      required: "write",
      expected: false,
    },
    {
      name: "multi-scope: ['read','write']",
      held: ["read", "write"],
      required: "write",
      expected: true,
    },
  ];

  for (const c of cases) {
    test(c.name, () => {
      expect(matchesScope(c.held, c.required)).toBe(c.expected);
    });
  }

  test("unknown scope strings match nothing (fail-closed)", () => {
    // Cast through unknown to bypass the type narrowing — simulates
    // a corrupt DB row or a future migration bug.
    const corrupt = ["bogus" as unknown as Scope];
    expect(matchesScope(corrupt, "read")).toBe(false);
    expect(matchesScope(corrupt, "write")).toBe(false);
  });
});
