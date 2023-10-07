import { endOfDay, startOfDay, subDays, subHours, subMonths } from "date-fns";

export const periods = ["hour", "day", "3d", "7d", "30d"] as const;

export type Period = (typeof periods)[number];

export function getPeriodDate(period: Period) {
  if (period === "hour")
    return { from: subHours(new Date(), 1), to: new Date() };
  if (period === "day")
    return { from: startOfDay(new Date()), to: endOfDay(new Date()) };
  if (period === "3d")
    return {
      from: subDays(startOfDay(new Date()), 3),
      to: endOfDay(new Date()),
    };
  if (period === "7d")
    return {
      from: subDays(startOfDay(new Date()), 7),
      to: endOfDay(new Date()),
    };
  if (period === "30d")
    return {
      from: subMonths(startOfDay(new Date()), 1),
      to: endOfDay(new Date()),
    };
  // default to today
  return { from: startOfDay(new Date()), to: endOfDay(new Date()) };
}
