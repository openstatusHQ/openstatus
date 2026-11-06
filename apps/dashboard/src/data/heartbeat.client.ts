import type { MetricCard } from "@/components/metric/metric-card";
import { formatDurationShort } from "@/lib/formatter";

export const HEARTBEAT_WINDOW_DAYS = 30;

export const heartbeatHealthConfig = {
  paused: { label: "Paused", variant: "default" },
  waiting: { label: "Waiting", variant: "default" },
  failed: { label: "Failed", variant: "destructive" },
  missed: { label: "Missed", variant: "destructive" },
  late: { label: "Late", variant: "warning" },
  "on-time": { label: "On time", variant: "success" },
} as const satisfies Record<
  string,
  { label: string; variant: React.ComponentProps<typeof MetricCard>["variant"] }
>;

export type HeartbeatHealth = keyof typeof heartbeatHealthConfig;

type HeartbeatState = {
  lastPingAt: Date | null;
  lastPingKind: "success" | "fail" | null;
  nextDueAt: Date | null;
  grace: number | null;
};

/** When the next ping should arrive: the alert deadline minus the grace. */
export function heartbeatExpectedAt(
  state: Pick<HeartbeatState, "nextDueAt" | "grace">,
): Date | null {
  if (!state.nextDueAt) return null;
  return new Date(state.nextDueAt.getTime() - (state.grace ?? 0) * 1000);
}

/** `late` is past the expected time but inside the grace, so nothing has alerted yet. */
export function getHeartbeatHealth(
  monitor: { active: boolean | null; status: string },
  state: HeartbeatState,
  now = new Date(),
): HeartbeatHealth {
  if (!monitor.active) return "paused";
  if (!state.lastPingAt) return "waiting";
  if (state.lastPingKind === "fail") return "failed";
  if (monitor.status === "error") return "missed";
  const expectedAt = heartbeatExpectedAt(state);
  return expectedAt && expectedAt <= now ? "late" : "on-time";
}

/** "in 12m" ahead of the expected time, "3m overdue" past it. */
export function formatNextPing(expectedAt: Date, now = new Date()): string {
  const ahead = expectedAt.getTime() - now.getTime();
  return ahead > 0
    ? `in ${formatDurationShort(ahead)}`
    : `${formatDurationShort(-ahead)} overdue`;
}

/** First UTC day of the window that ends today. */
export function heartbeatWindowStart(now = new Date()): Date {
  return new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() - (HEARTBEAT_WINDOW_DAYS - 1),
    ),
  );
}

export type PingDay = {
  /** The UTC day as a local-midnight timestamp, so axis labels read as the bucket's date. */
  day: number;
  ok: number;
  error: number;
};

/** One entry per UTC day of the window, oldest first; days without a ping are zero. */
export function pingDays(
  rows: { day: string; ok: number; error: number }[],
  now = new Date(),
): PingDay[] {
  const byDay = new Map(rows.map((row) => [row.day.slice(0, 10), row]));
  const start = heartbeatWindowStart(now);
  return Array.from({ length: HEARTBEAT_WINDOW_DAYS }, (_, i) => {
    const utc = new Date(start.getTime());
    utc.setUTCDate(start.getUTCDate() + i);
    const row = byDay.get(utc.toISOString().slice(0, 10));
    return {
      day: new Date(
        utc.getUTCFullYear(),
        utc.getUTCMonth(),
        utc.getUTCDate(),
      ).getTime(),
      ok: row?.ok ?? 0,
      error: row?.error ?? 0,
    };
  });
}

/** Time down since `from` in ms; an open incident runs until `now`. */
export function downtimeSince(
  incidents: { startedAt: Date; resolvedAt: Date | null }[],
  from: Date,
  now = new Date(),
): number {
  return incidents.reduce((total, incident) => {
    const start = Math.max(incident.startedAt.getTime(), from.getTime());
    const end = (incident.resolvedAt ?? now).getTime();
    return total + Math.max(0, end - start);
  }, 0);
}
