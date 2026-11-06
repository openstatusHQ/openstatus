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

export type MdHistoryDay = { day: string; worstIndicator: string };

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

// Pipes would break the row; newlines would end it.
function cell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
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
  const worstByDay = new Map<string, string>();
  for (const r of rows) {
    const key = r.day.slice(0, 10);
    const prev = worstByDay.get(key);
    if (!prev || (SEVERITY[r.worstIndicator] ?? 0) > (SEVERITY[prev] ?? 0)) {
      worstByDay.set(key, r.worstIndicator);
    }
  }
  const bad = [...worstByDay.entries()]
    .filter(([, ind]) => (SEVERITY[ind] ?? 0) > 0)
    .sort(([a], [b]) => b.localeCompare(a));
  if (bad.length > 0) {
    md += "| Day | Worst status |\n| --- | --- |\n";
    for (const [d, ind] of bad) {
      md += `| ${d} | ${statusLabel({ indicator: ind, status: "" })} |\n`;
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

  let md = `# Is ${args.name} down?\n\n`;
  md += `**Answer:** ${answer}\n\n`;
  md += `- Status: ${hasLiveData ? statusLabel(args.effective) : "unknown"}${args.effective.escalated ? " (raised by user reports)" : ""}\n`;
  md += `- Checked: ${formatIso(args.checkedAt)}${args.stale && args.checkedAt > 0 ? " (stale)" : ""}\n`;
  md += `- User reports in the last ${args.windowMinutes} minutes: ${args.reporters}\n`;
  if (args.providerMessage) {
    md += `- ${args.name} says: ${args.providerMessage}\n`;
  }
  md += `- Official status page: ${args.statusPageUrl}\n`;
  md += `- Website: ${args.url}\n`;
  if (args.description) md += `- About: ${args.description}\n`;
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
    const ok = args.components.length - affected.length;
    md += `## Components (${args.components.length})\n\n`;
    md +=
      affected.length === 0
        ? "All components operational.\n\n"
        : `${affected.length} with issues (listed above), ${ok} operational.\n\n`;
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
  reporters: number;
  windowMinutes: number;
  incidents: MdIncident[];
  history: MdHistoryDay[];
  historyDays: number;
}): string {
  const live = args.checkedAt > 0 && !args.stale;
  const answer = getStatusAnswer({
    name: args.fullName,
    indicator: args.component.indicator,
    status: args.component.status,
    hasLiveData: live,
  });

  let md = `# Is ${args.fullName} down?\n\n`;
  md += `**Answer:** ${answer}\n\n`;
  md += `- Status: ${live ? statusLabel(args.component) : "unknown"}\n`;
  md += `- Checked: ${formatIso(args.checkedAt)}${args.stale && args.checkedAt > 0 ? " (stale)" : ""}\n`;
  md += `- User reports in the last ${args.windowMinutes} minutes: ${args.reporters}\n`;
  md += `- Part of: [${args.serviceName}](/status/${args.serviceSlug}.md)${args.component.groupName ? ` / ${args.component.groupName}` : ""}\n`;
  md += `- Official status page: ${args.statusPageUrl}\n`;
  if (args.component.description) {
    md += `- About: ${args.component.description}\n`;
  }
  md += "\n";

  md += renderHistory(args.history, args.historyDays);

  md += `## Incidents affecting ${args.component.name}\n\n`;
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
    md += `- [${s.name}](/status/${s.slug}.md): ${s.hasData ? statusLabel(s) : "unknown"}\n`;
  }
  md += "\n";

  md += "## All services\n\n";
  for (const s of args.services) {
    md += `- [${s.name}](/status/${s.slug}.md): ${s.hasData ? statusLabel(s) : "unknown"}\n`;
  }
  md += "\n";
  return md;
}
