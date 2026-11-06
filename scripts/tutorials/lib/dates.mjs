// A day at least `minDays` out whose number appears once in a month grid:
// the 8th–21st are never shown again as another month's leading or
// trailing days, so a date picker cell can be found by its number alone.
export function pickableDay(from = new Date(), minDays = 2) {
  const d = new Date(from);
  d.setDate(d.getDate() + minDays);
  while (d.getDate() < 8 || d.getDate() > 21) d.setDate(d.getDate() + 1);
  return d;
}

// "Go to next month" clicks from `from`'s month to `to`'s.
export const monthsAhead = (from, to) =>
  (to.getFullYear() - from.getFullYear()) * 12 +
  to.getMonth() -
  from.getMonth();
