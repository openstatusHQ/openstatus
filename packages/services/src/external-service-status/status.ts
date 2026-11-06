import { defaultTb } from "../context";
import {
  type ExternalServiceRow,
  getExternalServiceBySlug,
  listExternalServices,
} from "../external-service";
import {
  type ExternalComponentListItem,
  listExternalComponentsBySlug,
} from "../external-service-component";
import {
  type ExternalIncidentListItem,
  listExternalIncidentsByComponent,
  listExternalIncidentsByServiceId,
  listExternalIncidentsBySlug,
} from "../external-service-incident";
import { getServiceReportWindows } from "../external-service-report";
import {
  REPORT_THRESHOLD,
  REPORT_WINDOW_MS,
  STALE_THRESHOLD_MS,
  type StatusLabel,
  computeEffectiveStatus,
  getStatusAnswer,
  isProblem,
  severityOf,
  statusLabel,
} from "./effective";
import { resolveByName, slugify } from "./resolve";

const WEB_BASE_URL =
  process.env.OPENSTATUS_WEB_BASE_URL ?? "https://www.openstatus.dev";
const RECENT_INCIDENTS = 5;
const AFFECTED_SHOWN = 10;
const LIST_TTL_MS = 60_000;
const LAG_NOTE =
  "Status pages can lag the start of a problem by a few minutes. If requests keep failing, check again soon.";
const GENERIC_MESSAGES = new Set(["", "all systems operational"]);

type LatestRow = {
  id: string;
  indicator: string;
  status: string;
  status_message: string;
  last_fetched_at: number;
};

// Per machine, like the rate limiter: the directory changes rarely and the
// public MCP endpoint would otherwise read 3k rows on every name lookup.
let listCache: { at: number; rows: ExternalServiceRow[] } | null = null;
async function cachedServices(): Promise<ExternalServiceRow[]> {
  if (listCache && Date.now() - listCache.at < LIST_TTL_MS) {
    return listCache.rows;
  }
  const rows = await listExternalServices({});
  listCache = { at: Date.now(), rows };
  return rows;
}

async function settle<T>(promise: Promise<T>, fallback: T, label: string) {
  try {
    return await promise;
  } catch (err) {
    console.warn(`[external-service-status] ${label} failed:`, err);
    return fallback;
  }
}

async function latestFor(ids: string[]): Promise<LatestRow[]> {
  try {
    const res = await defaultTb.externalStatusLatest(ids.length ? { ids } : {});
    return res.data;
  } catch (err) {
    console.warn("[external-service-status] externalStatusLatest failed:", err);
    return [];
  }
}

export function pageUrl(slug: string, component?: string): string {
  return `${WEB_BASE_URL}/status/${slug}${component ? `/${component}` : ""}`;
}

type IncidentOut = {
  title: string;
  status: string;
  impact: string | null;
  startedAt: string;
  resolvedAt: string | null;
  url: string;
};

function toIncident(
  i: ExternalIncidentListItem,
  statusPageUrl: string,
): IncidentOut {
  return {
    title: i.name,
    status: i.status,
    impact: i.impact && i.impact !== "none" ? i.impact : null,
    startedAt: (i.startedAt ?? i.createdAt).toISOString(),
    resolvedAt: i.resolvedAt?.toISOString() ?? null,
    url: i.shortlink ?? `${statusPageUrl}/incidents/${i.providerIncidentId}`,
  };
}

function componentOut(slug: string, c: ExternalComponentListItem) {
  return {
    name: c.name,
    group: c.groupName,
    status: statusLabel(c),
    url: pageUrl(slug, c.slug),
  };
}

export type ExternalServiceStatus = {
  found: boolean;
  verdict: string;
  reportsProblem: boolean;
  status: StatusLabel;
  escalatedByUserReports: boolean;
  checkedAt: string | null;
  stale: boolean;
  providerMessage: string | null;
  userReportsLast15Minutes: number;
  service: {
    name: string;
    slug: string;
    website: string;
    officialStatusPage: string;
    url: string;
    markdownUrl: string;
  } | null;
  component: {
    name: string;
    group: string | null;
    url: string;
  } | null;
  affectedComponents: ReturnType<typeof componentOut>[];
  affectedComponentCount: number;
  activeIncidents: IncidentOut[];
  recentIncidents: IncidentOut[];
  suggestions: { name: string; slug: string }[];
};

function notFound(
  verdict: string,
  suggestions: { name: string; slug: string }[],
): ExternalServiceStatus {
  return {
    found: false,
    verdict,
    reportsProblem: false,
    status: "unknown",
    escalatedByUserReports: false,
    checkedAt: null,
    stale: false,
    providerMessage: null,
    userReportsLast15Minutes: 0,
    service: null,
    component: null,
    affectedComponents: [],
    affectedComponentCount: 0,
    activeIncidents: [],
    recentIncidents: [],
    suggestions,
  };
}

async function findService(query: string) {
  const bySlug = await settle(
    getExternalServiceBySlug({ slug: slugify(query) }),
    null,
    "getExternalServiceBySlug",
  );
  if (bySlug && bySlug.deletedAt == null) {
    return { match: bySlug, suggestions: [] as ExternalServiceRow[] };
  }
  const rows = (await cachedServices()).filter((r) => r.deletedAt == null);
  return resolveByName(
    rows.map((r) => ({
      ...r,
      aliases: Array.isArray(r.aliases) ? r.aliases : [],
    })),
    query,
  );
}

/** Live status of one tracked service, optionally narrowed to a component. */
export async function getExternalServiceStatus(args: {
  service: string;
  component?: string;
}): Promise<ExternalServiceStatus> {
  const { match: service, suggestions } = await findService(args.service);
  if (!service) {
    return notFound(
      suggestions.length > 0
        ? `No service named "${args.service}" is tracked. Did you mean one of the suggestions?`
        : `No service named "${args.service}" is tracked.`,
      suggestions.map((s) => ({ name: s.name, slug: s.slug })),
    );
  }

  const aliases = Array.isArray(service.aliases) ? service.aliases : [];
  const since = new Date(Date.now() - REPORT_WINDOW_MS);
  const [latestRows, windows, components, recent, open] = await Promise.all([
    latestFor([service.slug, ...aliases]),
    settle(
      getServiceReportWindows({ serviceIds: [service.id], since }),
      [],
      "getServiceReportWindows",
    ),
    settle(
      listExternalComponentsBySlug({ slug: service.slug }),
      { service: null, supported: false, components: [] },
      "listExternalComponentsBySlug",
    ),
    settle(
      listExternalIncidentsBySlug({
        slug: service.slug,
        limit: RECENT_INCIDENTS,
      }),
      { service: null, supported: false, incidents: [] },
      "listExternalIncidentsBySlug",
    ),
    // `since: now` keeps only incidents that are still open.
    settle(
      listExternalIncidentsByServiceId({
        externalServiceId: service.id,
        since: new Date(),
      }),
      [],
      "listExternalIncidentsByServiceId",
    ),
  ]);

  const latest = [...latestRows].sort(
    (a, b) => b.last_fetched_at - a.last_fetched_at,
  )[0];
  const reporters = windows[0]?.reporters ?? 0;
  const serviceOut = {
    name: service.name,
    slug: service.slug,
    website: service.url,
    officialStatusPage: service.statusPageUrl,
    url: pageUrl(service.slug),
    markdownUrl: `${pageUrl(service.slug)}.md`,
  };
  const comps = components.supported ? components.components : [];
  const affected = comps
    .filter(isProblem)
    .sort((a, b) => severityOf(b.indicator) - severityOf(a.indicator));
  const activeIncidents = open
    .filter((i) => i.resolvedAt == null)
    .map((i) => toIncident(i, service.statusPageUrl));

  if (args.component) {
    const { match: component, suggestions: compSuggestions } = resolveByName(
      comps,
      args.component,
      10,
    );
    if (!component) {
      return {
        ...notFound(
          `${service.name} has no component named "${args.component}".`,
          compSuggestions.map((c) => ({ name: c.name, slug: c.slug })),
        ),
        service: serviceOut,
      };
    }
    const incidents = await settle(
      listExternalIncidentsByComponent({
        externalServiceId: service.id,
        upstreamComponentId: component.upstreamComponentId,
        limit: RECENT_INCIDENTS,
      }),
      [],
      "listExternalIncidentsByComponent",
    );
    const checkedAt = component.lastFetchedAt ?? 0;
    const stale = checkedAt > 0 && Date.now() - checkedAt > STALE_THRESHOLD_MS;
    const live = checkedAt > 0 && !stale;
    const name = component.name
      .toLowerCase()
      .startsWith(service.name.toLowerCase())
      ? component.name
      : `${service.name} ${component.name}`;
    const problem = live && isProblem(component);
    const answer = getStatusAnswer({
      name,
      indicator: component.indicator,
      status: component.status,
      hasLiveData: live,
    });
    return {
      found: true,
      verdict: problem ? answer : `${answer} ${LAG_NOTE}`,
      reportsProblem: problem,
      status: live ? statusLabel(component) : "unknown",
      escalatedByUserReports: false,
      checkedAt: checkedAt ? new Date(checkedAt).toISOString() : null,
      stale,
      providerMessage: null,
      userReportsLast15Minutes: reporters,
      service: serviceOut,
      component: {
        name: component.name,
        group: component.groupName,
        url: pageUrl(service.slug, component.slug),
      },
      affectedComponents: [],
      affectedComponentCount: 0,
      activeIncidents: incidents
        .filter((i) => i.resolvedAt == null)
        .map((i) => toIncident(i, service.statusPageUrl)),
      recentIncidents: incidents.map((i) =>
        toIncident(i, service.statusPageUrl),
      ),
      suggestions: [],
    };
  }

  const effective = computeEffectiveStatus({
    providerIndicator: latest?.indicator ?? "",
    providerStatus: latest?.status ?? "",
    reporters,
    threshold: REPORT_THRESHOLD,
  });
  const checkedAt = latest?.last_fetched_at ?? 0;
  const stale = checkedAt > 0 && Date.now() - checkedAt > STALE_THRESHOLD_MS;
  const live = checkedAt > 0 && !stale;
  const problem = (live && isProblem(effective)) || activeIncidents.length > 0;
  const answer = getStatusAnswer({
    name: service.name,
    indicator: effective.indicator,
    status: effective.status,
    hasLiveData: live,
  });
  const message = latest?.status_message?.trim() ?? "";

  // An open incident is evidence even when the snapshot is missing or calm.
  const verdict =
    activeIncidents.length > 0 && !(live && isProblem(effective))
      ? `${service.name} reports an open incident: "${activeIncidents[0].title}".`
      : problem
        ? answer
        : `${answer} ${LAG_NOTE}`;

  return {
    found: true,
    verdict,
    reportsProblem: problem,
    status: live ? statusLabel(effective) : "unknown",
    escalatedByUserReports: effective.escalated,
    checkedAt: checkedAt ? new Date(checkedAt).toISOString() : null,
    stale,
    providerMessage: GENERIC_MESSAGES.has(message.toLowerCase())
      ? null
      : message,
    userReportsLast15Minutes: reporters,
    service: serviceOut,
    component: null,
    affectedComponents: affected
      .slice(0, AFFECTED_SHOWN)
      .map((c) => componentOut(service.slug, c)),
    affectedComponentCount: affected.length,
    activeIncidents,
    recentIncidents: recent.supported
      ? recent.incidents.map((i) => toIncident(i, service.statusPageUrl))
      : [],
    suggestions: [],
  };
}

export type ActiveIssue = {
  name: string;
  slug: string;
  status: StatusLabel;
  escalatedByUserReports: boolean;
  providerMessage: string | null;
  url: string;
};

const MIN_SEVERITY: Record<string, number> = {
  minor_issue: 1,
  partial_outage: 2,
  major_outage: 3,
};

/** Every tracked service with a problem right now, worst first. */
export async function listActiveExternalIssues(args: {
  services?: string[];
  minImpact?: "minor_issue" | "partial_outage" | "major_outage";
  includeMaintenance?: boolean;
  limit?: number;
}): Promise<{ total: number; issues: ActiveIssue[]; unknown: string[] }> {
  const rows = (await cachedServices()).filter((r) => r.deletedAt == null);
  let pool = rows;
  const unknown: string[] = [];
  if (args.services && args.services.length > 0) {
    const picked = new Map<number, ExternalServiceRow>();
    for (const q of args.services) {
      const { match } = resolveByName(
        rows.map((r) => ({
          ...r,
          aliases: Array.isArray(r.aliases) ? r.aliases : [],
        })),
        q,
      );
      if (match) picked.set(match.id, match);
      else unknown.push(q);
    }
    pool = [...picked.values()];
  }

  const [latestRows, windows] = await Promise.all([
    latestFor(args.services?.length ? pool.map((r) => r.slug) : []),
    settle(
      getServiceReportWindows({
        serviceIds: pool.map((r) => r.id),
        since: new Date(Date.now() - REPORT_WINDOW_MS),
      }),
      [],
      "getServiceReportWindows",
    ),
  ]);
  const latestById = new Map(latestRows.map((r) => [r.id, r]));
  const reportersById = new Map(
    windows.map((w) => [w.externalServiceId, w.reporters]),
  );
  const minSeverity = args.minImpact ? MIN_SEVERITY[args.minImpact] : 1;

  const issues = pool
    .flatMap((s) => {
      const snap = latestById.get(s.slug);
      const fresh =
        snap != null && Date.now() - snap.last_fetched_at <= STALE_THRESHOLD_MS;
      const effective = computeEffectiveStatus({
        providerIndicator: fresh ? snap.indicator : "",
        providerStatus: fresh ? snap.status : "",
        reporters: reportersById.get(s.id) ?? 0,
        threshold: REPORT_THRESHOLD,
      });
      const maintenance = effective.status === "under_maintenance";
      const keep =
        (maintenance && args.includeMaintenance) ||
        (!maintenance && severityOf(effective.indicator) >= minSeverity);
      if (!keep) return [];
      const message = snap?.status_message?.trim() ?? "";
      return [
        {
          severity: maintenance ? 0 : severityOf(effective.indicator),
          issue: {
            name: s.name,
            slug: s.slug,
            status: statusLabel(effective),
            escalatedByUserReports: effective.escalated,
            providerMessage: GENERIC_MESSAGES.has(message.toLowerCase())
              ? null
              : message,
            url: pageUrl(s.slug),
          },
        },
      ];
    })
    .sort(
      (a, b) =>
        b.severity - a.severity || a.issue.name.localeCompare(b.issue.name),
    )
    .map((x) => x.issue);

  return {
    total: issues.length,
    issues: issues.slice(0, args.limit ?? 20),
    unknown,
  };
}
