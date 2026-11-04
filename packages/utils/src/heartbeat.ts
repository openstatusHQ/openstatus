const UNITS = [
  { seconds: 86_400, label: "d" },
  { seconds: 3_600, label: "h" },
  { seconds: 60, label: "m" },
] as const;

/** `5400` → `"1h 30m"`; heartbeat periods and graces are whole minutes. */
export function formatHeartbeatSeconds(seconds: number): string {
  const parts: string[] = [];
  let rest = seconds;
  for (const unit of UNITS) {
    const value = Math.floor(rest / unit.seconds);
    if (value > 0) parts.push(`${value}${unit.label}`);
    rest -= value * unit.seconds;
  }
  if (rest > 0 || parts.length === 0) parts.push(`${rest}s`);
  return parts.join(" ");
}

export function heartbeatExpectation(config: {
  heartbeatPeriod: number | null;
  heartbeatGrace: number | null;
}): string {
  const period = formatHeartbeatSeconds(config.heartbeatPeriod ?? 0);
  const grace = formatHeartbeatSeconds(config.heartbeatGrace ?? 0);
  return `Expected every ${period} (+${grace} grace)`;
}

/** The single pseudo-region a heartbeat's status is recorded under. */
export const HEARTBEAT_REGION = "heartbeat";

/** Regions whose `monitor_status` rows decide a monitor's status. */
export function statusRegions<R extends string>(monitor: {
  jobType: string;
  regions: R[];
}): string[] {
  return monitor.jobType === "heartbeat" ? [HEARTBEAT_REGION] : monitor.regions;
}

/** `allowlist` is a comma list of workspace ids, or `*` for everyone. */
export function isHeartbeatAllowed(
  workspaceId: number,
  allowlist: string | undefined,
): boolean {
  const ids = (allowlist ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  return ids.includes("*") || ids.includes(String(workspaceId));
}
