import { z } from "zod";

// Define arrays as source of truth
export const API_CONFIG_TYPES = [
  "atlassian",
  "instatus",
  "betterstack",
  "incidentio",
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

// Derive TypeScript types from arrays
export type ApiConfigType = (typeof API_CONFIG_TYPES)[number];
export type StatusPageProvider = (typeof STATUS_PAGE_PROVIDERS)[number];
export type Industry = (typeof INDUSTRIES)[number];

// Derive Zod schemas from arrays
export const apiConfigSchema = z.object({
  type: z.enum(API_CONFIG_TYPES),
  endpoint: z.string().url().optional(),
  parser: z.string().optional(),
});

export const statusPageProviderSchema = z.enum(STATUS_PAGE_PROVIDERS);
export const industrySchema = z.enum(INDUSTRIES);

// Interfaces using derived types
export interface ApiConfig {
  type: ApiConfigType;
  endpoint?: string;
  parser?: string;
}

export interface StatusPageEntry {
  id: string;
  name: string;
  url: string;
  status_page_url: string;
  provider: StatusPageProvider;
  industry: Industry[];
  description?: string;
  api_config?: ApiConfig;
}

export const statusPageEntrySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  url: z.string().url(),
  status_page_url: z.string().url(),
  provider: statusPageProviderSchema,
  industry: z.array(industrySchema).min(1),
  description: z.string().optional(),
  api_config: apiConfigSchema.optional(),
});

export const SEVERITY_LEVELS = ["none", "minor", "major", "critical"] as const;
export type SeverityLevel = (typeof SEVERITY_LEVELS)[number];

export const STATUS_TYPES = [
  "operational",
  "degraded",
  "partial_outage",
  "major_outage",
  "under_maintenance",
  "investigating",
  "identified",
  "monitoring",
  "resolved",
] as const;
export type StatusType = (typeof STATUS_TYPES)[number];

export interface StatusResult {
  severity: SeverityLevel; // Impact level: none, minor, major, critical
  status: StatusType; // Normalized status type
  description: string; // Human-readable status message
  updated_at: number; // ms since epoch
  timezone?: string;
}

export interface StatusFetcher {
  name: string;
  canHandle(entry: StatusPageEntry): boolean;
  fetch(entry: StatusPageEntry): Promise<StatusResult>;
}
