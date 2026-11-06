import { timeZoneShortName } from "@openstatus/utils";

// "PST" and "PDT" both name America/Los_Angeles, but only one of them is in
// effect today, so look the short names up in January and in July.
export function timeZoneSearchKeywords(timeZone: string, now = new Date()) {
  const year = now.getUTCFullYear();
  return [
    ...new Set(
      [Date.UTC(year, 0, 1), Date.UTC(year, 6, 1)].map((at) =>
        timeZoneShortName(timeZone, "en-US", new Date(at)),
      ),
    ),
  ];
}

const normalize = (text: string) =>
  text.trim().toLowerCase().replace(/\s+/g, "_");

/**
 * cmdk `filter` for the time zone picker. cmdk's default scoring is fuzzy, so
 * "PST" matched Pacific/Easter first; this one ranks exact short names, then
 * cities, then the rest, and hides zones whose letters only appear scattered.
 */
export function timeZoneSearchScore(
  value: string,
  search: string,
  keywords: string[] = [],
) {
  const query = normalize(search);
  if (!query) return 1;

  const zone = normalize(value);
  const segments = zone.split("/");
  const city = segments[segments.length - 1] ?? zone;
  const shortNames = keywords.map(normalize);

  if (shortNames.includes(query)) return 1;
  if (city.startsWith(query)) return 0.9;
  if (zone.startsWith(query)) return 0.8;
  if (segments.some((segment) => segment.startsWith(query))) return 0.7;
  if (zone.includes(query)) return 0.5;
  if (shortNames.some((name) => name.startsWith(query))) return 0.4;
  return 0;
}
