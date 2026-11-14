import type { IncidentUpdateCadence } from "@openstatus/db/src/schema/incident_sla_policies/cadence";
import type { IncidentSlaTimer } from "@openstatus/db/src/schema/incident_sla_policies/state";

import { formatDurationShort } from "@/lib/formatter";

/** `"4h"` → 240 minutes; empty means the timer is off. Units in order, each at most once. */
export function parseSlaDuration(
  value: string,
): { ok: true; minutes: number | undefined } | { ok: false } {
  const v = value.trim().toLowerCase().replace(/\s+/g, "");
  if (v === "") return { ok: true, minutes: undefined };
  const match = /^(?:(\d+)d)?(?:(\d+)h)?(?:(\d+)m)?$/.exec(v);
  if (!match) return { ok: false };
  const [, d, h, m] = match;
  return {
    ok: true,
    minutes: Number(d ?? 0) * 1440 + Number(h ?? 0) * 60 + Number(m ?? 0),
  };
}

const MINUTE = 60_000;

/** "due in 35m", "breached 2h ago", "met at declare", "met in 4m", "met 3h late". */
export function slaTimerPhrase(timer: IncidentSlaTimer, now: Date): string {
  if (timer.metAt) {
    const took = timer.metAt.getTime() - timer.startsAt.getTime();
    if (took <= 0) return "met at declare";
    return timer.breachDueAt
      ? `met ${formatSpan(timer.metAt.getTime() - timer.breachDueAt.getTime())} late`
      : `met in ${formatSpan(took)}`;
  }
  const delta = timer.dueAt.getTime() - now.getTime();
  return timer.status === "breached"
    ? `breached ${formatSpan(-delta)} ago`
    : `due in ${formatSpan(delta)}`;
}

/** "due in 1h 4m", "overdue by 45m". */
export function updateCadencePhrase(
  cadence: IncidentUpdateCadence,
  now: Date,
): string {
  const delta = cadence.dueAt.getTime() - now.getTime();
  return cadence.status === "overdue"
    ? `overdue by ${formatSpan(-delta)}`
    : `due in ${formatSpan(delta)}`;
}

// at least a minute, so "due in 0m" never shows
function formatSpan(ms: number): string {
  return formatDurationShort(Math.max(ms, MINUTE));
}
