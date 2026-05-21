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
