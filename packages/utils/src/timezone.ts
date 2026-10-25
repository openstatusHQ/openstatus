/** Whether this runtime's Intl knows `timeZone`; browsers can lag behind Node. */
export function isKnownTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch (error) {
    if (error instanceof RangeError) return false;
    throw error;
  }
}

/** `timeZone` if this runtime can format in it, otherwise UTC. */
export function resolveTimeZone(timeZone: string): string {
  return isKnownTimeZone(timeZone) ? timeZone : "UTC";
}

// formatters are costly to build and labels ask for one per instant
const shortNameFormatters = new Map<string, Intl.DateTimeFormat>();

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
  const key = `${locale}|${timeZone}`;
  let formatter = shortNameFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, {
      timeZone,
      timeZoneName: "short",
    });
    shortNameFormatters.set(key, formatter);
  }
  return (
    formatter.formatToParts(at).find((part) => part.type === "timeZoneName")
      ?.value ?? timeZone
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
