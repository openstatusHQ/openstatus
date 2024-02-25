import { isSameDay } from "./utils";

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

export function isInBlacklist(day: Date) {
  const el = Object.keys(blacklistDates).find((date) =>
    isSameDay(new Date(date), day),
  );
  return el ? blacklistDates[el] : undefined;
}
