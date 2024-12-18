import { format, getTimezoneOffset, utcToZonedTime } from "date-fns-tz";
import { headers } from "next/headers";

export async function getRequestHeaderTimezone() {
  const headersList = await headers();

  /**
   * Vercel includes ip timezone to request header
   */
  const requestTimezone = headersList.get("x-vercel-ip-timezone");

  return requestTimezone;
}

export async function convertTimezoneToGMT(defaultTimezone?: string) {
  const requestTimezone = await getRequestHeaderTimezone();

  /**
   * Server region timezone as fallback
   */
  const clientTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const timezone = defaultTimezone || requestTimezone || clientTimezone;

  if (!supportedTimezones.includes(timezone)) return "Etc/UTC";

  const msOffset = getTimezoneOffset(timezone);

  if (Number.isNaN(msOffset)) return "Etc/UTC";

  const hrOffset = Math.round(msOffset / (1000 * 60 * 60)); // avoid weird 30min timezones
  const offset = hrOffset >= 0 ? `-${hrOffset}` : `+${Math.abs(hrOffset)}`;

  return `Etc/GMT${offset}` as const;
}

export function getServerTimezoneUTCFormat() {
  const now = new Date();
  const now_utc = new Date(now.toUTCString().slice(0, -4)); // remove the GMT end

  return format(now_utc, "LLL dd, y HH:mm:ss (z)", { timeZone: "UTC" });
}

export function getServerTimezoneFormat() {
  return format(new Date(), "LLL dd, y HH:mm:ss (z)");
}

export function formatDate(date: Date) {
  return format(date, "LLL dd, y", { timeZone: "UTC" });
}

export function formatDateTime(date: Date) {
  return format(date, "LLL dd, y HH:mm:ss zzz", { timeZone: "UTC" });
}

export function formatTime(date: Date) {
  return format(date, "HH:mm:ss zzz", { timeZone: "UTC" });
}

/**
 * All supported browser / node timezones
 */
export const supportedTimezones = Intl.supportedValuesOf("timeZone");

export async function getClosestTimezone(defaultTimezone?: string) {
  const requestTimezone = await getRequestHeaderTimezone();

  /**
   * Server region timezone as fallback
   */
  const clientTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const timezone = defaultTimezone || requestTimezone || clientTimezone;

  if (!supportedTimezones.includes(timezone)) return "CET";

  const now = new Date();

  const estTime = utcToZonedTime(now, "America/New_York");
  const pstTime = utcToZonedTime(now, "America/Los_Angeles");
  const cetTime = utcToZonedTime(now, "Europe/Paris");
  const utcTime = utcToZonedTime(now, "UTC");

  const timeDifferences = {
    EST: Math.abs(now.getTime() - estTime.getTime()),
    PST: Math.abs(now.getTime() - pstTime.getTime()),
    CET: Math.abs(now.getTime() - cetTime.getTime()),
    UTC: Math.abs(now.getTime() - utcTime.getTime()),
  };

  const closestTimezone = Object.keys(timeDifferences).reduce(
    (prev, curr) => {
      if (
        timeDifferences[curr as keyof typeof timeDifferences] <
        prev.minDifference
      ) {
        return {
          timezone: curr,
          minDifference: timeDifferences[curr as keyof typeof timeDifferences],
        };
      }
      return prev;
    },
    { timezone: "UTC", minDifference: Number.POSITIVE_INFINITY },
  );

  return closestTimezone.timezone as keyof typeof timeDifferences;
}
