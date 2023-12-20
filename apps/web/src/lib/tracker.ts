import type { Monitor } from "@openstatus/tinybird";

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

// FIXME: name TrackerMonitor

export type CleanMonitor = {
  count: number;
  ok: number;
  avgLatency: number;
  cronTimestamp: number;
  blacklist?: string;
};

/**
 * Clean the data to show only the last X days
 * @param data array of monitors
 * @param last number of days to show
 * @param timeZone timezone of the monitor
 * @returns
 */
export function cleanData(data: Monitor[], last: number, timeZone?: string) {
  const today = new Date(new Date().toLocaleString("en-US", { timeZone }));

  const currentDay = new Date(today);
  currentDay.setDate(today.getDate());
  currentDay.setHours(0, 0, 0, 0);

  const lastDay = new Date(today);
  lastDay.setDate(today.getDate() - last);
  lastDay.setHours(0, 0, 0, 0);

  const dateSequence = generateDateSequence(lastDay, currentDay);

  const filledData = fillEmptyData(data, dateSequence);

  const uptime = getTotalUptimeString(filledData);

  return { bars: filledData, uptime }; // possibly only return filledData?
}

function fillEmptyData(data: Monitor[], dateSequence: Date[]) {
  const filledData: CleanMonitor[] = [];
  let dataIndex = 0;

  for (const date of dateSequence) {
    const timestamp = date.getTime();
    const cronTimestamp =
      dataIndex < data.length
        ? new Date(data[dataIndex].day).getTime()
        : undefined;

    if (
      cronTimestamp &&
      areDatesEqualByDayMonthYear(date, new Date(cronTimestamp))
    ) {
      const blacklist = isInBlacklist(cronTimestamp);

      /**
       * automatically remove the data from the array to avoid wrong uptime
       * that provides time to remove cursed logs from tinybird via mv migration
       */
      if (blacklist) {
        filledData.push({
          ...emptyData(cronTimestamp),
          blacklist,
        });
      } else {
        const { day, ...props } = data[dataIndex];
        filledData.push({ ...props, cronTimestamp });
      }
      dataIndex++;
    } else {
      filledData.push(emptyData(timestamp));
    }
  }

  return filledData;
}

function emptyData(cronTimestamp: number) {
  return {
    count: 0,
    ok: 0,
    avgLatency: 0,
    cronTimestamp,
  };
}

/**
 * equal days - fixes issue with daylight saving
 * @param date1
 * @param date2
 * @returns
 */
function areDatesEqualByDayMonthYear(date1: Date, date2: Date) {
  date1.setDate(date1.getDate());
  date1.setHours(0, 0, 0, 0);

  date2.setDate(date2.getDate());
  date2.setHours(0, 0, 0, 0);

  return date1.toUTCString() === date2.toUTCString();
}

/**
 *
 * @param startDate
 * @param endDate
 * @returns
 */
export function generateDateSequence(startDate: Date, endDate: Date): Date[] {
  const dateSequence: Date[] = [];
  const currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    dateSequence.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return dateSequence.reverse();
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
