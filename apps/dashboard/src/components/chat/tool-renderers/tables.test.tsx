import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { DetailsTable } from "./details-table";
import { getMonitorStatusTable } from "./get-monitor-status";
import { listAuditLogsTable } from "./list-audit-logs";
import { listMaintenancesTable } from "./list-maintenances";
import { listResponseLogsTable } from "./list-response-logs";
import { ResultTable } from "./result-table";

// safe because the mappers only read the fields each fixture sets
function asOutput<T>(value: Record<string, unknown>): T {
  return value as T;
}

function html(node: ReactNode) {
  return renderToStaticMarkup(<>{node}</>);
}

function strip(markup: string) {
  return markup.replace(/<[^>]+>/g, "");
}

function text(node: ReactNode) {
  return strip(html(node));
}

describe("ResultTable", () => {
  it("shows the empty message without rows", () => {
    const out = html(<ResultTable columns={[]} rows={[]} empty="Nothing." />);
    expect(out).not.toContain("<table");
    expect(strip(out)).toBe("Nothing.");
  });

  it("renders headers and cells in column order", () => {
    const out = html(
      <ResultTable
        columns={[
          { key: "b", header: "B" },
          { key: "a", header: "A", cellClassName: "font-mono" },
        ]}
        rows={[{ id: 1, cells: { a: "a1", b: "b1" } }]}
        empty="Nothing."
      />,
    );
    expect(out.match(/<th[^>]*>([^<]*)<\/th>/g)?.map(strip)).toEqual([
      "B",
      "A",
    ]);
    expect(out.match(/<td[^>]*>([^<]*)<\/td>/g)?.map(strip)).toEqual([
      "b1",
      "a1",
    ]);
    expect(out).toMatch(/<td[^>]*class="[^"]*font-mono[^"]*"[^>]*>a1/);
  });
});

describe("DetailsTable", () => {
  it("falls back to a default empty message", () => {
    expect(text(<DetailsTable sections={[{ rows: [] }]} />)).toBe(
      "No details to show.",
    );
    expect(text(<DetailsTable sections={[]} empty="Gone." />)).toBe("Gone.");
  });

  it("renders section titles and label/value rows", () => {
    const out = text(
      <DetailsTable
        sections={[
          { title: "Monitor", rows: [{ label: "ID", value: "42" }] },
          { rows: [{ label: "Name", value: "API" }] },
        ]}
      />,
    );
    expect(out).toBe("MonitorID42NameAPI");
  });
});

describe("listAuditLogsTable", () => {
  type Output = Parameters<typeof listAuditLogsTable>[0];

  it("colours actions by verb and joins the entity reference", () => {
    const table = listAuditLogsTable(
      asOutput<Output>({
        items: [
          "monitor.create",
          "page.update",
          "page.delete",
          "user.login",
        ].map((action, i) => ({
          id: i,
          action,
          entityType: "monitor",
          entityId: "7",
          actor: "user:1",
          createdAt: "2024-01-01T00:00:00Z",
        })),
      }),
    );
    const badges = table.rows.map((r) => html(r.cells.action));
    expect(badges[0]).toContain("text-success");
    expect(badges[1]).toContain("text-info");
    expect(badges[2]).toContain("text-destructive");
    expect(badges[3]).toContain("text-muted-foreground");
    expect(text(table.rows[0].cells.entity)).toBe("monitor#7");
    expect(text(table.rows[0].cells.actor)).toBe("user:1");
  });
});

describe("listMaintenancesTable", () => {
  type Output = Parameters<typeof listMaintenancesTable>[0];

  it("splits the duration into amount and unit", () => {
    const table = listMaintenancesTable(
      asOutput<Output>({
        items: [
          {
            id: 1,
            title: "Upgrade",
            from: "2024-01-01T00:00:00Z",
            to: "2024-01-01T02:00:00Z",
            pageId: null,
          },
          {
            id: 2,
            title: "Patch",
            from: "2024-01-01T00:00:00Z",
            to: "2024-01-01T00:30:00Z",
            pageId: 9,
          },
        ],
      }),
    );
    expect(text(table.rows[0].cells.duration)).toBe("2hours");
    expect(text(table.rows[1].cells.duration)).toBe("30minutes");
    expect(text(table.rows[0].cells.page)).toBe("-");
    expect(text(table.rows[1].cells.page)).toBe("9");
  });

  it("handles a missing output", () => {
    expect(listMaintenancesTable(undefined as unknown as Output).rows).toEqual(
      [],
    );
  });
});

describe("listResponseLogsTable", () => {
  type Output = Parameters<typeof listResponseLogsTable>[0];

  const log = {
    id: "log_1",
    monitorId: "1",
    region: "ams",
    requestStatus: "error",
    trigger: "cron",
    statusCode: 503,
    latency: 120,
    cronTimestamp: 0,
    timestamp: Date.UTC(2024, 0, 1),
    timing: null,
  };

  it("colours the indicator and status code", () => {
    const [row] = listResponseLogsTable(asOutput<Output>({ logs: [log] })).rows;
    expect(row.id).toBe("log_1");
    expect(html(row.cells.indicator)).toContain("bg-destructive");
    expect(html(row.cells.status)).toContain("text-destructive");
    expect(text(row.cells.status)).toBe("503");
    expect(text(row.cells.latency)).toBe("120ms");
  });

  it("uses placeholders for missing id, status and timing", () => {
    const [row] = listResponseLogsTable(
      asOutput<Output>({
        logs: [{ ...log, id: null, requestStatus: null, statusCode: null }],
      }),
    ).rows;
    expect(row.id).toBe("row-0");
    expect(text(row.cells.indicator)).toBe("-");
    expect(text(row.cells.status)).toBe("—");
    expect(text(row.cells.timing)).toBe("-");
    expect(text(row.cells.id)).toBe("—");
  });
});

describe("getMonitorStatusTable", () => {
  type Output = Parameters<typeof getMonitorStatusTable>[0];

  it("keys rows by region and colours the status", () => {
    const table = getMonitorStatusTable(
      asOutput<Output>({
        regions: [
          { region: "ams", status: "active" },
          { region: "iad", status: "degraded" },
          { region: "sin", status: "error" },
        ],
      }),
    );
    expect(table.rows.map((r) => r.id)).toEqual(["ams", "iad", "sin"]);
    expect(table.rows.map((r) => html(r.cells.status))).toEqual([
      expect.stringContaining("text-success"),
      expect.stringContaining("text-warning"),
      expect.stringContaining("text-destructive"),
    ]);
  });
});
