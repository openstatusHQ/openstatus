import { z } from "zod";

export const flyRegions = [
  "ams",
  "arn",
  "atl",
  "bog",
  "bom",
  "bos",
  "cdg",
  "den",
  "dfw",
  "ewr",
  "eze",
  "fra",
  "gdl",
  "gig",
  "gru",
  "hkg",
  "iad",
  "jnb",
  "lax",
  "lhr",
  "mad",
  "mia",
  "nrt",
  "ord",
  "otp",
  "phx",
  "qro",
  "scl",
  "sjc",
  "sea",
  "sin",
  "syd",
  "waw",
  "yul",
  "yyz",
] as const;

export const monitorPeriodicity = [
  "30s",
  "1m",
  "5m",
  "10m",
  "30m",
  "1h",
  "other",
] as const;

export const monitorRegions = [...flyRegions] as const;
export const monitorPeriodicitySchema = z.enum(monitorPeriodicity);
export const monitorRegionSchema = z.enum(monitorRegions);
export const monitorFlyRegionSchema = z.enum(flyRegions);

export type MonitorFlyRegion = z.infer<typeof monitorFlyRegionSchema>;
export type Region = z.infer<typeof monitorFlyRegionSchema>;
