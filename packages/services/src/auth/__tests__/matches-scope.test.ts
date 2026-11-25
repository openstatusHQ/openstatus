import type { RequiredScope, Scope } from "@openstatus/db/src/schema";
import { describe, expect, test } from "vitest";

import { matchesScope } from "../matches-scope";

describe("matchesScope", () => {
  // Table-driven sweep over the hierarchy in matches-scope.ts.
  const cases: ReadonlyArray<{
    name: string;
    held: Scope[];
    required: RequiredScope;
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
    // Group scopes
    {
      name: "write ⊇ monitors:write",
      held: ["write"],
      required: "monitors:write",
      expected: true,
    },
    {
      name: "write ⊇ subscribers:read",
      held: ["write"],
      required: "subscribers:read",
      expected: true,
    },
    {
      name: "write ⊉ admin",
      held: ["write"],
      required: "admin",
      expected: false,
    },
    {
      name: "read ⊇ monitors:read",
      held: ["read"],
      required: "monitors:read",
      expected: true,
    },
    {
      name: "read ⊇ subscribers:read",
      held: ["read"],
      required: "subscribers:read",
      expected: true,
    },
    {
      name: "read ⊉ monitors:write",
      held: ["read"],
      required: "monitors:write",
      expected: false,
    },
    {
      name: "monitors:write ⊇ monitors:read",
      held: ["monitors:write"],
      required: "monitors:read",
      expected: true,
    },
    {
      name: "monitors:write ⊇ monitors:write",
      held: ["monitors:write"],
      required: "monitors:write",
      expected: true,
    },
    {
      name: "monitors:write ⊉ pages:read",
      held: ["monitors:write"],
      required: "pages:read",
      expected: false,
    },
    {
      name: "monitors:write ⊉ legacy read",
      held: ["monitors:write"],
      required: "read",
      expected: false,
    },
    {
      name: "monitors:read ⊉ monitors:write",
      held: ["monitors:read"],
      required: "monitors:write",
      expected: false,
    },
    {
      name: "subscribers:read ⊇ subscribers:read",
      held: ["subscribers:read"],
      required: "subscribers:read",
      expected: true,
    },
    {
      name: "multi group",
      held: ["pages:read", "incidents:write"],
      required: "incidents:read",
      expected: true,
    },
    // Required-only scopes
    { name: "* ⊇ admin", held: ["*"], required: "admin", expected: true },
    {
      name: "group write ⊉ admin",
      held: ["monitors:write", "pages:write"],
      required: "admin",
      expected: false,
    },
    { name: "any ⊆ read", held: ["read"], required: "any", expected: true },
    {
      name: "any ⊆ group scope",
      held: ["incidents:write"],
      required: "any",
      expected: true,
    },
    { name: "any ⊄ empty", held: [], required: "any", expected: false },
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
    expect(matchesScope(corrupt, "monitors:read")).toBe(false);
    expect(matchesScope(["admin" as unknown as Scope], "admin")).toBe(false);
  });
});
