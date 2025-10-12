import {
  ALL_REGIONS,
  AVAILABLE_REGIONS,
  FLY_REGIONS,
  FREE_FLY_REGIONS,
} from "@openstatus/regions";
import { z } from "zod";

export const monitorPeriodicity = [
  "30s",
  "1m",
  "5m",
  "10m",
  "30m",
  "1h",
  "other",
] as const;

export const availableRegions = AVAILABLE_REGIONS;
export const monitorRegions = ALL_REGIONS;
export const freeFlyRegions = FREE_FLY_REGIONS;
export const flyRegions = FLY_REGIONS;
export const monitorPeriodicitySchema = z.enum(monitorPeriodicity);
export const monitorRegionSchema = z.enum(ALL_REGIONS);
export const monitorFlyRegionSchema = z.enum(FLY_REGIONS);

export type MonitorFlyRegion = z.infer<typeof monitorFlyRegionSchema>;
export type Region = z.infer<typeof monitorRegionSchema>;
