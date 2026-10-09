import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";

import { addStatusReportUpdateChanges } from "./add-status-report-update";
import { createStatusReportChanges } from "./create-status-report";
import { resolveStatusReportChanges } from "./resolve-status-report";
import { updateStatusReportChanges } from "./update-status-report";

type CreateInput = Parameters<typeof createStatusReportChanges>[0];
type AddInput = Parameters<typeof addStatusReportUpdateChanges>[0];
type UpdateInput = Parameters<typeof updateStatusReportChanges>[0];
type ResolveInput = Parameters<typeof resolveStatusReportChanges>[0];

// safe because the mappers only read the fields each fixture sets
function asInput<T>(value: Record<string, unknown>): T {
  return value as T;
}

const fields = (rows: { field: string }[]) => rows.map((r) => r.field);

describe("createStatusReportChanges", () => {
  const base = {
    title: "API outage",
    status: "investigating",
    message: "Looking into it",
    pageId: 7,
    notify: true,
  };

  it("lists the required fields for a draft", () => {
    expect(createStatusReportChanges(asInput<CreateInput>(base))).toEqual([
      { field: "title", after: "API outage" },
      { field: "status", after: "investigating" },
      { field: "message", after: "Looking into it" },
      { field: "pageId", after: 7 },
      { field: "notify", after: true },
    ]);
  });

  it("adds optional fields only when present", () => {
    const rows = createStatusReportChanges(
      asInput<CreateInput>({
        ...base,
        pageComponentIds: [1, 2],
        componentImpacts: [{ pageComponentId: 1, impact: "major_outage" }],
        date: "2024-01-01T00:00:00Z",
      }),
    );
    expect(rows.slice(5)).toEqual([
      { field: "pageComponentIds", after: [1, 2] },
      { field: "componentImpacts", after: ["1 → major_outage"] },
      { field: "date", after: "2024-01-01T00:00:00Z" },
    ]);
  });

  it("skips empty component lists and a null date", () => {
    const rows = createStatusReportChanges(
      asInput<CreateInput>({
        ...base,
        pageComponentIds: [],
        componentImpacts: [],
        date: null,
      }),
    );
    expect(fields(rows)).toEqual([
      "title",
      "status",
      "message",
      "pageId",
      "notify",
    ]);
  });

  it("prefers the applied notify flag and appends createdAt", () => {
    const rows = createStatusReportChanges(asInput<CreateInput>(base), {
      id: 1,
      notified: false,
      createdAt: "2024-01-02T00:00:00Z",
    });
    expect(rows.find((r) => r.field === "notify")?.after).toBe(false);
    expect(rows.at(-1)).toEqual({
      field: "createdAt",
      after: "2024-01-02T00:00:00Z",
    });
  });

  it("keeps the input notify flag when the result omits it", () => {
    const rows = createStatusReportChanges(asInput<CreateInput>(base), {
      id: 1,
    });
    expect(rows.find((r) => r.field === "notify")?.after).toBe(true);
    expect(fields(rows)).not.toContain("createdAt");
  });
});

describe("addStatusReportUpdateChanges", () => {
  const base = {
    statusReportId: 3,
    status: "monitoring",
    message: "Fix deployed",
    notify: false,
  };

  it("lists the update fields", () => {
    expect(addStatusReportUpdateChanges(asInput<AddInput>(base))).toEqual([
      { field: "statusReportId", after: 3 },
      { field: "status", after: "monitoring" },
      { field: "message", after: "Fix deployed" },
      { field: "notify", after: false },
    ]);
  });

  it("formats impacts, keeps the date and uses the applied notify flag", () => {
    const rows = addStatusReportUpdateChanges(
      asInput<AddInput>({
        ...base,
        componentImpacts: [{ pageComponentId: 4, impact: "operational" }],
        date: "2024-01-01T00:00:00Z",
      }),
      { statusReportUpdateId: 9, notified: true },
    );
    expect(rows.find((r) => r.field === "notify")?.after).toBe(true);
    expect(rows.slice(4)).toEqual([
      { field: "componentImpacts", after: ["4 → operational"] },
      { field: "date", after: "2024-01-01T00:00:00Z" },
    ]);
  });
});

describe("updateStatusReportChanges", () => {
  it("only lists the fields the model proposed", () => {
    expect(
      updateStatusReportChanges(
        asInput<UpdateInput>({ statusReportId: 5, title: "New title" }),
      ),
    ).toEqual([
      { field: "statusReportId", after: 5 },
      { field: "title", after: "New title" },
    ]);
  });

  it("keeps an explicitly empty component list", () => {
    expect(
      fields(
        updateStatusReportChanges(
          asInput<UpdateInput>({
            statusReportId: 5,
            status: "resolved",
            pageComponentIds: [],
          }),
        ),
      ),
    ).toEqual(["statusReportId", "status", "pageComponentIds"]);
  });
});

describe("resolveStatusReportChanges", () => {
  const base = { statusReportId: 2, message: "All good", notify: true };

  it("always sets the status to resolved", () => {
    expect(resolveStatusReportChanges(asInput<ResolveInput>(base))).toEqual([
      { field: "statusReportId", after: 2 },
      { field: "status", after: "resolved" },
      { field: "message", after: "All good" },
      { field: "notify", after: true },
    ]);
  });

  it("appends the date and uses the applied notify flag", () => {
    const rows = resolveStatusReportChanges(
      asInput<ResolveInput>({ ...base, date: "2024-01-01T00:00:00Z" }),
      { statusReportUpdateId: 1, notified: false },
    );
    expect(rows.find((r) => r.field === "notify")?.after).toBe(false);
    expect(rows.at(-1)).toEqual({
      field: "date",
      after: "2024-01-01T00:00:00Z",
    });
  });
});
