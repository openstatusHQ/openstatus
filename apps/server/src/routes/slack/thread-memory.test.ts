import { describe, expect, test } from "vitest";

import { createdNote, createdRecordFrom } from "./thread-memory";

describe("createdRecordFrom", () => {
  test("reads the report out of create and update outputs", () => {
    const output = {
      statusReport: { id: 12, title: "API down", status: "investigating" },
      initialUpdateId: 3,
    };
    expect(createdRecordFrom("create_status_report", output)).toEqual({
      kind: "status_report",
      id: 12,
      label: "API down",
    });
    expect(createdRecordFrom("add_status_report_update", output)).toEqual({
      kind: "status_report",
      id: 12,
      label: "API down",
    });
  });

  test("reads incidents and maintenances by id and title", () => {
    expect(
      createdRecordFrom("declare_incident", {
        id: 7,
        title: "x",
        status: "open",
      }),
    ).toEqual({ kind: "incident", id: 7, label: "x" });
    expect(
      createdRecordFrom("create_maintenance", { id: 4, title: "y" }),
    ).toEqual({ kind: "maintenance", id: 4, label: "y" });
  });

  test("ignores other tools and unexpected outputs", () => {
    expect(
      createdRecordFrom("list_monitors", { id: 1, title: "x" }),
    ).toBeUndefined();
    expect(createdRecordFrom("declare_incident", { ok: true })).toBeUndefined();
  });
});

describe("createdNote", () => {
  test("names each record by kind and id", () => {
    const note = createdNote([
      { kind: "status_report", id: 12, label: "API down" },
      { kind: "incident", id: 7 },
    ]);
    expect(note).toContain("status report #12");
    expect(note).not.toContain("API down");
    expect(note).toContain("managed incident #7");
    expect(createdNote([])).toBeUndefined();
  });
});
