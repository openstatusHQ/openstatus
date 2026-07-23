import type { RouterOutputs } from "@openstatus/api";

type UptimeHistory = RouterOutputs["page"]["getUptimeHistory"];
type HistoryRow = UptimeHistory["rows"][number];

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

const round = (value: number) => Math.round(value * 100) / 100;

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

    return {
      component: { ...component, monitorId: null },
      months: Object.fromEntries(months.map((key, i) => [key, values[i]])),
      rolling: Object.fromEntries(
        WINDOWS.map((w) => [w, average(values.slice(-Number(w)))]),
      ) as HistoryRow["rolling"],
      events: [],
    };
  });

  const summary = Object.fromEntries(
    WINDOWS.map((w) => [
      w,
      {
        uptime: average(rows.map((row) => row.rolling[w])),
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
