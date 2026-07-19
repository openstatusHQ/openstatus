import {
  REPORT_THRESHOLD,
  REPORT_WINDOW_MINUTES,
  REPORT_WINDOW_MS,
} from "@openstatus/api/src/router/effective-status";
import {
  getServiceReportCountries,
  getServiceReportDaily,
  getServiceReportWindows,
} from "@openstatus/services/external-service-report";
import { OSTinybird, safePipeData } from "@openstatus/tinybird";

import { env } from "../env";
import {
  cachedGetExternalServiceBySlug,
  cachedListExternalServices,
} from "../lib/external-service-cache";

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
const REPORT_COUNTRIES_LIMIT = 5;

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

function countryCount(n: number): string {
  if (n <= 0) return "";
  return ` from ${n} ${n === 1 ? "country" : "countries"}`;
}

function settledRows<T>(result: PromiseSettledResult<T[]>): T[] {
  if (result.status === "fulfilled") return result.value;
  console.warn("[status markdown] report query failed:", result.reason);
  return [];
}

async function generateReportsMarkdown(args: {
  serviceId: number;
  serviceName: string;
}): Promise<string> {
  const now = Date.now();
  const since = new Date(now - REPORT_WINDOW_MS);
  const dailySince = new Date(now - HISTORY_DAYS * 24 * 60 * 60 * 1000);

  const [windowRes, dailyRes, countryRes] = await Promise.allSettled([
    getServiceReportWindows({ serviceIds: [args.serviceId], since }),
    getServiceReportDaily({ serviceId: args.serviceId, since: dailySince }),
    getServiceReportCountries({
      serviceId: args.serviceId,
      since,
      limit: REPORT_COUNTRIES_LIMIT,
    }),
  ]);

  const windowRows = settledRows(windowRes);
  const dailyRows = settledRows(dailyRes);
  const countryRows = settledRows(countryRes);

  const windowOk = windowRes.status === "fulfilled";
  const reporters = windowRows[0]?.reporters ?? 0;
  const countries = windowRows[0]?.countries ?? 0;
  const dailyWithReports = dailyRows.filter((r) => r.total > 0);
  if (reporters === 0 && dailyWithReports.length === 0) return "";

  let md = `## ${args.serviceName} user reports\n\n`;
  if (windowOk) {
    if (reporters >= REPORT_THRESHOLD) {
      md += `Users are reporting problems with ${args.serviceName}: ${reporters} in the last ${REPORT_WINDOW_MINUTES} minutes${countryCount(countries)}.\n\n`;
    } else {
      md += `${reporters} user ${reporters === 1 ? "report" : "reports"} in the last ${REPORT_WINDOW_MINUTES} minutes${countryCount(countries)}.\n\n`;
    }
  }

  if (countryRows.length > 0) {
    md += `Top countries: ${countryRows.map((c) => `${c.country} (${c.total})`).join(", ")}\n\n`;
  }

  if (dailyWithReports.length > 0) {
    md += "| Day | Reports | Reporters |\n";
    md += "| --- | --- | --- |\n";
    for (const r of dailyWithReports) {
      md += `| ${r.day} | ${r.total} | ${r.reporters} |\n`;
    }
    md += "\n";
  }

  return md;
}

export async function generateStatusIndexMarkdown(): Promise<string> {
  const services = await cachedListExternalServices();
  const tb = new OSTinybird(env.TINY_BIRD_API_KEY);
  const latestRes = await safePipeData(
    tb.externalStatusLatest({}),
    "externalStatusLatest (markdown index)",
  );
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
    safePipeData(
      tb.externalStatusLatest({ ids: slugChain }),
      "externalStatusLatest (markdown detail)",
    ),
    safePipeData(
      tb.externalStatusHistory({ ids: slugChain, days: HISTORY_DAYS }),
      "externalStatusHistory (markdown detail)",
    ),
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

  md += await generateReportsMarkdown({
    serviceId: service.id,
    serviceName: service.name,
  });

  md += "## Links\n\n";
  md += `- HTML page: /status/${service.slug}\n`;
  md += `- Upstream: ${service.statusPageUrl}\n`;

  return md;
}
