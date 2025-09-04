export function fillStatusDataFor45Days(
  data: Array<{
    day: string;
    count: number;
    ok: number;
    degraded: number;
    error: number;
    monitorId: string;
  }>,
  monitorId: string,
): Array<{
  day: string;
  count: number;
  ok: number;
  degraded: number;
  error: number;
  monitorId: string;
}> {
  const result = [];
  const dataByDay = new Map();

  // Index existing data by day
  data.forEach((item) => {
    const dayKey = new Date(item.day).toISOString().split("T")[0]; // YYYY-MM-DD format
    dataByDay.set(dayKey, item);
  });

  // Generate all 45 days from today backwards
  const now = new Date();
  for (let i = 0; i < 45; i++) {
    const date = new Date(now);
    date.setUTCDate(date.getUTCDate() - i);
    date.setUTCHours(0, 0, 0, 0); // Set to start of day in UTC

    const dayKey = date.toISOString().split("T")[0]; // YYYY-MM-DD format
    const isoString = date.toISOString();

    if (dataByDay.has(dayKey)) {
      // Use existing data but ensure the day is properly formatted
      const existingData = dataByDay.get(dayKey);
      result.push({
        ...existingData,
        day: isoString,
      });
    } else {
      // Fill missing day with default values
      result.push({
        day: isoString,
        count: 0,
        ok: 0,
        degraded: 0,
        error: 0,
        monitorId,
      });
    }
  }

  // Sort by day (oldest first)
  return result.sort(
    (a, b) => new Date(a.day).getTime() - new Date(b.day).getTime(),
  );
}
