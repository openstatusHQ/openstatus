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

import { env } from "@/env";

const tb = new OSTinybird(env.TINY_BIRD_API_KEY);

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

async function serviceReporters(
  serviceId: number,
  since: Date,
): Promise<number> {
  try {
    const rows = await getServiceReportWindows({
      serviceIds: [serviceId],
      since,
    });
    return rows[0]?.reporters ?? 0;
  } catch {
    return 0;
  }
}

export async function getServiceEscalation(
  service: EscalationInput,
): Promise<ServiceEscalation> {
  const aliasSlugs = Array.isArray(service.aliases) ? service.aliases : [];
  const slugChain = [service.slug, ...aliasSlugs];
  const since = new Date(Date.now() - REPORT_WINDOW_MS);

  const [latestRes, reporters] = await Promise.all([
    safePipeData(
      tb.externalStatusLatest({ ids: slugChain }),
      "externalStatusLatest (escalation)",
    ),
    serviceReporters(service.id, since),
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
  const since = new Date(Date.now() - REPORT_WINDOW_MS);
  let reporters = 0;
  try {
    const rows = await getComponentReportWindows({
      serviceId: args.serviceId,
      since,
    });
    reporters =
      rows.find((r) => r.componentId === args.componentId)?.reporters ?? 0;
  } catch {}
  return computeEffectiveStatus({
    providerIndicator: args.indicator,
    providerStatus: args.status,
    reporters,
    threshold: REPORT_THRESHOLD,
  });
}
