import type { RouterOutputs } from "@openstatus/api";

type UptimeHistory = RouterOutputs["page"]["getUptimeHistory"];
type HistoryRow = UptimeHistory["rows"][number];
type HistoryValue = NonNullable<HistoryRow["months"][string]>;
type HistoryEvent = HistoryRow["events"][number];

// TODO: rework later - currently not happy how we keep the metrics data available

const HISTORY_MONTHS = 6;

// deterministic PRNG so the placeholder rows don't reshuffle between renders
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

// UTC months, like the server's for a UTC page
function monthKeys(now: Date): string[] {
  return Array.from({ length: HISTORY_MONTHS }, (_, i) => {
    const d = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth() - (HISTORY_MONTHS - 1 - i),
        1,
      ),
    );
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    return `${d.getUTCFullYear()}-${mm}`;
  });
}

const COMPONENTS: { id: number; name: string; type: "monitor" | "static" }[] = [
  { id: 1, name: "API", type: "monitor" },
  { id: 2, name: "Dashboard", type: "monitor" },
  { id: 3, name: "Documentation", type: "static" },
];

const HOUR = 3_600_000;

type ExampleAnnotations = Pick<
  HistoryRow,
  "events" | "maintenanceWindows" | "excusedOutages"
>;

// month offsets count back from the current month; clamped so nothing lands in the future
function exampleAnnotations(now: Date): Record<number, ExampleAnnotations> {
  const at = (monthsAgo: number, day: number, hour: number) =>
    new Date(
      Math.min(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth() - monthsAgo,
          day,
          hour,
        ),
        now.getTime() - 3 * HOUR,
      ),
    );
  const span = (from: Date, hours: number) =>
    new Date(from.getTime() + hours * HOUR);
  const event = (
    id: number,
    name: string,
    type: HistoryEvent["type"],
    from: Date,
    hours: number,
  ): HistoryEvent => ({
    id,
    name,
    type,
    status:
      type === "incident" ? "error" : type === "report" ? "degraded" : "info",
    from,
    to: span(from, hours),
  });

  return {
    1: {
      events: [
        event(1, "Elevated API error rates", "report", at(4, 9, 14), 2),
        event(2, "Gateway timeouts", "incident", at(2, 17, 3), 1.5),
        event(3, "Database upgrade", "maintenance", at(1, 6, 22), 2),
        event(4, "Failed health checks", "incident", at(0, 1, 8), 0.4),
      ],
      maintenanceWindows: [
        {
          id: 1,
          title: "Weekly deploy window",
          mode: "continue",
          from: at(3, 12, 6),
          to: at(3, 12, 7),
        },
      ],
      excusedOutages: [
        {
          id: 1,
          from: at(5, 21, 11),
          to: span(at(5, 21, 11), 0.75),
          reason: "Upstream provider outage",
        },
      ],
    },
    2: {
      events: [
        event(5, "Slow dashboard loads", "report", at(3, 3, 16), 3),
        event(6, "Login failures", "incident", at(1, 24, 9), 1),
      ],
      maintenanceWindows: [
        {
          id: 2,
          title: "Auth provider migration",
          mode: "pause",
          from: at(2, 28, 1),
          to: at(2, 28, 3),
        },
      ],
      excusedOutages: [],
    },
    3: {
      events: [event(7, "Docs search degraded", "report", at(0, 2, 10), 4)],
      maintenanceWindows: [],
      excusedOutages: [],
    },
  };
}

const round = (value: number) => Math.round(value * 1_000) / 1_000;

// a month of one-minute requests, or of milliseconds for static components
const MONTH_TOTAL = { requests: 30 * 1_440, time: 30 * 86_400_000 } as const;

function sumValues(values: (HistoryValue | null)[]): HistoryValue | null {
  const present = values.filter((v): v is HistoryValue => v !== null);
  if (present.length === 0) return null;
  const ok = present.reduce((a, v) => a + v.ok, 0);
  const degraded = present.reduce((a, v) => a + v.degraded, 0);
  const error = present.reduce((a, v) => a + v.error, 0);
  const percentage = round(((ok + degraded) / (ok + degraded + error)) * 100);
  return { percentage, ok, degraded, error };
}

function average(values: (number | null)[]): number | null {
  const present = values.filter((v): v is number => v !== null);
  if (present.length === 0) return null;
  return round(present.reduce((a, b) => a + b, 0) / present.length);
}

export function buildExampleHistory(now = new Date()): UptimeHistory {
  const months = monthKeys(now);
  const annotations = exampleAnnotations(now);

  const rows: HistoryRow[] = COMPONENTS.map((component, index) => {
    const rng = mulberry32(component.id * 7919);
    const values = months.map((_, i) => {
      // stagger creation dates so older cells show the no-data state
      if (i < index * 2) return null;
      const roll = rng();
      if (roll > 0.96) return round(97 + rng() * 1.9);
      if (roll > 0.85) return round(99 + rng() * 0.85);
      return round(99.9 + rng() * 0.1);
    });

    const unit = component.type === "monitor" ? "requests" : "time";
    const total = MONTH_TOTAL[unit];
    const monthValues = values.map((percentage): HistoryValue | null => {
      if (percentage === null) return null;
      const ok = Math.round((total * percentage) / 100);
      return { percentage, ok, degraded: 0, error: total - ok };
    });

    return {
      component: { ...component, monitorId: null },
      unit,
      months: Object.fromEntries(months.map((key, i) => [key, monthValues[i]])),
      total: sumValues(monthValues),
      runs: null,
      ...annotations[component.id],
    };
  });

  const summary: UptimeHistory["summary"] = {
    uptime: average(rows.map((row) => row.total?.percentage ?? null)),
    runsUptime: null,
    reports: rows.reduce(
      (n, row) => n + row.events.filter((e) => e.type === "report").length,
      0,
    ),
  };

  return {
    mode: "requests",
    configuredMode: "requests",
    timeZone: "UTC",
    months,
    createdAt: new Date(
      Date.UTC(now.getUTCFullYear() - 2, now.getUTCMonth(), 1),
    ),
    partial: false,
    runsPartial: false,
    summary,
    rows,
  };
}
