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

export function cleanData({ data, last }: { data: Monitor[]; last: number }) {
  const today = new Date();

  const currentDay = new Date(today);
  currentDay.setUTCDate(today.getDate());
  currentDay.setUTCHours(0, 0, 0, 0);

  const lastDay = new Date(today);
  lastDay.setUTCDate(today.getDate() - last);
  lastDay.setUTCHours(0, 0, 0, 0);

  const dateSequence = generateDateSequence(lastDay, currentDay);

  const filledData = fillEmptyData(data, dateSequence);

  const uptime = getTotalUptimeString(filledData);

  return { bars: filledData, uptime }; // possibly only return filledData?
}

function fillEmptyData(data: Monitor[], dateSequence: Date[]) {
  const filledData: Monitor[] = [];
  let dataIndex = 0;

  for (const date of dateSequence) {
    const timestamp = date.getTime();
    const cronTimestamp =
      dataIndex < data.length ? data[dataIndex].cronTimestamp : undefined;
    if (
      cronTimestamp &&
      areDatesEqualByDayMonthYear(new Date(cronTimestamp), date)
    ) {
      const isBlacklisted = isInBlacklist(cronTimestamp);

      /**
       * automatically remove the data from the array to avoid wrong uptime
       * that provides time to remove cursed logs from tinybird via mv migration
       */
      if (isBlacklisted) {
        filledData.push(emptyData(timestamp));
      } else {
        filledData.push(data[dataIndex]);
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
 * equal UTC days - fixes issue with daylight saving
 * @param date1
 * @param date2
 * @returns
 */
function areDatesEqualByDayMonthYear(date1: Date, date2: Date) {
  date1.setUTCDate(date1.getDate());
  date1.setUTCHours(0, 0, 0, 0);

  date2.setUTCDate(date2.getDate());
  date2.setUTCHours(0, 0, 0, 0);

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
    currentDate.setUTCDate(currentDate.getDate() + 1);
  }

  return dateSequence.reverse();
}

export function getTotalUptime(data: Monitor[]) {
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

export function getTotalUptimeString(data: Monitor[]) {
  const reducedData = getTotalUptime(data);
  const uptime =
    reducedData.count !== 0
      ? ((reducedData.ok / reducedData.count) * 100).toFixed(2)
      : "";

  return uptime;
}

export function isInBlacklist(timestamp: number) {
  return Object.keys(blacklistDates).includes(timestamp.toString());
}

/**
 * Blacklist dates where we had issues with data collection
 */
export const blacklistDates: Record<number, string> = {
  1692921600000:
    "OpenStatus faced issues between 24.08. and 27.08., preventing data collection.",
  1693008000000:
    "OpenStatus faced issues between 24.08. and 27.08., preventing data collection.",
  1697587200000:
    "OpenStatus migrated from Vercel to Fly to improve the performance of the checker.",
};
