import type { IncidentEventType } from "../incidents/constants";
import type { IncidentTargetTimerKind } from "./state";

export const incidentSystemEventTypes = [
  "response_target_breached",
  "resolution_target_breached",
] as const satisfies ReadonlyArray<IncidentEventType>;

export type IncidentSystemEventType = (typeof incidentSystemEventTypes)[number];

/** Events the system records for missed targets; never activity, never "Last update". */
export function isIncidentSystemEvent(
  type: string,
): type is IncidentSystemEventType {
  return incidentSystemEventTypes.some((t) => t === type);
}

const UNITS = [
  ["d", 1440],
  ["h", 60],
  ["m", 1],
] as const;

/** 90 → `"1h 30m"`, the target as the breach message names it. */
export function formatIncidentTargetMinutes(minutes: number): string {
  let rest = minutes;
  const parts: string[] = [];
  for (const [unit, size] of UNITS) {
    const n = Math.floor(rest / size);
    if (n > 0) parts.push(`${n}${unit}`);
    rest -= n * size;
  }
  return parts.join(" ") || "0m";
}

const LABEL: Record<IncidentTargetTimerKind, string> = {
  response: "Response",
  resolution: "Resolution",
};

/** `Response target of 4h breached, due <ISO>`; the dashboard parses it back. */
export function incidentTargetBreachMessage(args: {
  kind: IncidentTargetTimerKind;
  targetMinutes: number;
  dueAt: Date;
}): string {
  return `${LABEL[args.kind]} target of ${formatIncidentTargetMinutes(args.targetMinutes)} breached, due ${args.dueAt.toISOString()}`;
}

const BREACH = /^(Response|Resolution) target of (.+) breached, due (\S+)$/;

export function parseIncidentTargetBreachMessage(
  message: string | null,
): { kind: IncidentTargetTimerKind; target: string; dueAt: Date } | null {
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
