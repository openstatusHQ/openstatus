import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";

import {
  auditEntityKind,
  fieldRefKind,
  toEntityId,
  toEntityIds,
} from "./entity-refs.client";

describe("toEntityId", () => {
  for (const [value, expected] of [
    [4, 4],
    ["42", 42],
    [0, undefined],
    [-1, undefined],
    [1.5, undefined],
    ["", undefined],
    ["4a", undefined],
    [" 4", undefined],
    [null, undefined],
    [Number.MAX_SAFE_INTEGER + 1, undefined],
  ] as const) {
    it(`parses ${JSON.stringify(value)}`, () => {
      expect(toEntityId(value)).toBe(expected);
    });
  }
});

describe("toEntityIds", () => {
  it("returns every id of a numeric list", () => {
    expect(toEntityIds([3, 4])).toEqual([3, 4]);
  });

  it("rejects empty lists, strings and lists with one bad entry", () => {
    expect(toEntityIds([])).toBeUndefined();
    expect(toEntityIds(["3"])).toBeUndefined();
    expect(toEntityIds([3, 0])).toBeUndefined();
    expect(toEntityIds("3,4")).toBeUndefined();
  });
});

describe("fieldRefKind", () => {
  it("maps known id fields", () => {
    expect(fieldRefKind("pageId")).toBe("page");
    expect(fieldRefKind("monitorIds")).toBe("monitor");
    expect(fieldRefKind("componentImpacts")).toBe("componentImpacts");
  });

  it("ignores unknown and inherited keys", () => {
    expect(fieldRefKind("retry")).toBeUndefined();
    expect(fieldRefKind("constructor")).toBeUndefined();
    expect(fieldRefKind("toString")).toBeUndefined();
  });
});

describe("auditEntityKind", () => {
  it("maps audit entity types with a card", () => {
    expect(auditEntityKind("status_report")).toBe("statusReport");
    expect(auditEntityKind("private_location")).toBe("privateLocation");
  });

  it("returns undefined for types without a card", () => {
    expect(auditEntityKind("api_key")).toBeUndefined();
    expect(auditEntityKind("__proto__")).toBeUndefined();
  });
});
