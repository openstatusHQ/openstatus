export const REPORT_THRESHOLD = 7;
export const REPORT_WINDOW_MS = 15 * 60 * 1000;
export const REPORT_WINDOW_MINUTES = REPORT_WINDOW_MS / 60_000;
// The cron does not tick on a steady schedule (gaps of 10-40+ minutes), and a
// snapshot is only published once the whole tick finishes, so allow ~2h.
export const STALE_THRESHOLD_MS = 2 * 60 * 60 * 1000;

export type EffectiveStatus = {
  indicator: string;
  status: string;
  escalated: boolean;
};

export function computeEffectiveStatus(args: {
  providerIndicator: string;
  providerStatus: string;
  reporters: number;
  threshold: number;
}): EffectiveStatus {
  const { providerIndicator, providerStatus, reporters, threshold } = args;
  const canEscalate =
    providerIndicator === "none" && providerStatus !== "under_maintenance";
  if (canEscalate && reporters >= threshold) {
    return { indicator: "minor", status: providerStatus, escalated: true };
  }
  return {
    indicator: providerIndicator,
    status: providerStatus,
    escalated: false,
  };
}

const SEVERITY: Record<string, number> = { minor: 1, major: 2, critical: 3 };

export function severityOf(indicator: string): number {
  return SEVERITY[indicator] ?? 0;
}

export function isProblem(s: { indicator: string; status: string }): boolean {
  return severityOf(s.indicator) > 0 || s.status === "under_maintenance";
}

// Sort key for "worst first": outages, then maintenance, then calm.
export function problemRank(s: { indicator: string; status: string }): number {
  // Maintenance wins over the indicator, as in statusLabel and getStatusAnswer.
  if (s.status === "under_maintenance") return 0.5;
  return severityOf(s.indicator);
}

// A minute of clock skew between the fetcher and this machine is tolerated.
const FUTURE_SKEW_MS = 60_000;

// A reading counts as live only when it exists and is under STALE_THRESHOLD_MS (2h) old.
// A timestamp further in the future than the skew is invalid, not fresh.
export function isFresh(checkedAtMs: number, now = Date.now()): boolean {
  return (
    checkedAtMs > 0 &&
    checkedAtMs <= now + FUTURE_SKEW_MS &&
    now - checkedAtMs <= STALE_THRESHOLD_MS
  );
}

export type StatusLabel =
  | "operational"
  | "minor_issue"
  | "partial_outage"
  | "major_outage"
  | "maintenance"
  | "unknown";

export function statusLabel(s: {
  indicator: string;
  status: string;
}): StatusLabel {
  if (s.status === "under_maintenance") return "maintenance";
  switch (s.indicator) {
    case "none":
      return "operational";
    case "minor":
      return "minor_issue";
    case "major":
      return "partial_outage";
    case "critical":
      return "major_outage";
    default:
      return "unknown";
  }
}

// Natural-language answer to "Is <name> down?"; the web pages and their
// markdown twins read the same sentence.
export function getStatusAnswer(args: {
  name: string;
  indicator: string;
  status: string;
  hasLiveData: boolean;
}): string {
  const { name, indicator, status, hasLiveData } = args;
  if (!hasLiveData) {
    return `We don't have live data for ${name} right now. Check the official ${name} status page.`;
  }
  if (status === "under_maintenance") {
    return `${name} is currently undergoing scheduled maintenance.`;
  }
  switch (indicator) {
    case "none":
      return `No, ${name} is not down. All ${name} systems are operational.`;
    case "minor":
      return `${name} is up, but currently experiencing a minor issue.`;
    case "major":
      return `Yes, ${name} is experiencing a partial outage right now.`;
    case "critical":
      return `Yes, ${name} is down. A major outage is currently affecting ${name}.`;
    default:
      return `The current status of ${name} is unknown. Check the official ${name} status page.`;
  }
}
