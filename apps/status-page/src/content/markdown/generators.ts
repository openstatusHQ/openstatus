import type { RouterOutputs } from "@openstatus/api";

import {
  canonicalUrl,
  formatDate,
  formatMs,
  formatPercent,
  frontmatter,
  mdUrl,
  statusLabel,
  table,
} from "./helpers";

export type OverviewPage = NonNullable<RouterOutputs["statusPage"]["get"]>;
export type MonitorDetail = NonNullable<
  RouterOutputs["statusPage"]["getMonitor"]
>;
export type ReportDetail = NonNullable<
  RouterOutputs["statusPage"]["getReport"]
>;
export type MaintenanceDetail = NonNullable<
  RouterOutputs["statusPage"]["getMaintenance"]
>;

function avg(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function generateOverview(page: OverviewPage, baseUrl: string): string {
  const now = Date.now();
  const out: string[] = [];
  out.push(
    frontmatter({
      title: page.title,
      description: page.description,
      canonical: canonicalUrl(baseUrl),
    }),
  );
  out.push(`# ${page.title}\n`);
  out.push(`**Overall status:** ${statusLabel(page.status)}\n`);

  const activeReports = page.statusReports.filter(
    (r) => r.status !== "resolved",
  );
  out.push("## Active incidents\n");
  if (activeReports.length === 0) {
    out.push("No active incidents.\n");
  } else {
    for (const report of activeReports) {
      const latest = report.statusReportUpdates[0];
      out.push(`### ${report.title}\n`);
      out.push(`- Status: ${statusLabel(report.status)}`);
      if (latest) {
        out.push(
          `- Latest update (${formatDate(latest.date)}): ${latest.message}`,
        );
      }
      out.push(`- Details: ${mdUrl(baseUrl, `events/report/${report.id}`)}\n`);
    }
  }

  const activeMaintenance = page.maintenances.filter(
    (m) => m.to && new Date(m.to).getTime() >= now,
  );
  out.push("## Active & upcoming maintenance\n");
  if (activeMaintenance.length === 0) {
    out.push("No active or upcoming maintenance.\n");
  } else {
    for (const m of activeMaintenance) {
      out.push(`### ${m.title}\n`);
      out.push(`- Window: ${formatDate(m.from)} → ${formatDate(m.to)}`);
      out.push(`- Details: ${mdUrl(baseUrl, `events/maintenance/${m.id}`)}\n`);
    }
  }

  out.push("## Components\n");
  const rows: string[][] = [];
  for (const tracker of page.trackers) {
    if (tracker.type === "component") {
      rows.push([
        tracker.component.name,
        statusLabel(tracker.component.status),
      ]);
    } else {
      rows.push([`${tracker.groupName} (group)`, statusLabel(tracker.status)]);
      for (const c of tracker.components) {
        rows.push([`— ${c.name}`, statusLabel(c.status)]);
      }
    }
  }
  out.push(
    rows.length ? table(["Component", "Status"], rows) : "No components.",
  );
  out.push("");

  out.push("## Recent events\n");
  if (page.lastEvents.length === 0) {
    out.push("No recent events.\n");
  } else {
    const eventRows = page.lastEvents.map((e) => [
      e.name,
      e.type,
      statusLabel(e.status),
      formatDate(e.from),
    ]);
    out.push(table(["Event", "Type", "Status", "Date"], eventRows));
    out.push("");
  }

  return `${out.join("\n").trimEnd()}\n`;
}

export function generateMonitorsList(
  page: OverviewPage,
  baseUrl: string,
): string {
  const out: string[] = [];
  out.push(
    frontmatter({
      title: `${page.title} — Monitors`,
      description: `Monitors for ${page.title}`,
      canonical: canonicalUrl(baseUrl, "monitors"),
    }),
  );
  out.push(`# ${page.title} — Monitors\n`);

  if (page.monitors.length === 0) {
    out.push("No public monitors.\n");
  } else {
    const rows = page.monitors.map((m) => [
      m.name,
      statusLabel(m.status),
      mdUrl(baseUrl, `monitors/${m.id}`),
    ]);
    out.push(table(["Monitor", "Status", "Details"], rows));
    out.push("");
  }

  return `${out.join("\n").trimEnd()}\n`;
}

export function generateEventsList(
  page: OverviewPage,
  baseUrl: string,
): string {
  const out: string[] = [];
  out.push(
    frontmatter({
      title: `${page.title} — Events`,
      description: `Incident history and maintenance for ${page.title}`,
      canonical: canonicalUrl(baseUrl, "events"),
    }),
  );
  out.push(`# ${page.title} — Events\n`);

  out.push("## Status reports\n");
  if (page.statusReports.length === 0) {
    out.push("No status reports.\n");
  } else {
    const rows = page.statusReports.map((r) => {
      const latest = r.statusReportUpdates[0];
      return [
        r.title,
        statusLabel(r.status),
        latest ? formatDate(latest.date) : "—",
        mdUrl(baseUrl, `events/report/${r.id}`),
      ];
    });
    out.push(table(["Report", "Status", "Last update", "Details"], rows));
    out.push("");
  }

  out.push("## Maintenance\n");
  if (page.maintenances.length === 0) {
    out.push("No maintenance.\n");
  } else {
    const rows = page.maintenances.map((m) => [
      m.title,
      `${formatDate(m.from)} → ${formatDate(m.to)}`,
      mdUrl(baseUrl, `events/maintenance/${m.id}`),
    ]);
    out.push(table(["Maintenance", "Window", "Details"], rows));
    out.push("");
  }

  return `${out.join("\n").trimEnd()}\n`;
}

export function generateReport(report: ReportDetail, baseUrl: string): string {
  const out: string[] = [];
  out.push(
    frontmatter({
      title: report.title,
      description: `Status report: ${report.title}`,
      canonical: canonicalUrl(baseUrl, `events/report/${report.id}`),
    }),
  );
  out.push(`# ${report.title}\n`);
  out.push(`**Status:** ${statusLabel(report.status)}\n`);

  const components = report.statusReportsToPageComponents
    .map((c) => c.pageComponent?.name)
    .filter((name): name is string => Boolean(name));
  if (components.length > 0) {
    out.push(`**Affected components:** ${components.join(", ")}\n`);
  }

  out.push("## Updates\n");
  if (report.statusReportUpdates.length === 0) {
    out.push("No updates.\n");
  } else {
    for (const update of report.statusReportUpdates) {
      out.push(
        `### ${statusLabel(update.status)} — ${formatDate(update.date)}\n`,
      );
      out.push(`${update.message}\n`);
    }
  }

  return `${out.join("\n").trimEnd()}\n`;
}

export function generateMaintenance(
  maintenance: MaintenanceDetail,
  baseUrl: string,
): string {
  const out: string[] = [];
  out.push(
    frontmatter({
      title: maintenance.title,
      description: `Maintenance: ${maintenance.title}`,
      canonical: canonicalUrl(baseUrl, `events/maintenance/${maintenance.id}`),
    }),
  );
  out.push(`# ${maintenance.title}\n`);
  out.push(
    `**Window:** ${formatDate(maintenance.from)} → ${formatDate(maintenance.to)}\n`,
  );

  const components = maintenance.maintenancesToPageComponents
    .map((c) => c.pageComponent?.name)
    .filter((name): name is string => Boolean(name));
  if (components.length > 0) {
    out.push(`**Affected components:** ${components.join(", ")}\n`);
  }

  out.push("## Details\n");
  out.push(`${maintenance.message}\n`);

  return `${out.join("\n").trimEnd()}\n`;
}

export function generateMonitor(
  monitor: MonitorDetail,
  baseUrl: string,
): string {
  const out: string[] = [];
  out.push(
    frontmatter({
      title: monitor.name,
      description: `Monitor metrics for ${monitor.name} (last 7 days)`,
      canonical: canonicalUrl(baseUrl, `monitors/${monitor.id}`),
    }),
  );
  out.push(`# ${monitor.name}\n`);
  if (monitor.description) out.push(`${monitor.description}\n`);
  out.push(`**URL:** ${monitor.url}\n`);

  // Uptime over the hardcoded 7-day window.
  const uptimeData = monitor.data.uptime?.data ?? [];
  const totals = uptimeData.reduce(
    (acc, d) => ({
      success: acc.success + d.success,
      degraded: acc.degraded + d.degraded,
      error: acc.error + d.error,
    }),
    { success: 0, degraded: 0, error: 0 },
  );
  const totalChecks = totals.success + totals.degraded + totals.error;
  const uptime =
    totalChecks > 0
      ? formatPercent((totals.success + totals.degraded) / totalChecks)
      : "N/A";
  out.push(`**Uptime (last 7 days):** ${uptime} (${totalChecks} checks)\n`);

  // Latency aggregates (mean per percentile across the 7-day window).
  const latencyData = monitor.data.latency?.data ?? [];
  const p50 = avg(latencyData.map((d) => d.p50Latency));
  const p75 = avg(latencyData.map((d) => d.p75Latency));
  const p95 = avg(latencyData.map((d) => d.p95Latency));
  const p99 = avg(latencyData.map((d) => d.p99Latency));
  out.push("## Latency (last 7 days)\n");
  out.push(
    table(
      ["Quantile", "Latency"],
      [
        ["p50", formatMs(p50)],
        ["p75", formatMs(p75)],
        ["p95", formatMs(p95)],
        ["p99", formatMs(p99)],
      ],
    ),
  );
  out.push("");

  // Per-region p75 (mean across the window).
  const regionData = monitor.data.regions?.data ?? [];
  const byRegion = new Map<string, number[]>();
  for (const d of regionData) {
    const list = byRegion.get(d.region) ?? [];
    if (d.p75Latency !== null && d.p75Latency !== undefined) {
      list.push(d.p75Latency);
    }
    byRegion.set(d.region, list);
  }
  out.push("## Latency by region — p75 (last 7 days)\n");
  if (byRegion.size === 0) {
    out.push("No regional data.\n");
  } else {
    const rows = Array.from(byRegion.entries())
      .map(([region, values]) => ({ region, p75: avg(values) }))
      .sort((a, b) => (b.p75 ?? 0) - (a.p75 ?? 0))
      .map((r) => [r.region, formatMs(r.p75)]);
    out.push(table(["Region", "p75"], rows));
    out.push("");
  }

  return `${out.join("\n").trimEnd()}\n`;
}
