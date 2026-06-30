import {
  REPORT_THRESHOLD,
  REPORT_WINDOW_MS,
  computeEffectiveStatus,
} from "@openstatus/api/src/router/effective-status";
import {
  getComponentReportWindows,
  getServiceReportWindows,
} from "@openstatus/services/external-service-report";
import { OSTinybird, safePipeData } from "@openstatus/tinybird";
import { unstable_cache } from "next/cache";

import { env } from "../env";

const tb = new OSTinybird(env.TINY_BIRD_API_KEY);

const REPORTS_REVALIDATE_SECONDS = 30;
// Distinct from the "external-services" tag on service-lookup caches so that
// service mutations don't also flush the short-lived reports cache.
const REPORTS_TAG = "external-service-reports";

// Keyed by serviceId only — `since` is a moving Date.now() window, so it must be
// computed inside (keying on it would make every request a cache miss).
const cachedServiceReporters = unstable_cache(
  async (serviceId: number): Promise<number> => {
    const since = new Date(Date.now() - REPORT_WINDOW_MS);
    const rows = await getServiceReportWindows({
      serviceIds: [serviceId],
      since,
    });
    return rows[0]?.reporters ?? 0;
  },
  ["external-service-report:service-reporters"],
  { revalidate: REPORTS_REVALIDATE_SECONDS, tags: [REPORTS_TAG] },
);

const cachedComponentReporters = unstable_cache(
  async (serviceId: number) => {
    const since = new Date(Date.now() - REPORT_WINDOW_MS);
    return getComponentReportWindows({ serviceId, since });
  },
  ["external-service-report:component-reporters"],
  { revalidate: REPORTS_REVALIDATE_SECONDS, tags: [REPORTS_TAG] },
);

type EscalationInput = {
  id: number;
  slug: string;
  aliases: unknown;
};

export type ServiceEscalation = {
  indicator: string;
  status: string;
  escalated: boolean;
  reporters: number;
  threshold: number;
  lastFetchedAt: number;
};

async function serviceReporters(serviceId: number): Promise<number> {
  try {
    return await cachedServiceReporters(serviceId);
  } catch (err) {
    console.error("[escalation] service reporters read failed:", err);
    return 0;
  }
}

export async function getServiceEscalation(
  service: EscalationInput,
): Promise<ServiceEscalation> {
  const aliasSlugs = Array.isArray(service.aliases) ? service.aliases : [];
  const slugChain = [service.slug, ...aliasSlugs];

  const [latestRes, reporters] = await Promise.all([
    safePipeData(
      tb.externalStatusLatest({ ids: slugChain }),
      "externalStatusLatest (escalation)",
    ),
    serviceReporters(service.id),
  ]);

  const latestRows = [...latestRes.data].sort(
    (a, b) => b.last_fetched_at - a.last_fetched_at,
  );
  const latest = latestRows[0];
  const effective = computeEffectiveStatus({
    providerIndicator: latest?.indicator ?? "",
    providerStatus: latest?.status ?? "",
    reporters,
    threshold: REPORT_THRESHOLD,
  });

  return {
    ...effective,
    reporters,
    threshold: REPORT_THRESHOLD,
    lastFetchedAt: latest?.last_fetched_at ?? 0,
  };
}

export async function getComponentEscalation(args: {
  serviceId: number;
  componentId: number;
  indicator: string;
  status: string;
}): Promise<{ indicator: string; status: string; escalated: boolean }> {
  let reporters = 0;
  try {
    const rows = await cachedComponentReporters(args.serviceId);
    reporters =
      rows.find((r) => r.componentId === args.componentId)?.reporters ?? 0;
  } catch (err) {
    console.error("[escalation] component reporters read failed:", err);
  }
  return computeEffectiveStatus({
    providerIndicator: args.indicator,
    providerStatus: args.status,
    reporters,
    threshold: REPORT_THRESHOLD,
  });
}
