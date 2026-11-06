import { timeZoneShortName } from "@openstatus/utils";

// en-US alone names Berlin "GMT+1", so also ask the locales that use the
// regional abbreviations people search for: CET/CEST, BST, EET and WET from
// en-GB, IST from en-IN, AEST/AEDT from en-AU.
const LOCALES = ["en-US", "en-GB", "en-IN", "en-AU"];

const cache = new Map<string, string[]>();

// "PST" and "PDT" both name America/Los_Angeles, but only one of them is in
// effect today, so look the short names up in January and in July. Cached:
// the picker asks for ~420 zones, and the first pass costs about 100 ms.
export function timeZoneSearchKeywords(timeZone: string, now = new Date()) {
  const year = now.getUTCFullYear();
  const key = `${year}|${timeZone}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const instants = [Date.UTC(year, 0, 1), Date.UTC(year, 6, 1)];
  const names = [
    ...new Set(
      LOCALES.flatMap((locale) =>
        instants.map((at) => timeZoneShortName(timeZone, locale, new Date(at))),
      ),
    ),
  ];
  cache.set(key, names);
  return names;
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
