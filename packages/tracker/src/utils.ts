export function endOfDay(date: Date): Date {
  // Create a new Date object to avoid mutating the original date
  const newDate = new Date(date);

  // Set hours, minutes, seconds, and milliseconds to end of day
  newDate.setHours(23, 59, 59, 999);

  return newDate;
}

export function startOfDay(date: Date): Date {
  // Create a new Date object to avoid mutating the original date
  const newDate = new Date(date);

  // Set hours, minutes, seconds, and milliseconds to start of day
  newDate.setHours(0, 0, 0, 0);

  return newDate;
}

export function isSameDay(date1: Date, date2: Date) {
  const newDate1 = new Date(date1);
  const newDate2 = new Date(date2);

  newDate1.setDate(newDate1.getDate());
  newDate1.setHours(0, 0, 0, 0);

  newDate2.setDate(newDate2.getDate());
  newDate2.setHours(0, 0, 0, 0);

  return newDate1.toUTCString() === newDate2.toUTCString();
}
