import type { monitorIncidentTable } from "../schema";
import { monthStart } from "./frozen-uptime";

type InsertMonitorIncident = typeof monitorIncidentTable.$inferInsert;

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/**
 * Outages behind the frozen failures in `frozenUptimeSeed`, plus recent ones,
 * covering each way an outage ends: auto-resolved, by a user, or neither.
 */
export function monitorIncidentsSeed(): InsertMonitorIncident[] {
  const last = monthStart(-1).getTime();
  const before = monthStart(-2).getTime();
  const lastDay = monthStart(0).getTime() - DAY;
  const at = (start: number, day: number, hour: number, minute = 0) =>
    new Date(start + (day - 1) * DAY + hour * HOUR + minute * MIN);
  const outage = (
    id: number,
    monitorId: number,
    startedAt: Date,
    minutes: number,
    rest: Partial<InsertMonitorIncident> = {},
  ): InsertMonitorIncident => ({
    id,
    workspaceId: 1,
    monitorId,
    createdAt: startedAt,
    startedAt,
    resolvedAt: new Date(startedAt.getTime() + minutes * MIN),
    ...rest,
  });

  const eightDaysAgo = new Date(Date.now() - 8 * DAY);
  eightDaysAgo.setUTCHours(22, 0, 0, 0);
  const yesterday = new Date(Date.now() - DAY);

  return [
    outage(4, 1, at(last, 12, 2, 10), 30, {
      acknowledgedAt: at(last, 12, 2, 13),
      acknowledgedBy: 2,
      autoResolved: true,
    }),
    // 23:30 UTC on the month's last day: next month east of UTC
    outage(5, 1, new Date(lastDay + 23 * HOUR + 30 * MIN), 20, {
      resolvedBy: 3,
    }),
    // written through the v1 API: neither auto-resolved nor attributed
    outage(6, 3, at(last, 20, 14), 60),
    outage(7, 1, at(before, 18, 15), 30, { autoResolved: true }),
    // spans midnight UTC
    outage(8, 4, eightDaysAgo, 4 * 60, {
      acknowledgedAt: new Date(eightDaysAgo.getTime() + 10 * MIN),
      acknowledgedBy: 3,
      autoResolved: true,
    }),
    outage(9, 3, yesterday, 12, {
      acknowledgedAt: new Date(yesterday.getTime() + 4 * MIN),
      acknowledgedBy: 2,
      autoResolved: true,
    }),
  ];
}
