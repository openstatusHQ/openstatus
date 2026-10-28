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
