import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  declareIncidentChanges,
  getIncidentDetails,
  listIncidentsTable,
  resolveIncidentChanges,
  updateIncidentChanges,
} from "./incidents";

// safe because the mappers only read the fields each fixture sets
function asFixture<T>(value: Record<string, unknown>): T {
  return value as T;
}

function text(node: ReactNode) {
  return renderToStaticMarkup(<>{node}</>).replace(/<[^>]+>/g, "");
}

describe("declareIncidentChanges", () => {
  type Input = Parameters<typeof declareIncidentChanges>[0];

  it("lists title and severity for a minimal draft", () => {
    expect(
      declareIncidentChanges(
        asFixture<Input>({ title: "Checkout down", severity: "critical" }),
      ),
    ).toEqual([
      { field: "title", after: "Checkout down" },
      { field: "severity", after: "critical" },
    ]);
  });

  it("leads with the created id and keeps a commander id of 0", () => {
    const rows = declareIncidentChanges(
      asFixture<Input>({
        title: "Checkout down",
        severity: "major",
        summary: "Payments failing",
        commanderId: 0,
        startedAt: "2024-01-01T00:00:00Z",
        statusReportId: 4,
      }),
      { id: 12 },
    );
    expect(rows.map((r) => r.field)).toEqual([
      "id",
      "title",
      "severity",
      "summary",
      "commanderId",
      "startedAt",
      "statusReportId",
    ]);
    expect(rows[0]).toEqual({ field: "id", after: 12 });
    expect(rows[4]).toEqual({ field: "commanderId", after: 0 });
  });
});

describe("updateIncidentChanges", () => {
  type Input = Parameters<typeof updateIncidentChanges>[0];

  it("lists only the provided fields, keeping explicit nulls", () => {
    expect(
      updateIncidentChanges(
        asFixture<Input>({ id: 3, severity: "minor", commanderId: null }),
      ),
    ).toEqual([
      { field: "incidentId", after: 3 },
      { field: "severity", after: "minor" },
      { field: "commanderId", after: null },
    ]);
  });
});

describe("resolveIncidentChanges", () => {
  type Input = Parameters<typeof resolveIncidentChanges>[0];

  it("marks the incident resolved and appends a note when given", () => {
    expect(resolveIncidentChanges(asFixture<Input>({ id: 3 }))).toEqual([
      { field: "incidentId", after: 3 },
      { field: "status", after: "resolved" },
    ]);
    expect(
      resolveIncidentChanges(
        asFixture<Input>({ id: 3, note: "Rolled back" }),
      ).at(-1),
    ).toEqual({ field: "note", after: "Rolled back" });
  });
});

describe("listIncidentsTable", () => {
  type Output = Parameters<typeof listIncidentsTable>[0];

  it("has an empty message and handles a missing output", () => {
    const table = listIncidentsTable(undefined as unknown as Output);
    expect(table.rows).toEqual([]);
    expect(table.empty).toBe("No incidents.");
  });

  it("marks closed incidents and falls back for a missing commander", () => {
    const table = listIncidentsTable(
      asFixture<Output>({
        items: [
          {
            id: 1,
            title: "DNS",
            severity: "major",
            status: "resolved",
            closed: true,
            commander: null,
          },
          {
            id: 2,
            title: "API",
            severity: "minor",
            status: "open",
            closed: false,
            commander: { name: "Ada" },
          },
        ],
      }),
    );
    expect(table.columns.map((c) => c.key)).toEqual([
      "title",
      "severity",
      "status",
      "commander",
      "id",
    ]);
    const [closed, open] = table.rows;
    expect(text(closed.cells.status)).toBe("resolved · closed");
    expect(text(closed.cells.commander)).toBe("-");
    expect(text(open.cells.status)).toBe("open");
    expect(text(open.cells.commander)).toBe("Ada");
    expect(text(open.cells.id)).toBe("2");
  });
});

describe("getIncidentDetails", () => {
  type Output = Parameters<typeof getIncidentDetails>[0];

  const output = asFixture<Output>({
    id: 5,
    title: "Checkout down",
    severity: "critical",
    status: "open",
    commander: null,
    summary: null,
    startedAt: "2024-01-01T00:00:00Z",
    statusReport: { title: "Payments degraded" },
    events: Array.from({ length: 12 }, (_, i) => ({
      type: "status_changed",
      message: `event ${i}`,
    })),
  });

  it("builds an overview section", () => {
    const [overview] = getIncidentDetails(output).sections;
    expect(overview.title).toBeUndefined();
    expect(overview.rows.map((r) => r.label)).toEqual([
      "ID",
      "Title",
      "Severity",
      "Status",
      "Commander",
      "Summary",
      "Started",
      "Status report",
    ]);
    const value = (label: string) =>
      text(overview.rows.find((r) => r.label === label)?.value);
    expect(value("Commander")).toBe("-");
    expect(value("Status report")).toBe("Payments degraded");
  });

  it("caps the timeline at ten events and humanizes their type", () => {
    const timeline = getIncidentDetails(output).sections[1];
    expect(timeline.title).toBe("Timeline");
    expect(timeline.rows).toHaveLength(10);
    expect(timeline.rows[0].label).toBe("status changed");
    expect(text(timeline.rows[9].value)).toBe("event 9");
  });
});
