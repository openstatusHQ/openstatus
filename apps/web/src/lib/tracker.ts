import type { z } from "zod";

import type { selectIncidentPageSchema } from "@openstatus/db/src/schema/shared";
import type { Monitor, Ping } from "@openstatus/tinybird";

export type StatusVariant = "up" | "degraded" | "down" | "empty";

type GetStatusReturnType = {
  label: string;
  variant: StatusVariant;
};

/**
 * Get the status of a monitor based on its ratio
 * @param ratio
 * @returns
 */
export const getStatus = (ratio: number): GetStatusReturnType => {
  if (isNaN(ratio))
    return {
      label: "Missing",
      variant: "empty",
    };
  if (ratio >= 0.98)
    return {
      label: "Operational",
      variant: "up",
    };
  if (ratio >= 0.5)
    return {
      label: "Degraded",
      variant: "degraded",
    };
  return {
    label: "Downtime",
    variant: "down",
  };
};

// TODO: move into Class component sharing the same `data`

/**
 * equal days - fixes issue with daylight saving
 * @param date1
 * @param date2
 * @returns
 */
export function areDatesEqualByDayMonthYear(date1: Date, date2: Date) {
  date1.setDate(date1.getDate());
  date1.setHours(0, 0, 0, 0);

  date2.setDate(date2.getDate());
  date2.setHours(0, 0, 0, 0);

  return date1.toUTCString() === date2.toUTCString();
}

export function addBlackListInfo(data: Monitor[]) {
  return data.map((monitor) => {
    const blacklist = isInBlacklist(new Date(monitor.day).getTime());
    return { ...monitor, blacklist };
  });
}

export function getTotalUptime(data: { ok: number; count: number }[]) {
  const reducedData = data.reduce(
    (prev, curr) => {
      prev.ok += curr.ok;
      prev.count += curr.count;
      return prev;
    },
    {
      count: 0,
      ok: 0,
    },
  );
  return reducedData;
}

export function getTotalUptimeString(data: { ok: number; count: number }[]) {
  const reducedData = getTotalUptime(data);
  const uptime = (reducedData.ok / reducedData.count) * 100;

  if (isNaN(uptime)) return "";

  return `${uptime.toFixed(2)}% uptime`;
}

export function isInBlacklist(timestamp: number) {
  const el = Object.keys(blacklistDates).find((date) =>
    areDatesEqualByDayMonthYear(new Date(date), new Date(timestamp)),
  );
  return el ? blacklistDates[el] : undefined;
}

/**
 * Calculate the overall status of a page based on all the monitor data
 */
export function calcStatus(data: Ping[][]) {
  const { count, ok } = data.flat(1).reduce(
    (prev, curr) => {
      if (!curr.statusCode) return prev; // TODO: handle this better
      const isOk = curr.statusCode <= 299 && curr.statusCode >= 200;
      return { count: prev.count + 1, ok: prev.ok + (isOk ? 1 : 0) };
    },
    { count: 0, ok: 0 },
  );
  const ratio = ok / count;
  if (isNaN(ratio)) return getStatus(1); // outsmart caching issue
  return getStatus(ratio);
}

/**
 * Blacklist dates where we had issues with data collection
 */
export const blacklistDates: Record<string, string> = {
  "Fri Aug 25 2023":
    "OpenStatus faced issues between 24.08. and 27.08., preventing data collection.",
  "Sat Aug 26 2023":
    "OpenStatus faced issues between 24.08. and 27.08., preventing data collection.",
  "Wed Oct 18 2023":
    "OpenStatus migrated from Vercel to Fly to improve the performance of the checker.",
};

export const isOnGoingIncidents = (
  incidents: z.infer<typeof selectIncidentPageSchema>,
) => {
  return incidents.some((incident) => incident.resolvedAt === null);
};
