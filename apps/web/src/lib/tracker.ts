import type { Monitor } from "@openstatus/tinybird";

/**
 *
 * @param ratio
 * @returns
 */
export const getStatus = (
  ratio: number,
): { label: string; variant: "up" | "degraded" | "down" | "empty" } => {
  if (isNaN(ratio)) return { label: "Missing", variant: "empty" };
  if (ratio >= 0.98) return { label: "Operational", variant: "up" };
  if (ratio >= 0.5) return { label: "Degraded", variant: "degraded" };
  return { label: "Downtime", variant: "down" };
};

export function getMonitorList(
  data: Monitor[],
  { maxSize, context }: { maxSize: number; context?: string },
) {
  const slicedData = data.slice(0, maxSize).reverse();
  const placeholderData: null[] = Array(maxSize).fill(null);

  const filledData: Monitor[] =
    context === "play" ? slicedData : fillMissingDates(slicedData);

  const reducedData = slicedData.reduce(
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

  const uptime =
    reducedData.count !== 0
      ? ((reducedData.ok / reducedData.count) * 100).toFixed(2)
      : "";

  return {
    monitors: filledData,
    placeholder: placeholderData,
    uptime,
  };
}

// TODO: is there a way to do it with `date-fns`?
// Function to fill missing dates in the data array
export function fillMissingDates(data: Monitor[]) {
  if (data.length === 0) {
    return [];
  }

  const startDate = new Date(data[0].cronTimestamp);
  const endDate = new Date(data[data.length - 1].cronTimestamp);
  const dateSequence = generateDateSequence(startDate, endDate);

  const filledData: Monitor[] = [];
  let dataIndex = 0;

  for (const currentDate of dateSequence) {
    const currentTimestamp = currentDate.getTime();
    if (
      dataIndex < data.length &&
      data[dataIndex].cronTimestamp === currentTimestamp
    ) {
      filledData.push(data[dataIndex]);
      dataIndex++;
    } else {
      filledData.push({
        count: 0,
        ok: 0,
        avgLatency: 0,
        cronTimestamp: currentTimestamp,
      });
    }
  }

  return filledData;
}

// Function to generate a sequence of dates between two dates
export function generateDateSequence(startDate: Date, endDate: Date) {
  const dateSequence = [];
  const currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    dateSequence.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return dateSequence;
}

// We had issues during those dates!
export const blacklistDates: Record<number, string> = {
  1692921600000:
    "OpenStatus faced issues between 24.08. and 27.08., preventing data collection.",
  1693008000000:
    "OpenStatus faced issues between 24.08. and 27.08., preventing data collection.",
};
