import type { RouterOutputs } from "@openstatus/api";

import { flattenComponents, worstComponent } from "../status-vocab";
import {
  canonicalUrl,
  componentImpact,
  componentImpactExplicit,
  dominantDayStatus,
  escapeLinkLabel,
  type EventLogRow,
  eventLog,
  formatDay,
  formatDayTime,
  formatMs,
  formatPercent,
  formatStamp,
  frontmatter,
  humanDuration,
  legend,
  machineReadable,
  mdUrl,
  navLine,
  relativeTime,
  reportStatusGlyph,
  statusGlyph,
  statusLabel,
  table,
  uptimeBar,
  worstImpact,
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

// Detail payloads don't carry the page's homepage/contact URLs — thread them in
// from getLight so a directly-fetched detail page has those nav anchors.
type PageUrls = { homepageUrl?: string | null; contactUrl?: string | null };

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
  const now = Date.now();
  const out: string[] = [];

  const activeReports = page.statusReports.filter(
    (r) => r.status !== "resolved",
  );
  const activeMaintenance = page.maintenances.filter(
    (m) => m.to && new Date(m.to).getTime() >= now,
  );
  const flatComponents = flattenComponents(page.trackers);

  out.push(
    frontmatter({
      title: page.title,
      description: page.description,
      baseUrl,
      canonical: canonicalUrl(baseUrl),
      homepageUrl: page.homepageUrl,
      contactUrl: page.contactUrl,
      live: {
        status: page.status,
        // Minute-granular so the body (and its ETag) stays stable within the
        // minute, matching the visible timestamp — full precision would bust
        // the conditional-GET window on every request.
        fetchedAt: Math.floor(now / 60_000) * 60_000,
        activeReports: activeReports.length,
        activeMaintenance: activeMaintenance.length,
        componentsOperational: flatComponents.filter(
          (c) => c.status === "success",
        ).length,
        componentsTotal: flatComponents.length,
        worstComponent: worstComponent(flatComponents),
      },
    }),
  );
  out.push(`# ${page.title}\n`);
  out.push(
    `${navLine(
      [
        { label: "**Status**" },
        ...(page.monitors.length > 0
          ? [{ label: "Monitors", url: mdUrl("monitors") }]
          : []),
        { label: "Events", url: mdUrl("events") },
      ],
      " · ",
    )}\n`,
  );
  if (page.description) out.push(`> ${page.description}\n`);
  out.push(
    `\`${statusGlyph(page.status)}\` **${statusLabel(page.status)}** · ${formatStamp(now)}\n`,
  );

  const componentNames = (
    links: { pageComponent?: { name?: string | null } | null }[],
  ) =>
    links
      .map((l) => l.pageComponent?.name)
      .filter((name): name is string => Boolean(name));

  if (activeReports.length > 0) {
    out.push("## Active incidents\n");
    for (const report of activeReports) {
      const latest = report.statusReportUpdates[0];
      const affects = componentNames(report.statusReportsToPageComponents);
      const head = [
        `- ${reportStatusGlyph(report.status)} **${report.title}** — ${statusLabel(report.status)}`,
        affects.length ? `affects: ${affects.join(", ")}` : null,
        mdUrl(`events/report/${report.id}`),
      ].filter(Boolean);
      out.push(head.join(" · "));
      if (latest) out.push(`  ${latest.message}`);
    }
    out.push("");
  }

  if (activeMaintenance.length > 0) {
    out.push("## Active & upcoming maintenance\n");
    for (const m of activeMaintenance) {
      const affects = componentNames(m.maintenancesToPageComponents);
      const head = [
        `- ${statusGlyph("info")} **${m.title}** — ${formatDay(m.from)} → ${formatDay(m.to)}`,
        affects.length ? `affects: ${affects.join(", ")}` : null,
        mdUrl(`events/maintenance/${m.id}`),
      ].filter(Boolean);
      out.push(head.join(" · "));
      if (m.message) out.push(`  ${m.message}`);
    }
    out.push("");
  }

  out.push("## Components\n");

  // `components` (uptime data) has no stable order and is flat. Drive
  // iteration from `page.trackers` instead — the same ordered, grouped
  // structure the HTML page renders — and join uptime data by id.
  const uptimeById = new Map(components.map((c) => [c.pageComponentId, c]));
  const rows: { groupName: string | null; component: UptimeComponent }[] = [];
  for (const tracker of page.trackers) {
    if (tracker.type === "component") {
      const u = uptimeById.get(tracker.component.id);
      if (u) rows.push({ groupName: null, component: u });
    } else {
      for (const comp of tracker.components) {
        const u = uptimeById.get(comp.id);
        if (u) rows.push({ groupName: tracker.groupName, component: u });
      }
    }
  }
  // Defensive fallback: if trackers and uptime diverge, don't drop components.
  if (rows.length === 0 && components.length > 0) {
    for (const c of components) rows.push({ groupName: null, component: c });
  }

  if (rows.length === 0) {
    out.push("No components.\n");
  } else {
    out.push(`${legend()}\n`);

    const lastActivity = (r: OverviewPage["statusReports"][number]) => {
      const dates = r.statusReportUpdates.map((u) =>
        new Date(u.date).getTime(),
      );
      return dates.length
        ? Math.max(...dates)
        : r.createdAt
          ? new Date(r.createdAt).getTime()
          : 0;
    };

    let currentGroup: string | null = null;
    for (const { groupName, component: c } of rows) {
      if (groupName && groupName !== currentGroup)
        out.push(`### ${groupName}\n`);
      currentGroup = groupName;
      const days = c.data.length;
      const metric = showUptime
        ? c.uptime
        : statusLabel(dominantDayStatus(c.data[c.data.length - 1]?.bar ?? []));
      out.push(`**${c.name}** — ${metric} · \`${days}d ago → today\``);
      out.push(uptimeBar(c.data));

      // Only events within the chart window (c.data is oldest → newest); older
      // ones fall off the bar and live on the /events page.
      const windowStart = c.data[0]?.day
        ? new Date(c.data[0].day).getTime()
        : 0;

      // Link the reports/maintenances that explain this component's colored days.
      const events = [
        ...page.statusReports
          .filter((r) =>
            r.statusReportsToPageComponents.some(
              (x) => x.pageComponentId === c.pageComponentId,
            ),
          )
          .map((r) => ({
            sort: lastActivity(r),
            link: `[${escapeLinkLabel(r.title)}](${mdUrl(`events/report/${r.id}`)})`,
          })),
        ...page.maintenances
          .filter((m) =>
            m.maintenancesToPageComponents.some(
              (x) => x.pageComponentId === c.pageComponentId,
            ),
          )
          .map((m) => ({
            sort: new Date(m.from).getTime(),
            link: `[${escapeLinkLabel(m.title)}](${mdUrl(`events/maintenance/${m.id}`)})`,
          })),
      ]
        .filter((e) => e.sort >= windowStart)
        .sort((a, b) => b.sort - a.sort);

      if (events.length > 0) {
        const shown = events.slice(0, 5).map((e) => e.link);
        const extra = events.length - shown.length;
        const more = extra > 0 ? ` · [+${extra} more](${mdUrl("events")})` : "";
        out.push(`Events: ${shown.join(" · ")}${more}`);
      }
      out.push("");
    }
  }

  if (page.accessType === "public") out.push(machineReadable());

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
      baseUrl,
      canonical: canonicalUrl(baseUrl, "monitors"),
      homepageUrl: page.homepageUrl,
      contactUrl: page.contactUrl,
    }),
  );
  out.push(`# ${page.title} — Monitors\n`);
  out.push(
    `${navLine(
      [
        { label: "Status", url: mdUrl() },
        { label: "**Monitors**" },
        { label: "Events", url: mdUrl("events") },
      ],
      " · ",
    )}\n`,
  );

  if (page.monitors.length === 0) {
    out.push("No public monitors.\n");
  } else {
    const rows = page.monitors.map((m) => [
      `${statusGlyph(m.status)} ${m.name}`,
      statusLabel(m.status),
      mdUrl(`monitors/${m.id}`),
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
      baseUrl,
      canonical: canonicalUrl(baseUrl, "events"),
      homepageUrl: page.homepageUrl,
      contactUrl: page.contactUrl,
    }),
  );
  out.push(`# ${page.title} — Events · Reports\n`);
  out.push(
    `${navLine(
      [
        { label: "Status", url: mdUrl() },
        ...(page.monitors.length > 0
          ? [{ label: "Monitors", url: mdUrl("monitors") }]
          : []),
        { label: "**Events**" },
      ],
      " · ",
    )}\n`,
  );

  const logRows: EventLogRow[] = [];
  for (const report of page.statusReports) {
    for (const update of report.statusReportUpdates) {
      logRows.push({
        timestamp: update.date,
        label: statusLabel(update.status).toUpperCase(),
        glyph: reportStatusGlyph(update.status),
        ref: `report/${report.id}`,
        title: report.title,
      });
    }
  }
  for (const m of page.maintenances) {
    logRows.push({
      timestamp: m.from,
      label: "MAINTENANCE",
      glyph: statusGlyph("info"),
      ref: `maintenance/${m.id}`,
      title: m.title,
    });
    // Only log a COMPLETED entry once the window has actually ended. (`m.to`
    // is non-null per schema; the truthy check is just defensive.)
    if (m.to && new Date(m.to).getTime() <= now) {
      logRows.push({
        timestamp: m.to,
        label: "COMPLETED",
        glyph: statusGlyph("success"),
        ref: `maintenance/${m.id}`,
        title: m.title,
      });
    }
  }
  if (logRows.length > 0) {
    out.push("## Event log\n");
    out.push(`${eventLog(logRows)}\n`);
  }

  if (page.statusReports.length === 0) {
    out.push("No status reports.\n");
  } else {
    for (const report of page.statusReports) {
      const updates = report.statusReportUpdates;
      const oldest = updates[updates.length - 1];
      const start = oldest?.date ?? report.createdAt;

      const componentName = new Map<number, string>();
      for (const c of report.statusReportsToPageComponents) {
        if (c.pageComponent?.name)
          componentName.set(c.pageComponentId, c.pageComponent.name);
      }

      // Worst impact each component reached over the report's lifetime.
      const impactByComponent = new Map<number, string>();
      for (const u of updates) {
        for (const ci of u.statusReportUpdateToPageComponents ?? []) {
          const prev = impactByComponent.get(ci.pageComponentId);
          impactByComponent.set(
            ci.pageComponentId,
            prev ? (worstImpact([prev, ci.impact]) ?? ci.impact) : ci.impact,
          );
        }
      }
      const affects = report.statusReportsToPageComponents
        .map((c) => {
          const name = c.pageComponent?.name;
          if (!name) return null;
          return componentImpact(
            name,
            impactByComponent.get(c.pageComponentId),
          );
        })
        .filter((v): v is string => Boolean(v));

      const meta = [
        start ? formatDay(start) : null,
        start ? relativeTime(start, now) : null,
        affects.length ? `affects: ${affects.join(", ")}` : null,
        oldest && updates[0]
          ? humanDuration(oldest.date, updates[0].date)
          : null,
      ].filter(Boolean);

      out.push(
        `### [${escapeLinkLabel(report.title)}](${mdUrl(`events/report/${report.id}`)})`,
      );
      if (meta.length) out.push(`${meta.join(" · ")}`);
      for (const update of updates) {
        const updateAffects = (update.statusReportUpdateToPageComponents ?? [])
          .map((ci) => {
            const name = componentName.get(ci.pageComponentId);
            return name ? componentImpactExplicit(name, ci.impact) : null;
          })
          .filter((v): v is string => Boolean(v));
        const head = `- ${reportStatusGlyph(update.status)} ${statusLabel(update.status)} — ${formatDayTime(update.date)}`;
        out.push(
          updateAffects.length ? `${head} · ${updateAffects.join(", ")}` : head,
        );
      }
      out.push("");
    }
  }

  if (page.maintenances.length > 0) {
    out.push("## Maintenance\n");
    for (const m of page.maintenances) {
      const affects = m.maintenancesToPageComponents
        .map((c) => c.pageComponent?.name)
        .filter((name): name is string => Boolean(name));
      const meta = [
        formatDay(m.from),
        m.to ? humanDuration(m.from, m.to) : null,
        affects.length ? `affects: ${affects.join(", ")}` : null,
      ].filter(Boolean);
      out.push(
        `### [${escapeLinkLabel(m.title)}](${mdUrl(`events/maintenance/${m.id}`)})`,
      );
      out.push(meta.join(" · "));
      out.push("");
    }
  }

  return `${out.join("\n").trimEnd()}\n`;
}

export function generateReport(
  report: ReportDetail,
  baseUrl: string,
  page?: PageUrls,
): string {
  const now = Date.now();
  const updates = report.statusReportUpdates;
  const oldest = updates[updates.length - 1];
  const latest = updates[0];

  const componentName = new Map<number, string>();
  for (const c of report.statusReportsToPageComponents) {
    if (c.pageComponent?.name)
      componentName.set(c.pageComponentId, c.pageComponent.name);
  }
  const components = report.statusReportsToPageComponents
    .map((c) => c.pageComponent?.name)
    .filter((name): name is string => Boolean(name));

  const description =
    [
      latest ? statusLabel(latest.status) : null,
      components.length ? `affects ${components.join(", ")}` : null,
      oldest ? formatDay(oldest.date) : null,
    ]
      .filter(Boolean)
      .join(" · ") || `Status report: ${report.title}`;

  const out: string[] = [];
  out.push(
    frontmatter({
      title: report.title,
      description,
      baseUrl,
      canonical: canonicalUrl(baseUrl, `events/report/${report.id}`),
      homepageUrl: page?.homepageUrl,
      contactUrl: page?.contactUrl,
    }),
  );
  out.push(`# ${report.title}\n`);
  out.push(
    `${navLine([
      { label: "Status", url: mdUrl() },
      { label: "Events", url: mdUrl("events") },
      { label: report.title },
    ])}\n`,
  );
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
      const updateAffects = (update.statusReportUpdateToPageComponents ?? [])
        .map((ci) => {
          const name = componentName.get(ci.pageComponentId);
          return name ? componentImpactExplicit(name, ci.impact) : null;
        })
        .filter((v): v is string => Boolean(v));
      out.push(
        `### ${reportStatusGlyph(update.status)} ${statusLabel(update.status)} — ${formatDayTime(update.date)}\n`,
      );
      if (updateAffects.length)
        out.push(`affects: ${updateAffects.join(", ")}\n`);
      out.push(`${update.message}\n`);
    }
  }

  return `${out.join("\n").trimEnd()}\n`;
}

export function generateMaintenance(
  maintenance: MaintenanceDetail,
  baseUrl: string,
  page?: PageUrls,
): string {
  const out: string[] = [];
  out.push(
    frontmatter({
      title: maintenance.title,
      description: `Maintenance: ${maintenance.title}`,
      baseUrl,
      canonical: canonicalUrl(baseUrl, `events/maintenance/${maintenance.id}`),
      homepageUrl: page?.homepageUrl,
      contactUrl: page?.contactUrl,
    }),
  );
  out.push(`# ${maintenance.title}\n`);
  out.push(
    `${navLine([
      { label: "Status", url: mdUrl() },
      { label: "Events", url: mdUrl("events") },
      { label: maintenance.title },
    ])}\n`,
  );
  const windowLine = [
    `${formatDayTime(maintenance.from)} → ${formatDayTime(maintenance.to)}`,
    maintenance.to
      ? humanDuration(maintenance.from, maintenance.to)
      : "ongoing",
  ].join(" · ");
  out.push(`**Window:** ${windowLine}\n`);

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
  page?: PageUrls,
): string {
  const out: string[] = [];
  out.push(
    frontmatter({
      title: monitor.name,
      description: `Monitor metrics for ${monitor.name} (last 7 days)`,
      baseUrl,
      canonical: canonicalUrl(baseUrl, `monitors/${monitor.id}`),
      homepageUrl: page?.homepageUrl,
      contactUrl: page?.contactUrl,
    }),
  );
  out.push(`# ${monitor.name}\n`);
  out.push(
    `${navLine([
      { label: "Status", url: mdUrl() },
      { label: "Monitors", url: mdUrl("monitors") },
      { label: monitor.name },
    ])}\n`,
  );
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
