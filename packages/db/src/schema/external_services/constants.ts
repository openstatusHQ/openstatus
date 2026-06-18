import { z } from "zod";

export const API_CONFIG_TYPES = [
  "atlassian",
  "instatus",
  "betterstack",
  "incidentio",
  "uptimerobot",
  "custom",
  "html-scraper",
] as const;

export const STATUS_PAGE_PROVIDERS = [
  "atlassian-statuspage",
  "instatus",
  "openstatus",
  "incidentio",
  "status.io",
  "custom",
  "better-uptime",
  "uptime-robot",
  "unknown",
] as const;

export const INDUSTRIES = [
  "cloud-providers",
  "development-tools",
  "saas",
  "communication",
  "ai-ml",
  "cdn",
  "databases",
  "monitoring",
  "security",
  "fintech",
  "e-commerce",
] as const;

export type ApiConfigType = (typeof API_CONFIG_TYPES)[number];
export type StatusPageProvider = (typeof STATUS_PAGE_PROVIDERS)[number];
export type Industry = (typeof INDUSTRIES)[number];

export const apiConfigSchema = z.object({
  type: z.enum(API_CONFIG_TYPES),
  endpoint: z.url().optional(),
  parser: z.string().optional(),
});

export type ApiConfig = z.infer<typeof apiConfigSchema>;

const INDICATOR_SEVERITY: Record<string, number> = {
  none: 0,
  minor: 1,
  major: 2,
  critical: 3,
};

export function externalIndicatorSeverity(indicator: string): number {
  return INDICATOR_SEVERITY[indicator] ?? -1;
}

export function worstExternalIndicator(indicators: Iterable<string>): string {
  let worst = "";
  for (const indicator of indicators) {
    if (
      worst === "" ||
      externalIndicatorSeverity(indicator) > externalIndicatorSeverity(worst)
    ) {
      worst = indicator;
    }
  }
  return worst;
}

export type ExternalStatusType =
  | "success"
  | "degraded"
  | "error"
  | "info"
  | "empty";

export function externalIndicatorToStatus(
  indicator: string,
  hadMaintenance = false,
): ExternalStatusType {
  let base: ExternalStatusType;
  switch (indicator) {
    case "none":
      base = "success";
      break;
    case "minor":
      base = "degraded";
      break;
    case "major":
    case "critical":
      base = "error";
      break;
    default:
      base = "empty";
  }
  if (hadMaintenance && (base === "success" || base === "empty")) return "info";
  return base;
}
