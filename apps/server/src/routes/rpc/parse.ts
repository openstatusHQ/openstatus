import type { ConnectError } from "@connectrpc/connect";

// Match the digits explicitly: `Number("")` is 0, `Number("1e3")` is 1000 and
// `Number("0x10")` is 16 — each would silently target another row.
const DECIMAL_ID = /^\d+$/;

/** A decimal id string, or `onInvalid`'s error. */
export function parseId(value: string, onInvalid: () => ConnectError): number {
  const trimmed = value.trim();
  // past 2^53 the digits round to a neighbouring id
  const id = Number(trimmed);
  if (!DECIMAL_ID.test(trimmed) || !Number.isSafeInteger(id)) {
    throw onInvalid();
  }
  return id;
}

const RFC_3339 =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(?:Z|[+-](\d{2}):(\d{2}))$/i;

/**
 * An RFC 3339 timestamp, or `onInvalid`'s error. `new Date` rolls impossible
 * calendar values over (Feb 31 becomes Mar 2), so each component is checked.
 */
export function parseDate(value: string, onInvalid: () => ConnectError): Date {
  const match = RFC_3339.exec(value);
  const date = new Date(value);
  if (!match || Number.isNaN(date.getTime())) throw onInvalid();
  // a missing (Z) offset reads as 0
  const [year, month, day, hour, minute, second, offsetH, offsetM] = match
    .slice(1)
    .map((part) => Number(part ?? 0)) as [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  const calendar = new Date(0);
  calendar.setUTCFullYear(year, month - 1, day);
  if (
    calendar.getUTCFullYear() !== year ||
    calendar.getUTCMonth() !== month - 1 ||
    calendar.getUTCDate() !== day ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    offsetH > 23 ||
    offsetM > 59
  ) {
    throw onInvalid();
  }
  return date;
}
