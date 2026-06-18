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
  homepageUrl?: string | null;
  contactUrl?: string | null;
}): string {
  const lines = [
    "---",
    `title: ${escapeYaml(fields.title)}`,
    `description: ${escapeYaml(fields.description)}`,
    `canonical: ${escapeYaml(fields.canonical)}`,
  ];
  if (fields.homepageUrl)
    lines.push(`homepage_url: ${escapeYaml(fields.homepageUrl)}`);
  if (fields.contactUrl)
    lines.push(`contact_url: ${escapeYaml(fields.contactUrl)}`);
  lines.push("---");
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

/**
 * Root-relative `.md` link for a path under a page (root → `/.md`). Relative on
 * purpose: the frontmatter `canonical` carries the absolute base, so in-body
 * links need not repeat the host.
 */
export function mdUrl(path = ""): string {
  const clean = path.replace(/^\//, "");
  return clean ? `/${clean}.md` : "/.md";
}

/**
 * A breadcrumb / peer-nav line. Items with a `url` render as links; the current
 * item (no `url`) renders as plain text. Use ` › ` for hierarchy, ` · ` for peers.
 */
export function navLine(
  items: { label: string; url?: string }[],
  separator = " › ",
): string {
  return items
    .map((i) => (i.url ? `[${i.label}](${i.url})` : i.label))
    .join(separator);
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

// Severity order mirrors `pageComponentImpact` in @openstatus/db; kept local so
// the generators stay types-only against the API and don't value-import the schema.
const IMPACT_ORDER = [
  "operational",
  "degraded_performance",
  "partial_outage",
  "major_outage",
];

const IMPACT_LABELS: Record<string, string> = {
  operational: "operational",
  degraded_performance: "degraded performance",
  partial_outage: "partial outage",
  major_outage: "major outage",
};

export function impactLabel(impact: string): string {
  return IMPACT_LABELS[impact] ?? impact;
}

/** "name (impact label)", dropping the impact when operational/absent. */
export function componentImpact(name: string, impact?: string | null): string {
  return impact && impact !== "operational"
    ? `${name} (${impactLabel(impact)})`
    : name;
}

/**
 * Like `componentImpact` but always shows the impact label, even operational —
 * for a single update's affects line, where every component has a declared
 * impact and dropping operational would read as inconsistent against siblings.
 */
export function componentImpactExplicit(
  name: string,
  impact?: string | null,
): string {
  return impact ? `${name} (${impactLabel(impact)})` : name;
}

/** Most severe impact among the given values, or null if empty. */
export function worstImpact(impacts: string[]): string | null {
  let worst: string | null = null;
  for (const i of impacts) {
    if (
      worst === null ||
      IMPACT_ORDER.indexOf(i) > IMPACT_ORDER.indexOf(worst)
    ) {
      worst = i;
    }
  }
  return worst;
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

/** "2026-06-18 14:50" (UTC, sortable, fixed-width). */
export function formatLogStamp(date: Date | string | number): string {
  const d = toDate(date);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const min = String(d.getUTCMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

export type EventLogRow = {
  timestamp: Date | string | number;
  label: string;
  emoji: string;
  ref: string;
  title: string;
};

/**
 * Greppable event log: one update per line, sortable stamp first, newest first.
 * Aligned columns come before the emoji so its variable render width can't throw
 * them off; the title trails as free human text. Built only from structured
 * fields — no user-authored prose — so the index stays deterministic.
 */
export function eventLog(rows: EventLogRow[]): string {
  if (rows.length === 0) return "";
  const sorted = [...rows].sort(
    (a, b) => toDate(b.timestamp).getTime() - toDate(a.timestamp).getTime(),
  );
  const statusW = Math.max(6, ...sorted.map((r) => r.label.length));
  const refW = Math.max(5, ...sorted.map((r) => r.ref.length));
  const header = `# ${"timestamp".padEnd(16)}  ${"status".padEnd(statusW)}  event`;
  const lines = sorted.map(
    (r) =>
      `${formatLogStamp(r.timestamp)}  ${r.label.padEnd(statusW)}  ${r.ref.padEnd(refW)}  ${r.emoji} ${r.title}`,
  );
  return ["```text", header, ...lines, "```"].join("\n");
}

/** "Jun 18, 2026 14:50 (GMT+0)" (UTC, deterministic). */
export function formatStamp(date: Date | string | number): string {
  const d = toDate(date);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()} ${hh}:${mm} (GMT+0)`;
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
