import { Region } from "@openstatus/proto/monitor/v1";
import { AVAILABLE_REGIONS } from "@openstatus/regions";

/**
 * Mapping from database region strings to proto Region enum.
 */
const DB_TO_REGION: Record<string, Region> = {
  // Fly.io regions
  ams: Region.FLY_AMS,
  arn: Region.FLY_ARN,
  bom: Region.FLY_BOM,
  cdg: Region.FLY_CDG,
  dfw: Region.FLY_DFW,
  ewr: Region.FLY_EWR,
  fra: Region.FLY_FRA,
  gru: Region.FLY_GRU,
  iad: Region.FLY_IAD,
  jnb: Region.FLY_JNB,
  lax: Region.FLY_LAX,
  lhr: Region.FLY_LHR,
  nrt: Region.FLY_NRT,
  ord: Region.FLY_ORD,
  sjc: Region.FLY_SJC,
  sin: Region.FLY_SIN,
  syd: Region.FLY_SYD,
  yyz: Region.FLY_YYZ,
  // Koyeb regions
  koyeb_fra: Region.KOYEB_FRA,
  koyeb_par: Region.KOYEB_PAR,
  koyeb_sfo: Region.KOYEB_SFO,
  koyeb_sin: Region.KOYEB_SIN,
  koyeb_tyo: Region.KOYEB_TYO,
  koyeb_was: Region.KOYEB_WAS,
  // Railway regions
  "railway_us-west2": Region.RAILWAY_US_WEST2,
  "railway_us-east4": Region.RAILWAY_US_EAST4,
  "railway_europe-west4": Region.RAILWAY_EUROPE_WEST4,
  "railway_asia-southeast1": Region.RAILWAY_ASIA_SOUTHEAST1,
};

/**
 * Mapping from proto Region enum to database strings.
 */
const REGION_TO_DB: Record<Region, string> = {
  // Fly.io regions
  [Region.FLY_AMS]: "ams",
  [Region.FLY_ARN]: "arn",
  [Region.FLY_BOM]: "bom",
  [Region.FLY_CDG]: "cdg",
  [Region.FLY_DFW]: "dfw",
  [Region.FLY_EWR]: "ewr",
  [Region.FLY_FRA]: "fra",
  [Region.FLY_GRU]: "gru",
  [Region.FLY_IAD]: "iad",
  [Region.FLY_JNB]: "jnb",
  [Region.FLY_LAX]: "lax",
  [Region.FLY_LHR]: "lhr",
  [Region.FLY_NRT]: "nrt",
  [Region.FLY_ORD]: "ord",
  [Region.FLY_SJC]: "sjc",
  [Region.FLY_SIN]: "sin",
  [Region.FLY_SYD]: "syd",
  [Region.FLY_YYZ]: "yyz",
  // Koyeb regions
  [Region.KOYEB_FRA]: "koyeb_fra",
  [Region.KOYEB_PAR]: "koyeb_par",
  [Region.KOYEB_SFO]: "koyeb_sfo",
  [Region.KOYEB_SIN]: "koyeb_sin",
  [Region.KOYEB_TYO]: "koyeb_tyo",
  [Region.KOYEB_WAS]: "koyeb_was",
  // Railway regions
  [Region.RAILWAY_US_WEST2]: "railway_us-west2",
  [Region.RAILWAY_US_EAST4]: "railway_us-east4",
  [Region.RAILWAY_EUROPE_WEST4]: "railway_europe-west4",
  [Region.RAILWAY_ASIA_SOUTHEAST1]: "railway_asia-southeast1",
  // Unspecified
  [Region.UNSPECIFIED]: "",
};

/**
 * Convert database region string to proto Region enum.
 */
export function stringToRegion(value: string): Region {
  return DB_TO_REGION[value.toLowerCase()] ?? Region.UNSPECIFIED;
}

/**
 * Convert proto Region enum to database string.
 */
export function regionToString(value: Region): string {
  return REGION_TO_DB[value] ?? "";
}

/**
 * Convert database regions array to proto Region enum array.
 */
export function stringsToRegions(values: string[]): Region[] {
  return values.map(stringToRegion).filter((r) => r !== Region.UNSPECIFIED);
}

/**
 * Convert proto Region enum array to database strings.
 */
export function regionsToStrings(values: Region[]): string[] {
  return values.map(regionToString).filter((r) => r !== "");
}

/**
 * Convert regions array to database string format (comma-separated).
 */
export function regionsToDbString(regions: string[]): string {
  return regions.join(",");
}

/**
 * Validate that all regions are valid available regions.
 * Returns an array of invalid region codes, or empty array if all valid.
 */
export function validateRegions(regions: string[]): string[] {
  const availableSet = new Set(AVAILABLE_REGIONS);
  return regions.filter(
    (r) => !availableSet.has(r as (typeof AVAILABLE_REGIONS)[number]),
  );
}
