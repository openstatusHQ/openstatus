import {
  formatDuration,
  getStatusAnswer,
  summarizeHistory,
} from "../app/(landing)/status/utils";

export type MdStatus = { indicator: string; status: string };

export type MdIncident = {
  name: string;
  status: string;
  impact: string | null;
  url: string;
  startedAt: Date | null;
  createdAt: Date;
  resolvedAt: Date | null;
};

export type MdComponent = MdStatus & {
  slug: string;
  name: string;
  groupName: string | null;
};

export type MdHistoryDay = {
  day: string;
  worstIndicator: string;
  hadMaintenance?: number;
};

export function statusLabel(s: MdStatus): string {
  if (s.status === "under_maintenance") return "maintenance";
  switch (s.indicator) {
    case "none":
      return "operational";
    case "minor":
      return "minor issue";
    case "major":
      return "partial outage";
    case "critical":
      return "major outage";
    default:
      return "unknown";
  }
}

const SEVERITY: Record<string, number> = { minor: 1, major: 2, critical: 3 };

export function isProblem(s: MdStatus): boolean {
  return (SEVERITY[s.indicator] ?? 0) > 0 || s.status === "under_maintenance";
}

function worstFirst<T extends MdStatus>(a: T, b: T): number {
  return (SEVERITY[b.indicator] ?? 0) - (SEVERITY[a.indicator] ?? 0);
}

export function formatIso(ms: number): string {
  if (!ms) return "no data";
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
}

function day(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Catalog names and provider text are data: escape what Markdown would read
// as emphasis, links, code, HTML or a heading, so they cannot reshape the doc.
export function mdText(value: string): string {
  return value
    .replace(/[\\`*_[\]<>#|~]/g, (c) => `\\${c}`)
    .replace(/\s+/g, " ")
    .trim();
}

// Pipes would break the row; newlines would end it.
function cell(value: string): string {
  return mdText(value);
}

function incidentDuration(i: MdIncident): string {
  const started = i.startedAt ?? i.createdAt;
  return i.resolvedAt
    ? formatDuration(i.resolvedAt.getTime() - started.getTime())
    : "ongoing";
}

export function renderIncidentTable(incidents: MdIncident[]): string {
  let md = "| Started | Incident | Impact | Duration |\n";
  md += "| --- | --- | --- | --- |\n";
  for (const i of incidents) {
    const impact = i.impact && i.impact !== "none" ? i.impact : "incident";
    md += `| ${day(i.startedAt ?? i.createdAt)} | [${cell(i.name)}](${i.url}) | ${impact} | ${incidentDuration(i)} |\n`;
  }
  return `${md}\n`;
}

export function renderHistory(rows: MdHistoryDay[], days: number): string {
  const { tracked, issueDays } = summarizeHistory(rows);
  if (tracked === 0) return `## Last ${days} days\n\nNo history yet.\n\n`;
  let md = `## Last ${days} days\n\n`;
  md += `${tracked - issueDays} of ${tracked} tracked days without issues.\n\n`;
  const worstByDay = new Map<
    string,
    { indicator: string; maintenance: boolean }
  >();
  for (const r of rows) {
    const key = r.day.slice(0, 10);
    const prev = worstByDay.get(key);
    const maintenance =
      (prev?.maintenance ?? false) || Boolean(r.hadMaintenance);
    const indicator =
      !prev ||
      (SEVERITY[r.worstIndicator] ?? 0) > (SEVERITY[prev.indicator] ?? 0)
        ? r.worstIndicator
        : prev.indicator;
    worstByDay.set(key, { indicator, maintenance });
  }
  const bad = [...worstByDay.entries()]
    .filter(([, d]) => (SEVERITY[d.indicator] ?? 0) > 0 || d.maintenance)
    .sort(([a], [b]) => b.localeCompare(a));
  if (bad.length > 0) {
    md += "| Day | Worst status |\n| --- | --- |\n";
    for (const [d, { indicator, maintenance }] of bad) {
      const label =
        (SEVERITY[indicator] ?? 0) > 0
          ? statusLabel({ indicator, status: "" })
          : "maintenance";
      md += `| ${d} | ${label}${maintenance && label !== "maintenance" ? " (with maintenance)" : ""} |\n`;
    }
    md += "\n";
  }
  return md;
}

export function renderServiceMarkdown(args: {
  name: string;
  slug: string;
  url: string;
  statusPageUrl: string;
  description: string | null;
  effective: MdStatus & { escalated: boolean };
  checkedAt: number;
  stale: boolean;
  providerMessage: string | null;
  reporters: number;
  windowMinutes: number;
  activeIncidents: MdIncident[];
  recentIncidents: MdIncident[] | null;
  components: MdComponent[] | null;
  history: MdHistoryDay[];
  historyDays: number;
}): string {
  const hasLiveData = args.checkedAt > 0 && !args.stale;
  const answer = getStatusAnswer({
    name: args.name,
    indicator: args.effective.indicator,
    status: args.effective.status,
    hasLiveData,
  });

  let md = `# Is ${mdText(args.name)} down?\n\n`;
  md += `**Answer:** ${mdText(answer)}\n\n`;
  md += `- Status: ${hasLiveData ? statusLabel(args.effective) : "unknown"}${args.effective.escalated ? " (raised by user reports)" : ""}\n`;
  md += `- Checked: ${formatIso(args.checkedAt)}${args.stale && args.checkedAt > 0 ? " (stale)" : ""}\n`;
  md += `- User reports in the last ${args.windowMinutes} minutes: ${args.reporters}\n`;
  if (args.providerMessage) {
    md += `- ${mdText(args.name)} says: ${mdText(args.providerMessage)}\n`;
  }
  md += `- Official status page: ${args.statusPageUrl}\n`;
  md += `- Website: ${args.url}\n`;
  if (args.description) md += `- About: ${mdText(args.description)}\n`;
  md += "\n";

  const affected = (args.components ?? []).filter(isProblem).sort(worstFirst);
  if (args.activeIncidents.length > 0 || affected.length > 0) {
    md += "## Affected right now\n\n";
    if (args.activeIncidents.length > 0) {
      md += renderIncidentTable(args.activeIncidents);
    }
    if (affected.length > 0) {
      md += "| Component | Status |\n| --- | --- |\n";
      for (const c of affected) {
        const label = c.groupName ? `${c.groupName} / ${c.name}` : c.name;
        md += `| [${cell(label)}](/status/${args.slug}/${c.slug}.md) | ${statusLabel(c)} |\n`;
      }
      md += "\n";
    }
  }

  md += renderHistory(args.history, args.historyDays);

  if (args.recentIncidents && args.recentIncidents.length > 0) {
    md += "## Recent incidents\n\n";
    md += renderIncidentTable(args.recentIncidents);
  }

  if (args.components && args.components.length > 0) {
    // Components without a live reading are unknown, never "operational".
    const unknown = args.components.filter(
      (c) => statusLabel(c) === "unknown",
    ).length;
    const ok = args.components.length - affected.length - unknown;
    const parts = [
      affected.length > 0
        ? `${affected.length} with issues (listed above)`
        : null,
      ok > 0 ? `${ok} operational` : null,
      unknown > 0 ? `${unknown} without live data` : null,
    ].filter(Boolean);
    md += `## Components (${args.components.length})\n\n`;
    md +=
      affected.length === 0 && unknown === 0
        ? "All components operational.\n\n"
        : `${parts.join(", ")}.\n\n`;
    md += `Each component has its own page: /status/${args.slug}/{component}.md, for example /status/${args.slug}/${args.components[0].slug}.md\n\n`;
  }

  return md;
}

export function renderComponentMarkdown(args: {
  serviceName: string;
  serviceSlug: string;
  statusPageUrl: string;
  fullName: string;
  component: MdComponent & { description: string | null };
  checkedAt: number;
  stale: boolean;
  escalated?: boolean;
  reporters: number;
  windowMinutes: number;
  incidents: MdIncident[];
  history: MdHistoryDay[];
  historyDays: number;
}): string {
  const live = (args.checkedAt > 0 && !args.stale) || Boolean(args.escalated);
  const answer = getStatusAnswer({
    name: args.fullName,
    indicator: args.component.indicator,
    status: args.component.status,
    hasLiveData: live,
  });

  let md = `# Is ${mdText(args.fullName)} down?\n\n`;
  md += `**Answer:** ${mdText(answer)}\n\n`;
  md += `- Status: ${live ? statusLabel(args.component) : "unknown"}${args.escalated ? " (raised by user reports)" : ""}\n`;
  md += `- Checked: ${formatIso(args.checkedAt)}${args.stale && args.checkedAt > 0 ? " (stale)" : ""}\n`;
  md += `- User reports in the last ${args.windowMinutes} minutes: ${args.reporters}\n`;
  md += `- Part of: [${mdText(args.serviceName)}](/status/${args.serviceSlug}.md)${args.component.groupName ? ` / ${mdText(args.component.groupName)}` : ""}\n`;
  md += `- Official status page: ${args.statusPageUrl}\n`;
  if (args.component.description) {
    md += `- About: ${mdText(args.component.description)}\n`;
  }
  md += "\n";

  md += renderHistory(args.history, args.historyDays);

  md += `## Incidents affecting ${mdText(args.component.name)}\n\n`;
  md +=
    args.incidents.length > 0
      ? renderIncidentTable(args.incidents)
      : "No recent incidents.\n\n";
  return md;
}

export function renderIndexMarkdown(args: {
  description: string;
  services: (MdStatus & {
    slug: string;
    name: string;
    statusMessage: string | null;
    hasData: boolean;
  })[];
  popularSlugs: readonly string[];
}): string {
  const live = args.services.filter((s) => s.hasData);
  const issues = live.filter(isProblem).sort(worstFirst);
  const bySlug = new Map(args.services.map((s) => [s.slug, s]));

  let md = "# Is it down? Live status of external services\n\n";
  md += `${args.description}\n\n`;
  md += `Tracking ${args.services.length.toLocaleString("en-US")} services. To check one, fetch /status/{slug}.md (for example /status/github.md); a single component is /status/{slug}/{component}.md. MCP clients can connect to https://api.openstatus.dev/mcp/status (no login).\n\n`;

  md += `## Having issues now (${issues.length})\n\n`;
  if (issues.length === 0) {
    md += "No tracked service reports a problem right now.\n\n";
  } else {
    md += "| Service | Status | Provider message |\n| --- | --- | --- |\n";
    for (const s of issues) {
      md += `| [${cell(s.name)}](/status/${s.slug}.md) | ${statusLabel(s)} | ${cell(s.statusMessage ?? "")} |\n`;
    }
    md += "\n";
  }

  md += "## Popular\n\n";
  for (const slug of args.popularSlugs) {
    const s = bySlug.get(slug);
    if (!s) continue;
    md += `- [${mdText(s.name)}](/status/${s.slug}.md): ${s.hasData ? statusLabel(s) : "unknown"}\n`;
  }
  md += "\n";

  md += "## All services\n\n";
  for (const s of args.services) {
    md += `- [${mdText(s.name)}](/status/${s.slug}.md): ${s.hasData ? statusLabel(s) : "unknown"}\n`;
  }
  md += "\n";
  return md;
}
