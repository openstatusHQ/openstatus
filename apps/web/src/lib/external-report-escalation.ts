import {
  REPORT_THRESHOLD,
  REPORT_WINDOW_MS,
  computeEffectiveStatus,
} from "@openstatus/api/src/router/effective-status";
import { OSTinybird, safePipeData } from "@openstatus/tinybird";

import { env } from "@/env";

type EscalationInput = {
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

export async function getServiceEscalation(
  service: EscalationInput,
): Promise<ServiceEscalation> {
  const tb = new OSTinybird(env.TINY_BIRD_API_KEY);
  const aliasSlugs = Array.isArray(service.aliases) ? service.aliases : [];
  const slugChain = [service.slug, ...aliasSlugs];
  const since = Date.now() - REPORT_WINDOW_MS;

  const [latestRes, reportRes] = await Promise.all([
    safePipeData(
      tb.externalStatusLatest({ ids: slugChain }),
      "externalStatusLatest (escalation)",
    ),
    safePipeData(
      tb.externalReportsServiceWindow({ ids: [service.slug], since }),
      "externalReportsServiceWindow (escalation)",
    ),
  ]);

  const latestRows = [...latestRes.data].sort(
    (a, b) => b.last_fetched_at - a.last_fetched_at,
  );
  const latest = latestRows[0];
  const reporters = reportRes.data[0]?.reporters ?? 0;
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
  serviceSlug: string;
  componentId: number;
  indicator: string;
  status: string;
}): Promise<{ indicator: string; status: string; escalated: boolean }> {
  const tb = new OSTinybird(env.TINY_BIRD_API_KEY);
  const since = Date.now() - REPORT_WINDOW_MS;
  const res = await safePipeData(
    tb.externalReportsComponentWindow({ id: args.serviceSlug, since }),
    "externalReportsComponentWindow (escalation)",
  );
  const key = String(args.componentId);
  const reporters =
    res.data.find((r) => r.component_id === key)?.reporters ?? 0;
  return computeEffectiveStatus({
    providerIndicator: args.indicator,
    providerStatus: args.status,
    reporters,
    threshold: REPORT_THRESHOLD,
  });
}
