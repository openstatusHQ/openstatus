import type { RouterOutputs } from "@openstatus/api";

export type UptimeHistory = RouterOutputs["page"]["getUptimeHistory"];
export type Row = UptimeHistory["rows"][number];
export type Value = NonNullable<Row["months"][string]>;
export type RowEvent = Row["events"][number];

/** Minutes the month has run so far; the current month is partial. */
export function monthMinutes(key: string, now = new Date()): number {
  const start = monthDate(key).getTime();
  const [y, m] = key.split("-").map(Number);
  const end = Math.min(new Date(y, m, 1).getTime(), now.getTime());
  return Math.max(0, (end - start) / 60_000);
}

// prototype: derived from the percentage, so request-based months are an estimate
export function downtimeMinutes(
  percentage: number | null | undefined,
  key: string,
): number | null {
  if (percentage === null || percentage === undefined) return null;
  return (monthMinutes(key) * (100 - percentage)) / 100;
}

export function formatDowntime(minutes: number | null): string {
  if (minutes === null) return "–";
  if (minutes < 1) return "<1m";
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m ? `${h}h ${m}m` : `${h}h`;
}

export const eventFill: Record<RowEvent["type"], string> = {
  incident: "bg-destructive",
  report: "bg-warning",
  maintenance: "bg-info",
};

/** Page uptime for a month: the mean of the components that have a value. */
export function pageMonth(rows: Row[], key: string): number | null {
  const values = rows
    .map((r) => r.months[key]?.percentage)
    .filter((v): v is number => typeof v === "number");
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export type PageEvent = RowEvent & { components: string[] };

/** Events across all components, deduped by id so a shared report shows once. */
export function pageEvents(rows: Row[]): PageEvent[] {
  const map = new Map<string, PageEvent>();
  for (const row of rows) {
    for (const e of row.events) {
      const key = `${e.type}-${e.id}`;
      const existing = map.get(key);
      if (existing) existing.components.push(row.component.name);
      else map.set(key, { ...e, components: [row.component.name] });
    }
  }
  return [...map.values()].sort((a, b) => b.from.getTime() - a.from.getTime());
}

export function eventsInMonth<T extends { from: Date; to: Date | null }>(
  events: T[],
  key: string,
): T[] {
  const [y, m] = key.split("-").map(Number);
  const start = new Date(y, m - 1, 1).getTime();
  const end = new Date(y, m, 1).getTime();
  return events.filter(
    (e) => e.from.getTime() < end && (e.to?.getTime() ?? Date.now()) >= start,
  );
}

export function monthDate(key: string): Date {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1);
}

// ---------- example data (prototype only) ----------

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const COMPONENTS = [
  { id: 1, name: "API", type: "monitor" as const, since: 0 },
  { id: 2, name: "Dashboard", type: "monitor" as const, since: 0 },
  { id: 3, name: "Webhooks", type: "monitor" as const, since: 2 },
  { id: 4, name: "EU region", type: "monitor" as const, since: 5 },
  { id: 5, name: "Documentation", type: "static" as const, since: 0 },
];

type Seed = {
  month: number; // months ago
  day: number;
  hours: number;
  type: RowEvent["type"];
  name: string;
  components: number[];
};

const EVENTS: Seed[] = [
  {
    month: 0,
    day: 3,
    hours: 1.5,
    type: "report",
    name: "Elevated API latency",
    components: [1, 4],
  },
  {
    month: 0,
    day: 12,
    hours: 0.4,
    type: "incident",
    name: "API returned 502",
    components: [1],
  },
  {
    month: 0,
    day: 18,
    hours: 2,
    type: "maintenance",
    name: "Database upgrade",
    components: [1, 2, 3],
  },
  {
    month: 1,
    day: 7,
    hours: 5,
    type: "report",
    name: "Webhook deliveries delayed",
    components: [3],
  },
  {
    month: 1,
    day: 21,
    hours: 0.2,
    type: "incident",
    name: "Dashboard timeout",
    components: [2],
  },
  {
    month: 2,
    day: 2,
    hours: 3,
    type: "maintenance",
    name: "Load balancer migration",
    components: [1, 2],
  },
  {
    month: 3,
    day: 14,
    hours: 9,
    type: "report",
    name: "Partial outage in EU",
    components: [1, 2, 4],
  },
  {
    month: 3,
    day: 15,
    hours: 1,
    type: "incident",
    name: "EU region unreachable",
    components: [4],
  },
  {
    month: 5,
    day: 9,
    hours: 0.5,
    type: "incident",
    name: "Docs build failed",
    components: [5],
  },
  {
    month: 6,
    day: 25,
    hours: 2,
    type: "maintenance",
    name: "TLS certificate rotation",
    components: [1, 2, 3, 5],
  },
  {
    month: 8,
    day: 11,
    hours: 4,
    type: "report",
    name: "Login issues",
    components: [2],
  },
  {
    month: 10,
    day: 4,
    hours: 0.7,
    type: "incident",
    name: "API returned 500",
    components: [1],
  },
];

const STATUS: Record<RowEvent["type"], RowEvent["status"]> = {
  incident: "error",
  report: "degraded",
  maintenance: "info",
};

export function buildPrototypeHistory(now = new Date()): UptimeHistory {
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  const events = EVENTS.map((s, i) => {
    const from = new Date(
      now.getFullYear(),
      now.getMonth() - s.month,
      s.day,
      9 + (i % 6),
    );
    // keep current-month events in the past
    if (from > now) from.setDate(Math.max(1, now.getDate() - 1));
    const to = new Date(from.getTime() + s.hours * 3_600_000);
    return { ...s, id: i + 1, from, to };
  });

  const rows: Row[] = COMPONENTS.map((c) => {
    const rng = mulberry32(c.id * 7919);
    const own = events.filter((e) => e.components.includes(c.id));
    const unit =
      c.type === "monitor" ? ("requests" as const) : ("time" as const);
    const total = unit === "requests" ? 30 * 1_440 : 30 * 86_400_000;
    const values = months.map((key, i): Value | null => {
      if (i < c.since) return null;
      const hits = eventsInMonth(own, key).filter(
        (e) => e.type !== "maintenance",
      );
      const penalty = hits.reduce(
        (a, e) =>
          a + (e.type === "incident" ? 0.25 : 0.12) * Math.min(e.hours, 6),
        0,
      );
      const base = 99.92 + rng() * 0.08;
      const percentage =
        Math.round(Math.max(97.5, base - penalty) * 1_000) / 1_000;
      const error = Math.round(total * (1 - percentage / 100));
      const degraded = hits.some((e) => e.type === "report")
        ? Math.round(error * 0.6)
        : 0;
      return { percentage, ok: total - error - degraded, degraded, error };
    });
    const present = values.filter((v): v is Value => v !== null);
    const sum = present.reduce(
      (a, v) => ({
        ok: a.ok + v.ok,
        degraded: a.degraded + v.degraded,
        error: a.error + v.error,
      }),
      { ok: 0, degraded: 0, error: 0 },
    );
    return {
      component: { id: c.id, name: c.name, type: c.type, monitorId: null },
      unit,
      months: Object.fromEntries(months.map((k, i) => [k, values[i]])),
      total: present.length
        ? {
            ...sum,
            percentage:
              present.reduce((a, v) => a + v.percentage, 0) / present.length,
          }
        : null,
      runs: null,
      events: own.map((e) => ({
        id: e.id,
        name: e.name,
        type: e.type,
        status: STATUS[e.type],
        from: e.from,
        to: e.to,
      })),
      maintenanceWindows: [],
      excusedOutages: [],
    };
  });

  return {
    mode: "requests",
    timeZone: "UTC",
    months,
    utcOnlyMonths: [],
    createdAt: new Date(now.getFullYear() - 1, now.getMonth() - 2, 1),
    partial: false,
    runsPartial: false,
    summary: {
      uptime:
        rows.reduce((a, r) => a + (r.total?.percentage ?? 0), 0) / rows.length,
      runsUptime: null,
      reports: events.filter((e) => e.type === "report").length,
    },
    rows,
  };
}
