import type { RouterOutputs } from "@openstatus/api";

type UptimeHistory = RouterOutputs["page"]["getUptimeHistory"];
type HistoryRow = UptimeHistory["rows"][number];
type HistoryValue = NonNullable<HistoryRow["months"][string]>;

// TODO: rework later - currently not happy how we keep the metrics data available

const HISTORY_MONTHS = 24;
const WINDOWS = ["6", "12", "24"] as const;

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

// UTC buckets, matching the server's monthKeys
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

  const rows: HistoryRow[] = COMPONENTS.map((component, index) => {
    const rng = mulberry32(component.id * 7919);
    const values = months.map((_, i) => {
      // stagger creation dates so older cells show the no-data state
      if (i < index * 3) return null;
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
      rolling: Object.fromEntries(
        WINDOWS.map((w) => [w, sumValues(monthValues.slice(-Number(w)))]),
      ) as HistoryRow["rolling"],
      runs: null,
      events: [],
    };
  });

  const summary = Object.fromEntries(
    WINDOWS.map((w) => [
      w,
      {
        uptime: average(rows.map((row) => row.rolling[w]?.percentage ?? null)),
        runsUptime: null,
        reports: Number(w) / 3,
      },
    ]),
  ) as UptimeHistory["summary"];

  return {
    mode: "requests",
    months,
    createdAt: new Date(
      Date.UTC(now.getUTCFullYear() - 2, now.getUTCMonth(), 1),
    ),
    summary,
    rows,
  };
}
