// First-touch attribution shared by the marketing site (writer) and the
// dashboard (reader). Lives on `.openstatus.dev` so a visit to www can be
// joined to the `user_created` event the dashboard emits later.

export const ATTRIBUTION_COOKIE = "os_attr";
export const ATTRIBUTION_MAX_AGE = 30 * 24 * 60 * 60;
export const ATTRIBUTION_DOMAIN = ".openstatus.dev";

// `landing_referrer`, not `referrer`: openpanel already has a `referrer`
// column on every event and a same-named property would be ambiguous.
const KEYS = [
  "landing_path",
  "landing_referrer",
  "ref",
  "utm_source",
  "utm_medium",
  "utm_campaign",
] as const;

export type Attribution = Partial<Record<(typeof KEYS)[number], string>>;

const MAX_VALUE_LENGTH = 200;

export function sanitizeAttribution(input: unknown): Attribution {
  if (!input || typeof input !== "object") return {};
  const out: Attribution = {};
  for (const key of KEYS) {
    const value = (input as Record<string, unknown>)[key];
    if (typeof value === "string" && value.length > 0) {
      out[key] = value.slice(0, MAX_VALUE_LENGTH);
    }
  }
  return out;
}

// Plain JSON. Next's cookie helpers URL-encode on set and decode on read;
// `document.cookie` does neither, so the web writer encodes it itself.
export function serializeAttribution(attribution: Attribution): string {
  return JSON.stringify(sanitizeAttribution(attribution));
}

export function parseAttribution(raw: string | undefined | null): Attribution {
  if (!raw) return {};
  for (const candidate of [raw, safeDecode(raw)]) {
    if (candidate === null) continue;
    try {
      return sanitizeAttribution(JSON.parse(candidate));
    } catch {
      // try the next form
    }
  }
  return {};
}

function safeDecode(value: string): string | null {
  try {
    const decoded = decodeURIComponent(value);
    return decoded === value ? null : decoded;
  } catch {
    return null;
  }
}

// For a raw `Cookie` header, where the value is still URL-encoded.
export function readAttributionCookie(
  cookieHeader: string | null | undefined,
): Attribution {
  if (!cookieHeader) return {};
  const prefix = `${ATTRIBUTION_COOKIE}=`;
  const pair = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));
  return parseAttribution(pair?.slice(prefix.length));
}
