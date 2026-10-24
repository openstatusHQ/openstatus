/**
 * Short zone name as Intl renders it ("UTC", "JST", "GMT+9", "EST") for the
 * given instant: zones with daylight saving time change name through the year.
 */
export function timeZoneShortName(
  timeZone: string,
  locale = "en-US",
  at = new Date(),
) {
  if (timeZone === "UTC") return "UTC";
  return (
    new Intl.DateTimeFormat(locale, { timeZone, timeZoneName: "short" })
      .formatToParts(at)
      .find((part) => part.type === "timeZoneName")?.value ?? timeZone
  );
}

/** "EST" for a span in one offset, "EST/EDT" for one that crosses a DST change. */
export function timeZoneShortNames(
  timeZone: string,
  locale: string,
  instants: Date[],
) {
  return [
    ...new Set(instants.map((at) => timeZoneShortName(timeZone, locale, at))),
  ].join("/");
}
