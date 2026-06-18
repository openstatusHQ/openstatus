export type ComponentStatus = "success" | "degraded" | "error" | "info";

export type ReportStatus =
  | "investigating"
  | "identified"
  | "monitoring"
  | "resolved"
  | "maintenance";

const COMPONENT_STATUS_LABELS: Record<ComponentStatus, string> = {
  success: "Operational",
  degraded: "Degraded",
  error: "Outage",
  info: "Maintenance",
};

const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  investigating: "Investigating",
  identified: "Identified",
  monitoring: "Monitoring",
  resolved: "Resolved",
  maintenance: "Maintenance",
};

export function statusLabel(status: string): string {
  if (status in COMPONENT_STATUS_LABELS) {
    return COMPONENT_STATUS_LABELS[status as ComponentStatus];
  }
  if (status in REPORT_STATUS_LABELS) {
    return REPORT_STATUS_LABELS[status as ReportStatus];
  }
  return status;
}

/** Escape a value for a single-quoted-equivalent YAML scalar (we use double quotes). */
function escapeYaml(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

export function frontmatter(fields: {
  title: string;
  description: string;
  canonical: string;
}): string {
  const lines = [
    "---",
    `title: ${escapeYaml(fields.title)}`,
    `description: ${escapeYaml(fields.description)}`,
    `canonical: ${escapeYaml(fields.canonical)}`,
    "---",
  ];
  return `${lines.join("\n")}\n`;
}

/** Escape a markdown table cell — pipes and newlines would break the row. */
export function escapeCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ").trim();
}

export function table(headers: string[], rows: string[][]): string {
  const head = `| ${headers.join(" | ")} |`;
  const divider = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows
    .map((row) => `| ${row.map((cell) => escapeCell(cell)).join(" | ")} |`)
    .join("\n");
  return body ? `${head}\n${divider}\n${body}` : `${head}\n${divider}`;
}

export function formatDate(
  date: Date | string | number | null | undefined,
): string {
  if (date === null || date === undefined) return "—";
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toISOString();
}

export function formatMs(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${Math.round(value)}ms`;
}

export function formatPercent(ratio: number): string {
  return `${(ratio * 100).toFixed(2)}%`;
}

/** Build the public-facing canonical (HTML) URL for a path under a page. */
export function canonicalUrl(baseUrl: string, path = ""): string {
  return path ? `${baseUrl}/${path.replace(/^\//, "")}` : baseUrl;
}

/** Build the `.md` URL for a path under a page (root → `${baseUrl}/.md`). */
export function mdUrl(baseUrl: string, path = ""): string {
  const clean = path.replace(/^\//, "");
  return clean ? `${baseUrl}/${clean}.md` : `${baseUrl}/.md`;
}

export type DayStatus = "success" | "degraded" | "error" | "info" | "empty";

const STATUS_EMOJI: Record<DayStatus, string> = {
  success: "🟩",
  degraded: "🟧",
  error: "🟥",
  info: "🟦",
  empty: "⬜",
};

const DAY_PRIORITY: Record<DayStatus, number> = {
  error: 3,
  degraded: 2,
  info: 1,
  success: 0,
  empty: -1,
};

export function statusEmoji(status: string): string {
  return STATUS_EMOJI[status as DayStatus] ?? STATUS_EMOJI.empty;
}

const LEGEND_LABELS: Record<DayStatus, string> = {
  success: "Operational",
  degraded: "Degraded",
  error: "Outage",
  info: "Maintenance",
  empty: "No data",
};

const LEGEND_ORDER: DayStatus[] = [
  "success",
  "degraded",
  "error",
  "info",
  "empty",
];

/** Legend line listing only the statuses present, in severity order. */
export function legend(statuses: Iterable<string>): string {
  const present = new Set(statuses);
  const parts = LEGEND_ORDER.filter((s) => present.has(s)).map(
    (s) => `${STATUS_EMOJI[s]} ${LEGEND_LABELS[s]}`,
  );
  return parts.length ? `Legend: ${parts.join(" · ")}` : "";
}

/** Status emoji for a report/update lifecycle status (resolved → green, etc.). */
export function reportStatusEmoji(status: string): string {
  if (status === "resolved") return STATUS_EMOJI.success;
  if (status === "maintenance") return STATUS_EMOJI.info;
  return STATUS_EMOJI.error;
}

/** Collapse a day's stacked bar segments to the single worst (most severe) status. */
export function dominantDayStatus(
  bar: { status: string; height: number }[],
): DayStatus {
  let best: DayStatus = "empty";
  for (const seg of bar) {
    const status = seg.status as DayStatus;
    if (seg.height > 0 && (DAY_PRIORITY[status] ?? -1) > DAY_PRIORITY[best]) {
      best = status;
    }
  }
  return best;
}

/** One emoji square per day, oldest → newest. */
export function uptimeBar(
  days: { bar: { status: string; height: number }[] }[],
): string {
  return days.map((d) => statusEmoji(dominantDayStatus(d.bar))).join("");
}

const SPARK_CHARS = "▁▂▃▄▅▆▇█";

/** Map a numeric series to an 8-level block sparkline scaled between min and max. */
export function sparkline(values: number[]): string {
  const finite = values.filter((v) => Number.isFinite(v));
  if (finite.length === 0) return "";
  const min = Math.min(...finite);
  const max = Math.max(...finite);
  const range = max - min;
  return values
    .map((v) => {
      if (!Number.isFinite(v)) return " ";
      const idx =
        range === 0
          ? 0
          : Math.round(((v - min) / range) * (SPARK_CHARS.length - 1));
      return SPARK_CHARS[idx];
    })
    .join("");
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function toDate(date: Date | string | number): Date {
  return date instanceof Date ? date : new Date(date);
}

/** "Jan 25, 2026" (UTC, deterministic). */
export function formatDay(date: Date | string | number): string {
  const d = toDate(date);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

/** "Feb 3, 1:42 PM" (UTC, deterministic). */
export function formatDayTime(date: Date | string | number): string {
  const d = toDate(date);
  const h = d.getUTCHours();
  const period = h < 12 ? "AM" : "PM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  const minutes = String(d.getUTCMinutes()).padStart(2, "0");
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${hour12}:${minutes} ${period}`;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

function coarseSpan(ms: number): string {
  if (ms < HOUR) {
    const m = Math.max(1, Math.round(ms / MINUTE));
    return `${m} ${m === 1 ? "minute" : "minutes"}`;
  }
  if (ms < DAY) {
    const h = Math.round(ms / HOUR);
    return `${h} ${h === 1 ? "hour" : "hours"}`;
  }
  if (ms < MONTH) {
    const d = Math.round(ms / DAY);
    return `${d} ${d === 1 ? "day" : "days"}`;
  }
  if (ms < YEAR) {
    const m = Math.round(ms / MONTH);
    return `${m} ${m === 1 ? "month" : "months"}`;
  }
  const y = Math.round(ms / YEAR);
  return `${y} ${y === 1 ? "year" : "years"}`;
}

/** "4 months ago" relative to `now`. */
export function relativeTime(
  date: Date | string | number,
  now: number,
): string {
  const ms = now - toDate(date).getTime();
  if (ms < MINUTE) return "just now";
  return `${coarseSpan(ms)} ago`;
}

/** Human duration between two instants: "9 days", "23 hours". */
export function humanDuration(
  from: Date | string | number,
  to: Date | string | number,
): string {
  return coarseSpan(Math.max(0, toDate(to).getTime() - toDate(from).getTime()));
}

/** Attribution footer appended to every doc unless the page is white-labeled. */
export function poweredByFooter(): string {
  return "---\n\n_Powered by [openstatus.dev](https://openstatus.dev)_\n";
}

/** Append the attribution footer to rendered markdown unless white-labeled. */
export function withPoweredBy(markdown: string, whiteLabel: boolean): string {
  if (whiteLabel) return markdown;
  return `${markdown}\n${poweredByFooter()}`;
}
