/**
 * @deprecated
 */
export const vercelRegions = [
  "arn1",
  "bom1",
  "cdg1",
  "cle1",
  "cpt1",
  "dub1",
  "fra1",
  "gru1",
  "hkg1",
  "hnd1",
  "iad1",
  "icn1",
  "kix1",
  "lhr1",
  "pdx1",
  "sfo1",
  "sin1",
  "syd1",
] as const;

export const flyRegions = ["ams", "iad", "hkg", "jnb", "syd", "gru"] as const;

export const monitorPeriodicity = [
  "30s",
  "1m",
  "5m",
  "10m",
  "30m",
  "1h",
  "other",
] as const;
export const monitorMethods = ["GET", "POST", "HEAD"] as const;
export const monitorStatus = ["active", "error"] as const;
export const monitorRegions = [
  ...flyRegions,
  ...vercelRegions,
  "auto",
] as const;

export const monitorJobTypes = ["website", "cron", "other"] as const;
