import type { IncidentSlaTimerKind } from "./state";

const UNITS = [
  ["d", 1440],
  ["h", 60],
  ["m", 1],
] as const;

/** 90 → `"1h 30m"`, the target as the breach message names it. */
export function formatIncidentSlaMinutes(minutes: number): string {
  let rest = minutes;
  const parts: string[] = [];
  for (const [unit, size] of UNITS) {
    const n = Math.floor(rest / size);
    if (n > 0) parts.push(`${n}${unit}`);
    rest -= n * size;
  }
  return parts.join(" ") || "0m";
}

const LABEL: Record<IncidentSlaTimerKind, string> = {
  response: "Response",
  resolution: "Resolution",
};

/** `Response target of 4h breached, due <ISO>`; the dashboard parses it back. */
export function incidentSlaBreachMessage(args: {
  kind: IncidentSlaTimerKind;
  targetMinutes: number;
  dueAt: Date;
}): string {
  return `${LABEL[args.kind]} target of ${formatIncidentSlaMinutes(args.targetMinutes)} breached, due ${args.dueAt.toISOString()}`;
}

const BREACH = /^(Response|Resolution) target of (.+) breached, due (\S+)$/;

export function parseIncidentSlaBreachMessage(
  message: string | null,
): { kind: IncidentSlaTimerKind; target: string; dueAt: Date } | null {
  const match = message ? BREACH.exec(message) : null;
  if (!match) return null;
  const dueAt = new Date(match[3] ?? "");
  if (Number.isNaN(dueAt.getTime())) return null;
  return {
    kind: match[1] === "Response" ? "response" : "resolution",
    target: match[2] ?? "",
    dueAt,
  };
}

/** `Update due <ISO> missed (every 4h)`; the dashboard parses it back. */
export function incidentUpdateMissedMessage(args: {
  intervalMinutes: number;
  dueAt: Date;
}): string {
  return `Update due ${args.dueAt.toISOString()} missed (every ${formatIncidentSlaMinutes(args.intervalMinutes)})`;
}

const UPDATE_MISSED = /^Update due (\S+) missed \(every (.+)\)$/;

export function parseIncidentUpdateMissedMessage(
  message: string | null,
): { interval: string; dueAt: Date } | null {
  const match = message ? UPDATE_MISSED.exec(message) : null;
  if (!match) return null;
  const dueAt = new Date(match[1] ?? "");
  if (Number.isNaN(dueAt.getTime())) return null;
  return { interval: match[2] ?? "", dueAt };
}
