import {
  type HistoryRow,
  HISTORY_WINDOW_MONTHS,
  type MonthCell,
  offsetToKey,
} from "./data";

function cell(percentage: number): MonthCell {
  const status =
    percentage >= 99.9 ? "operational" : percentage >= 99 ? "degraded" : "down";
  return { percentage, status };
}

/** Build 24 months of buckets; `dips` overrides specific slots, `since` blanks older ones. */
function buckets(
  dips: Record<number, number> = {},
  since = HISTORY_WINDOW_MONTHS,
): HistoryRow["buckets"] {
  const out: HistoryRow["buckets"] = {};
  for (let offset = HISTORY_WINDOW_MONTHS; offset >= 1; offset--) {
    const key = offsetToKey(offset);
    out[key] = offset > since ? undefined : cell(dips[offset] ?? 100);
  }
  return out;
}

export const mockRows: HistoryRow[] = [
  {
    component: { id: 1, name: "Documenso", kind: "Monitor", basis: "requests" },
    buckets: buckets({ 9: 97.4, 4: 99.78 }),
    rolling6: 99.96,
    rolling12: 99.74,
    rolling24: 99.81,
  },
  {
    component: {
      id: 2,
      name: "OpenStatus TCP",
      kind: "Monitor",
      basis: "duration",
    },
    buckets: buckets({ 7: 99.62 }),
    rolling6: 100,
    rolling12: 99.97,
    rolling24: 99.98,
  },
  {
    component: { id: 3, name: "DNS test", kind: "Monitor", basis: "requests" },
    buckets: buckets(),
    rolling6: 100,
    rolling12: 100,
    rolling24: 100,
  },
  {
    component: {
      id: 4,
      name: "dns monitor",
      kind: "Monitor",
      basis: "duration",
    },
    buckets: buckets({ 11: 99.91 }),
    rolling6: 100,
    rolling12: 99.99,
    rolling24: 99.99,
  },
  {
    component: {
      id: 5,
      name: "OpenStatus Astro Status",
      kind: "Monitor",
      basis: "requests",
      addedAt: "Feb '26",
    },
    buckets: buckets({}, 5),
    rolling6: 100,
    rolling12: 100,
    rolling24: 100,
  },
  {
    component: {
      id: 6,
      name: "Marketing site",
      kind: "Static",
      basis: "manual",
      deleted: true,
    },
    buckets: buckets({ 8: 99.86 }),
    rolling6: 100,
    rolling12: 99.99,
    rolling24: 99.99,
  },
];
