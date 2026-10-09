import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { listMonitorsTable } from "./list-monitors";
import { listNotificationsTable } from "./list-notifications";
import { listPageComponentsTable } from "./list-page-components";
import { listPrivateLocationsTable } from "./list-private-locations";
import { listStatusPagesTable } from "./list-status-pages";
import { listStatusReportsTable } from "./list-status-reports";
import { searchContentTable } from "./search-content";
import { searchDocsTable } from "./search-docs";

// safe because the mappers only read the fields each fixture sets
function asOutput<T>(value: Record<string, unknown> | undefined): T {
  return value as T;
}

function html(node: ReactNode) {
  return renderToStaticMarkup(<>{node}</>);
}

function text(node: ReactNode) {
  return html(node).replace(/<[^>]+>/g, "");
}

function hrefOf(node: ReactNode) {
  return html(node).match(/<a [^>]*href="([^"]+)"/)?.[1];
}

describe("listMonitorsTable", () => {
  const table = listMonitorsTable(
    asOutput({
      items: [
        {
          id: 3,
          name: "API",
          jobType: "http",
          periodicity: "1m",
          regions: [],
          active: true,
        },
      ],
    }),
  );

  it("links to the monitor overview", () => {
    expect(hrefOf(table.rows[0].cells.name)).toBe("/monitors/3/overview");
  });

  it("upper-cases the job type and shows a dash without regions", () => {
    expect(text(table.rows[0].cells.jobType)).toBe("HTTP");
    expect(text(table.rows[0].cells.regions)).toBe("—");
  });

  it("handles a missing output", () => {
    const empty = listMonitorsTable(asOutput(undefined));
    expect(empty.rows).toEqual([]);
    expect(empty.empty).toBe("No monitors.");
  });
});

describe("listNotificationsTable", () => {
  const table = listNotificationsTable(
    asOutput({
      items: [
        { id: 1, name: "Slack", provider: "slack", monitorIds: [4, 5] },
        { id: 2, name: "Mail", provider: "email", monitorIds: [] },
      ],
    }),
  );

  it("links to the notification", () => {
    expect(hrefOf(table.rows[0].cells.name)).toBe("/notifications/1");
  });

  it("summarises attached monitors", () => {
    expect(text(table.rows[0].cells.monitors)).toBe("2 (4, 5)");
    expect(text(table.rows[1].cells.monitors)).toBe("none");
  });
});

describe("listPageComponentsTable", () => {
  const table = listPageComponentsTable(
    asOutput({
      items: [
        { id: 9, name: "API", type: "monitor", pageId: 2, monitorId: 4 },
        { id: 10, name: "Docs", type: "static", pageId: 2, monitorId: null },
      ],
    }),
  );

  it("links to the page's components", () => {
    expect(hrefOf(table.rows[0].cells.name)).toBe("/status-pages/2/components");
  });

  it("shows the monitor id, or a placeholder for static components", () => {
    expect(text(table.rows[0].cells.monitor)).toContain("4");
    expect(text(table.rows[1].cells.monitor)).not.toContain("4");
  });
});

describe("listPrivateLocationsTable", () => {
  const table = listPrivateLocationsTable(
    asOutput({
      items: [
        {
          id: 1,
          name: "office",
          monitorIds: [],
          metadata: { rack: "a1" },
          lastSeenAt: null,
        },
      ],
    }),
  );

  it("links to the private locations settings", () => {
    expect(hrefOf(table.rows[0].cells.name)).toBe(
      "/settings/private-locations",
    );
  });

  it("shows 'never' for a location that never reported", () => {
    expect(text(table.rows[0].cells.lastSeenAt)).toBe("never");
    expect(text(table.rows[0].cells.monitors)).toBe("none");
  });

  it("renders metadata as pills", () => {
    expect(text(table.rows[0].cells.metadata)).toContain("a1");
  });
});

describe("listStatusPagesTable", () => {
  it("links to the page's status reports", () => {
    const table = listStatusPagesTable(
      asOutput({ items: [{ id: 2, title: "Acme", slug: "acme" }] }),
    );
    expect(hrefOf(table.rows[0].cells.title)).toBe(
      "/status-pages/2/status-reports",
    );
    expect(text(table.rows[0].cells.slug)).toBe("acme");
  });
});

describe("listStatusReportsTable", () => {
  const table = listStatusReportsTable(
    asOutput({
      items: [
        { id: 5, title: "Outage", status: "investigating", pageId: 2 },
        { id: 6, title: "Orphan", status: "resolved", pageId: null },
      ],
    }),
  );

  it("links a report to its page", () => {
    expect(hrefOf(table.rows[0].cells.title)).toBe(
      "/status-pages/2/status-reports/5",
    );
  });

  it("does not link a report without a page", () => {
    expect(hrefOf(table.rows[1].cells.title)).toBeUndefined();
    expect(text(table.rows[1].cells.title)).toContain("Orphan");
  });
});

describe("search tables", () => {
  const results = [
    {
      path: "/docs/a",
      url: "https://docs.openstatus.dev/a",
      title: "A",
      snippet: "about a",
      type: "blog",
    },
  ];

  it("links docs results externally in a new tab", () => {
    const out = html(
      searchDocsTable(asOutput({ results })).rows[0].cells.title,
    );
    expect(out).toContain('href="https://docs.openstatus.dev/a"');
    expect(out).toContain('target="_blank"');
  });

  it("uses the result path as the row id", () => {
    expect(searchContentTable(asOutput({ results })).rows[0].id).toBe(
      "/docs/a",
    );
  });

  it("surfaces the search error as the empty message", () => {
    expect(searchDocsTable(asOutput({ error: "rate limited" })).empty).toBe(
      "rate limited",
    );
    expect(searchContentTable(asOutput({ results: [] })).empty).toBe(
      "No results.",
    );
  });
});
