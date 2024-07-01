export function endOfDay(date: Date): Date {
  // Create a new Date object to avoid mutating the original date
  // const newDate = new Date(date);
  const newDate = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );

  // Set hours, minutes, seconds, and milliseconds to end of day
  newDate.setUTCHours(23, 59, 59, 999);

  return newDate;
}

export function startOfDay(date: Date): Date {
  // Create a new Date object to avoid mutating the original date
  // const newDate = new Date(date);
  const newDate = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );

  // Set hours, minutes, seconds, and milliseconds to start of day
  newDate.setUTCHours(0, 0, 0, 0);

  return newDate;
}

export function isSameDay(date1: Date, date2: Date) {
  const newDate1 = startOfDay(date1);
  const newDate2 = startOfDay(date2);

  return newDate1.toUTCString() === newDate2.toUTCString();
}
