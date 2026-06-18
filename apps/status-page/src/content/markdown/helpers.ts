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
