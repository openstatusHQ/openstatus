import { env } from "@/env";
import {
  cachedGetExternalServiceBySlug,
  cachedListExternalServices,
} from "@/lib/external-service-cache";
import { OSTinybird } from "@openstatus/tinybird";

type LatestRow = {
  id: string;
  indicator: string;
  status: string;
  status_message: string;
  last_fetched_at: number;
};

type HistoryRow = {
  day: string;
  id: string;
  worst_indicator: string;
  had_maintenance: number;
  snapshot_count: number;
};

const HISTORY_DAYS = 45;

function pillLabel(args: { indicator: string; status: string }): string {
  if (args.status === "under_maintenance") return "Maintenance";
  switch (args.indicator) {
    case "none":
      return "Operational";
    case "minor":
      return "Minor Issue";
    case "major":
      return "Partial Outage";
    case "critical":
      return "Major Outage";
    default:
      return "Unknown";
  }
}

function dayLabel(row: HistoryRow): string {
  if (row.had_maintenance) return "maintenance";
  switch (row.worst_indicator) {
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

function formatIso(ms: number): string {
  if (!ms) return "no data";
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
}

export async function generateStatusIndexMarkdown(): Promise<string> {
  const services = await cachedListExternalServices();
  const tb = new OSTinybird(env.TINY_BIRD_API_KEY);
  const latestRes = await tb.externalStatusLatest({});
  const latestRows: LatestRow[] = Array.isArray(latestRes.data)
    ? latestRes.data
    : [];
  const latestById = new Map<string, LatestRow>();
  for (const row of latestRows) latestById.set(row.id, row);

  let md = "---\n";
  md += `title: "External Status"\n`;
  md += `description: "Current status of external services tracked by OpenStatus."\n`;
  md += "---\n\n";
  md += "# External Status\n\n";
  md += "Current status of external services tracked by OpenStatus.\n\n";
  md += "| Service | Status | Provider | URL |\n";
  md += "| --- | --- | --- | --- |\n";
  for (const s of services) {
    if (s.deletedAt != null) continue;
    const snap = latestById.get(s.slug);
    const label = snap ? pillLabel(snap) : "Unknown";
    md += `| [${s.name}](/status/${s.slug}) | ${label} | ${s.provider} | ${s.url} |\n`;
  }
  md += "\n";
  return md;
}

export async function generateStatusDetailMarkdown(
  slug: string,
): Promise<string | null> {
  const service = await cachedGetExternalServiceBySlug(slug);
  if (!service) return null;
  if (service.slug !== slug) {
    return `# Redirect\n\nThis service moved. Canonical: [/status/${service.slug}](/status/${service.slug})\n`;
  }

  const aliasSlugs = Array.isArray(service.aliases) ? service.aliases : [];
  const slugChain = [service.slug, ...aliasSlugs];

  const tb = new OSTinybird(env.TINY_BIRD_API_KEY);
  const [latestRes, historyRes] = await Promise.all([
    tb.externalStatusLatest({ ids: slugChain }),
    tb.externalStatusHistory({ ids: slugChain, days: HISTORY_DAYS }),
  ]);

  const latestRows: LatestRow[] = Array.isArray(latestRes.data)
    ? latestRes.data
    : [];
  latestRows.sort((a, b) => b.last_fetched_at - a.last_fetched_at);
  const latest = latestRows[0];

  const historyRows: HistoryRow[] = Array.isArray(historyRes.data)
    ? historyRes.data
    : [];

  let md = "---\n";
  md += `title: "${service.name} Status"\n`;
  md += `description: "Current status of ${service.name}. Uptime history and recent incidents tracked by OpenStatus."\n`;
  md += "---\n\n";
  md += `# ${service.name} Status\n\n`;

  if (latest) {
    md += `**Status:** ${pillLabel(latest)}\n`;
    md += `**Last updated:** ${formatIso(latest.last_fetched_at)}\n`;
    if (latest.status_message) {
      md += `**Provider message:** ${latest.status_message}\n`;
    }
  } else {
    md += "**Status:** Unknown (no data yet)\n";
  }
  md += "\n";

  md += "## Service\n\n";
  md += `- Name: ${service.name}\n`;
  md += `- URL: ${service.url}\n`;
  md += `- Upstream status page: ${service.statusPageUrl}\n`;
  md += `- Provider: ${service.provider}\n`;
  if (service.description) md += `- About: ${service.description}\n`;
  if (aliasSlugs.length > 0) {
    md += `- Aliases: ${aliasSlugs.join(", ")}\n`;
  }
  if (service.deletedAt != null) {
    md += `- Deprecated: yes (deleted at ${formatIso(service.deletedAt.getTime())})\n`;
  }
  md += "\n";

  md += `## Last ${HISTORY_DAYS} days\n\n`;
  if (historyRows.length === 0) {
    md += "No history yet — tracking begins after first poll.\n\n";
  } else {
    md += "| Day | Status | Snapshots |\n";
    md += "| --- | --- | --- |\n";
    const byDay = new Map<string, HistoryRow>();
    for (const r of historyRows) {
      byDay.set(r.day.slice(0, 10), r);
    }
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    for (let i = 0; i < HISTORY_DAYS; i++) {
      const date = new Date(today);
      date.setUTCDate(today.getUTCDate() - i);
      const iso = date.toISOString().slice(0, 10);
      const row = byDay.get(iso);
      if (row) {
        md += `| ${iso} | ${dayLabel(row)} | ${row.snapshot_count} |\n`;
      } else {
        md += `| ${iso} | (no data) | 0 |\n`;
      }
    }
  }
  md += "\n";

  md += "## Links\n\n";
  md += `- HTML page: /status/${service.slug}\n`;
  md += `- Upstream: ${service.statusPageUrl}\n`;

  return md;
}
