import type { RouterOutputs } from "@openstatus/api";

import {
  canonicalUrl,
  dominantDayStatus,
  formatDay,
  formatDayTime,
  formatMs,
  formatPercent,
  frontmatter,
  humanDuration,
  legend,
  mdUrl,
  relativeTime,
  reportStatusEmoji,
  sparkline,
  statusEmoji,
  statusLabel,
  table,
  uptimeBar,
} from "./helpers";

export type OverviewPage = NonNullable<RouterOutputs["statusPage"]["get"]>;
export type UptimeComponent = NonNullable<
  RouterOutputs["statusPage"]["getUptime"]
>[number];
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

export function generateOverview(
  page: OverviewPage,
  components: UptimeComponent[],
  baseUrl: string,
  showUptime = true,
): string {
  const out: string[] = [];
  out.push(
    frontmatter({
      title: page.title,
      description: page.description,
      canonical: canonicalUrl(baseUrl),
    }),
  );
  out.push(`# ${page.title}\n`);
  if (page.description) out.push(`> ${page.description}\n`);
  out.push(`${statusEmoji(page.status)} **${statusLabel(page.status)}**\n`);

  const activeReports = page.statusReports.filter(
    (r) => r.status !== "resolved",
  );
  if (activeReports.length > 0) {
    out.push("## Active incidents\n");
    for (const report of activeReports) {
      const latest = report.statusReportUpdates[0];
      out.push(
        `- ${reportStatusEmoji(report.status)} **${report.title}** — ${statusLabel(report.status)} · ${mdUrl(baseUrl, `events/report/${report.id}`)}`,
      );
      if (latest) out.push(`  ${latest.message}`);
    }
    out.push("");
  }

  out.push("## Components\n");
  if (components.length === 0) {
    out.push("No components.\n");
  } else {
    const used = new Set<string>();
    for (const c of components) {
      for (const d of c.data) used.add(dominantDayStatus(d.bar));
    }
    const legendLine = legend(used);
    if (legendLine) out.push(`${legendLine}\n`);
    for (const c of components) {
      const days = c.data.length;
      const metric = showUptime
        ? c.uptime
        : statusLabel(dominantDayStatus(c.data[c.data.length - 1]?.bar ?? []));
      out.push(`**${c.name}** — ${metric} · \`${days}d ago → today\``);
      out.push(uptimeBar(c.data));
      out.push("");
    }
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
      `${statusEmoji(m.status)} ${m.name}`,
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
  const now = Date.now();
  const out: string[] = [];
  out.push(
    frontmatter({
      title: `${page.title} — Events`,
      description: `Incident history and maintenance for ${page.title}`,
      canonical: canonicalUrl(baseUrl, "events"),
    }),
  );
  out.push(`# ${page.title} — Events · Reports\n`);

  if (page.statusReports.length === 0) {
    out.push("No status reports.\n");
  } else {
    for (const report of page.statusReports) {
      const updates = report.statusReportUpdates;
      const oldest = updates[updates.length - 1];
      const start = oldest?.date ?? report.createdAt;
      const components = report.statusReportsToPageComponents
        .map((c) => c.pageComponent?.name)
        .filter((name): name is string => Boolean(name));

      const meta = [
        start ? formatDay(start) : null,
        start ? relativeTime(start, now) : null,
        components.length ? `affects: ${components.join(", ")}` : null,
        oldest && updates[0]
          ? humanDuration(oldest.date, updates[0].date)
          : null,
      ].filter(Boolean);

      out.push(
        `### ${reportStatusEmoji(oldest?.status ?? report.status)}→${reportStatusEmoji(report.status)} ${report.title}`,
      );
      if (meta.length) out.push(`${meta.join(" · ")}`);
      for (const update of updates) {
        out.push(
          `- ${reportStatusEmoji(update.status)} **${statusLabel(update.status)}** — ${formatDayTime(update.date)}`,
        );
        if (update.message) out.push(`  ${update.message}`);
      }
      out.push("");
    }
  }

  if (page.maintenances.length > 0) {
    out.push("## Maintenance\n");
    for (const m of page.maintenances) {
      out.push(`### ${statusEmoji("info")} ${m.title}`);
      out.push(
        `${formatDay(m.from)} · ${humanDuration(m.from, m.to)} · ${mdUrl(baseUrl, `events/maintenance/${m.id}`)}`,
      );
      if (m.message) out.push(`  ${m.message}`);
      out.push("");
    }
  }

  return `${out.join("\n").trimEnd()}\n`;
}

export function generateReport(report: ReportDetail, baseUrl: string): string {
  const now = Date.now();
  const updates = report.statusReportUpdates;
  const oldest = updates[updates.length - 1];
  const out: string[] = [];
  out.push(
    frontmatter({
      title: report.title,
      description: `Status report: ${report.title}`,
      canonical: canonicalUrl(baseUrl, `events/report/${report.id}`),
    }),
  );
  out.push(
    `# ${reportStatusEmoji(oldest?.status ?? report.status)}→${reportStatusEmoji(report.status)} ${report.title}\n`,
  );

  const components = report.statusReportsToPageComponents
    .map((c) => c.pageComponent?.name)
    .filter((name): name is string => Boolean(name));
  const meta = [
    oldest
      ? `${formatDay(oldest.date)} · ${relativeTime(oldest.date, now)}`
      : null,
    components.length ? `affects: ${components.join(", ")}` : null,
    oldest && updates[0] ? humanDuration(oldest.date, updates[0].date) : null,
  ].filter(Boolean);
  if (meta.length) out.push(`${meta.join(" · ")}\n`);

  out.push("## Updates\n");
  if (updates.length === 0) {
    out.push("No updates.\n");
  } else {
    for (const update of updates) {
      out.push(
        `### ${reportStatusEmoji(update.status)} ${statusLabel(update.status)} — ${formatDayTime(update.date)}\n`,
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
  out.push(`# ${statusEmoji("info")} ${maintenance.title}\n`);
  out.push(
    `**Window:** ${formatDayTime(maintenance.from)} → ${formatDayTime(maintenance.to)} · ${humanDuration(maintenance.from, maintenance.to)}\n`,
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
  if (monitor.description) out.push(`> ${monitor.description}\n`);

  const latencyData = [...(monitor.data.latency?.data ?? [])].sort(
    (a, b) => a.timestamp - b.timestamp,
  );
  const p75Series = latencyData.map((d) => d.p75Latency);

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
  const regionAverages = Array.from(byRegion.entries())
    .map(([region, values]) => ({ region, p75: avg(values) }))
    .sort((a, b) => (a.p75 ?? Infinity) - (b.p75 ?? Infinity));
  const fastest = regionAverages[0]?.region;

  const p75Min = p75Series.length ? Math.min(...p75Series) : null;
  const p75Max = p75Series.length ? Math.max(...p75Series) : null;

  out.push(
    table(
      ["Metric", "Value"],
      [
        [
          "Global latency (p75)",
          p75Min !== null ? `${formatMs(p75Min)} – ${formatMs(p75Max)}` : "—",
        ],
        [
          "Region latency",
          byRegion.size
            ? `${byRegion.size} regions · fastest: ${fastest}`
            : "—",
        ],
        ["Uptime (last 7 days)", `${uptime} · ${totalChecks} checks`],
      ],
    ),
  );
  out.push("");

  // Block sparkline of global p75 over the window.
  if (p75Series.length > 1) {
    out.push("## Global latency · p75 · last 7 days\n");
    out.push(`\`${sparkline(p75Series)}\`\n`);
    out.push(
      `${formatMs(p75Min)} – ${formatMs(p75Max)} · ${formatDay(latencyData[0].timestamp)} → today\n`,
    );
  }

  out.push("## Latency percentiles (last 7 days)\n");
  out.push(
    table(
      ["Quantile", "Latency"],
      [
        ["p50", formatMs(avg(latencyData.map((d) => d.p50Latency)))],
        ["p75", formatMs(avg(p75Series))],
        ["p95", formatMs(avg(latencyData.map((d) => d.p95Latency)))],
        ["p99", formatMs(avg(latencyData.map((d) => d.p99Latency)))],
      ],
    ),
  );
  out.push("");

  out.push("## Latency by region — p75 (last 7 days)\n");
  if (regionAverages.length === 0) {
    out.push("No regional data.\n");
  } else {
    const rows = [...regionAverages]
      .sort((a, b) => (b.p75 ?? 0) - (a.p75 ?? 0))
      .map((r) => [r.region, formatMs(r.p75)]);
    out.push(table(["Region", "p75"], rows));
    out.push("");
  }

  return `${out.join("\n").trimEnd()}\n`;
}
