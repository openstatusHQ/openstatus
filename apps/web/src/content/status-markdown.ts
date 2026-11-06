import {
  REPORT_THRESHOLD,
  REPORT_WINDOW_MINUTES,
  REPORT_WINDOW_MS,
} from "@openstatus/api/src/router/effective-status";
import { computeEffectiveStatus } from "@openstatus/api/src/router/effective-status";
import { listExternalComponentsBySlug } from "@openstatus/services/external-service-component";
import {
  type ExternalIncidentListItem,
  listExternalIncidentsByComponent,
  listExternalIncidentsByServiceId,
  listExternalIncidentsBySlug,
} from "@openstatus/services/external-service-incident";
import {
  getComponentReportWindows,
  getServiceReportCountries,
  getServiceReportDaily,
  getServiceReportWindows,
} from "@openstatus/services/external-service-report";
import { safePipeData } from "@openstatus/tinybird";

import { getComponentFullName } from "../app/(landing)/status/utils";
import { POPULAR_STATUS_SLUGS } from "../data/popular-status";
import {
  cachedGetExternalComponentBySlug,
  cachedGetExternalServiceBySlug,
  cachedListExternalServices,
} from "../lib/external-service-cache";
import { tb } from "../lib/tb";
import { canonicalUrl, frontmatter } from "./frontmatter";
import { sections } from "./sections";
import {
  type MdIncident,
  renderComponentMarkdown,
  renderIndexMarkdown,
  renderServiceMarkdown,
} from "./status-markdown-render";

type LatestRow = {
  id: string;
  indicator: string;
  status: string;
  status_message: string;
  last_fetched_at: number;
};

const HISTORY_DAYS = 45;
const STALE_MS = 30 * 60 * 1000;
const REPORT_COUNTRIES_LIMIT = 5;

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

const RECENT_INCIDENTS = 5;
const GENERIC_MESSAGES = new Set(["", "all systems operational"]);

function settled<T>(result: PromiseSettledResult<T>, fallback: T): T {
  if (result.status === "fulfilled") return result.value;
  console.warn("[status markdown] query failed:", result.reason);
  return fallback;
}

function toMdIncident(
  i: ExternalIncidentListItem,
  statusPageUrl: string,
): MdIncident {
  return {
    name: i.name,
    status: i.status,
    impact: i.impact,
    url: i.shortlink ?? `${statusPageUrl}/incidents/${i.providerIncidentId}`,
    startedAt: i.startedAt,
    createdAt: i.createdAt,
    resolvedAt: i.resolvedAt,
  };
}

export async function generateStatusIndexMarkdown(): Promise<string> {
  const services = await cachedListExternalServices();
  const latestRes = await safePipeData(
    tb.externalStatusLatest({}),
    "externalStatusLatest (markdown index)",
  );
  const latestRows: LatestRow[] = Array.isArray(latestRes.data)
    ? latestRes.data
    : [];
  const latestById = new Map<string, LatestRow>();
  for (const row of latestRows) latestById.set(row.id, row);

  const md = frontmatter({
    title: sections.status.title,
    url: canonicalUrl(sections.status.path),
    description: sections.status.description,
  });
  return (
    md +
    renderIndexMarkdown({
      description: sections.status.description,
      popularSlugs: POPULAR_STATUS_SLUGS,
      services: services
        .filter((s) => s.deletedAt == null)
        .map((s) => {
          const snap = latestById.get(s.slug);
          return {
            slug: s.slug,
            name: s.name,
            indicator: snap?.indicator ?? "",
            status: snap?.status ?? "",
            statusMessage: snap?.status_message ?? null,
            hasData: snap != null,
          };
        }),
    })
  );
}

export async function generateStatusDetailMarkdown(
  slug: string,
): Promise<string | null> {
  const service = await cachedGetExternalServiceBySlug(slug);
  if (!service) return null;
  if (service.slug !== slug) {
    const canonical = `/status/${service.slug}`;
    return `${frontmatter({
      title: `${service.name} Status`,
      url: canonicalUrl(canonical),
      description: `This service moved to ${canonical}.`,
    })}# Redirect\n\nThis service moved. Canonical: [${canonical}.md](${canonical}.md)\n`;
  }

  const aliasSlugs = Array.isArray(service.aliases) ? service.aliases : [];
  const slugChain = [service.slug, ...aliasSlugs];
  const since = new Date(Date.now() - REPORT_WINDOW_MS);

  const [latestRes, historyRes, windowRes, recentRes, activeRes, compRes] =
    await Promise.allSettled([
      safePipeData(
        tb.externalStatusLatest({ ids: slugChain }),
        "externalStatusLatest (markdown detail)",
      ),
      safePipeData(
        tb.externalStatusHistory({ ids: slugChain, days: HISTORY_DAYS }),
        "externalStatusHistory (markdown detail)",
      ),
      getServiceReportWindows({ serviceIds: [service.id], since }),
      listExternalIncidentsBySlug({ slug, limit: RECENT_INCIDENTS }),
      // `since: now` keeps only incidents that are still open.
      listExternalIncidentsByServiceId({
        externalServiceId: service.id,
        since: new Date(),
      }),
      listExternalComponentsBySlug({ slug }),
    ]);

  const latestData = settled(latestRes, { data: [] as LatestRow[] }).data;
  const latestRows: LatestRow[] = Array.isArray(latestData)
    ? [...latestData]
    : [];
  latestRows.sort((a, b) => b.last_fetched_at - a.last_fetched_at);
  const latest = latestRows[0];
  const historyData = settled(historyRes, { data: [] }).data;
  const history = (Array.isArray(historyData) ? historyData : []).map((r) => ({
    day: r.day,
    worstIndicator: r.worst_indicator,
  }));
  const reporters = settled(windowRes, [])[0]?.reporters ?? 0;
  const recent = settled(recentRes, {
    service: null,
    supported: false,
    incidents: [],
  });
  const active = settled(activeRes, []).filter((i) => i.resolvedAt == null);
  const comps = settled(compRes, {
    service: null,
    supported: false,
    components: [],
  });

  const effective = computeEffectiveStatus({
    providerIndicator: latest?.indicator ?? "",
    providerStatus: latest?.status ?? "",
    reporters,
    threshold: REPORT_THRESHOLD,
  });
  const checkedAt = latest?.last_fetched_at ?? 0;
  const message = latest?.status_message?.trim() ?? "";

  let md = frontmatter({
    title: `Is ${service.name} down? ${service.name} status`,
    url: canonicalUrl(`/status/${slug}`),
    description: `Live ${service.name} status, what is affected right now, uptime over the last ${HISTORY_DAYS} days and recent incidents, tracked by openstatus.`,
  });
  md += renderServiceMarkdown({
    name: service.name,
    slug: service.slug,
    url: service.url,
    statusPageUrl: service.statusPageUrl,
    description: service.description,
    effective,
    checkedAt,
    stale: checkedAt > 0 && Date.now() - checkedAt > STALE_MS,
    providerMessage: GENERIC_MESSAGES.has(message.toLowerCase())
      ? null
      : message,
    reporters,
    windowMinutes: REPORT_WINDOW_MINUTES,
    activeIncidents: active.map((i) => toMdIncident(i, service.statusPageUrl)),
    recentIncidents: recent.supported
      ? recent.incidents.map((i) => toMdIncident(i, service.statusPageUrl))
      : null,
    components: comps.supported ? comps.components : null,
    history,
    historyDays: HISTORY_DAYS,
  });

  md += await generateReportsMarkdown({
    serviceId: service.id,
    serviceName: service.name,
  });

  md += "## Links\n\n";
  md += `- HTML page: /status/${service.slug}\n`;
  md += `- Upstream: ${service.statusPageUrl}\n`;
  md += "- All services: /status.md\n";

  return md;
}

export async function generateStatusComponentMarkdown(
  serviceSlug: string,
  componentSlug: string,
): Promise<string | null> {
  const { service, component } = await cachedGetExternalComponentBySlug(
    serviceSlug,
    componentSlug,
  );
  if (!service || !component) return null;
  const canonical = `/status/${service.slug}/${component.slug}`;
  if (service.slug !== serviceSlug || component.slug !== componentSlug) {
    return `${frontmatter({
      title: `${component.name} Status`,
      url: canonicalUrl(canonical),
      description: `This component moved to ${canonical}.`,
    })}# Redirect\n\nThis component moved. Canonical: [${canonical}.md](${canonical}.md)\n`;
  }

  const since = new Date(Date.now() - REPORT_WINDOW_MS);
  const [historyRes, incidentsRes, windowRes] = await Promise.allSettled([
    safePipeData(
      tb.externalStatusComponentHistory({
        component_ids: [String(component.id)],
        days: HISTORY_DAYS,
      }),
      "externalStatusComponentHistory (markdown)",
    ),
    listExternalIncidentsByComponent({
      externalServiceId: service.id,
      upstreamComponentId: component.upstreamComponentId,
      limit: RECENT_INCIDENTS,
    }),
    getComponentReportWindows({ serviceId: service.id, since }),
  ]);

  const historyData = settled(historyRes, { data: [] }).data;
  const history = (Array.isArray(historyData) ? historyData : []).map((r) => ({
    day: r.day,
    worstIndicator: r.worst_indicator,
  }));
  const reporters =
    settled(windowRes, []).find((r) => r.componentId === component.id)
      ?.reporters ?? 0;
  const fullName = getComponentFullName(service.name, component.name);

  let md = frontmatter({
    title: `Is ${fullName} down? ${fullName} status`,
    url: canonicalUrl(canonical),
    description: `Live ${fullName} status, uptime over the last ${HISTORY_DAYS} days and recent incidents, tracked by openstatus.`,
  });
  md += renderComponentMarkdown({
    serviceName: service.name,
    serviceSlug: service.slug,
    statusPageUrl: service.statusPageUrl,
    fullName,
    component,
    checkedAt: component.lastFetchedAt ?? 0,
    stale: component.stale,
    reporters,
    windowMinutes: REPORT_WINDOW_MINUTES,
    incidents: settled(incidentsRes, []).map((i) =>
      toMdIncident(i, service.statusPageUrl),
    ),
    history,
    historyDays: HISTORY_DAYS,
  });
  md += "## Links\n\n";
  md += `- HTML page: ${canonical}\n`;
  md += `- Service: /status/${service.slug}.md\n`;
  return md;
}
