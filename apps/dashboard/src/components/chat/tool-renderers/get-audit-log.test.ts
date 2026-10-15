import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";

import { getAuditLogChanges } from "./get-audit-log";

type Output = Parameters<typeof getAuditLogChanges>[0];

// safe because getAuditLogChanges only reads before, after and changedFields
function asOutput(value: Record<string, unknown>): Output {
  return value as Output;
}

describe("getAuditLogChanges", () => {
  it("diffs only the changed fields of an update, hiding bookkeeping", () => {
    expect(
      getAuditLogChanges(
        asOutput({
          before: { name: "old", url: "a", updatedAt: 1 },
          after: { name: "new", url: "a", updatedAt: 2 },
          changedFields: ["name", "updatedAt"],
        }),
      ),
    ).toEqual([{ field: "name", before: "old", after: "new" }]);
  });

  it("returns nothing for an update without changed fields", () => {
    expect(
      getAuditLogChanges(
        asOutput({ before: { a: 1 }, after: { a: 1 }, changedFields: null }),
      ),
    ).toEqual([]);
  });

  it("lists the created fields", () => {
    expect(
      getAuditLogChanges(
        asOutput({
          before: null,
          after: { name: "api", workspaceId: 1 },
          changedFields: null,
        }),
      ),
    ).toEqual([{ field: "name", after: "api" }]);
  });

  it("lists the deleted fields", () => {
    expect(
      getAuditLogChanges(
        asOutput({
          before: { name: "api", deletedAt: 1 },
          after: null,
          changedFields: null,
        }),
      ),
    ).toEqual([{ field: "name", before: "api" }]);
  });

  it("returns nothing without snapshots", () => {
    expect(
      getAuditLogChanges(
        asOutput({ before: null, after: null, changedFields: ["x"] }),
      ),
    ).toEqual([]);
  });
});
