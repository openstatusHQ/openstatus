import { z } from "zod";

export const importProviders = [
  "statuspage",
  "betterstack",
  "instatus",
] as const;
export type ImportProviderName = (typeof importProviders)[number];

const providerFields = {
  provider: z.enum(importProviders),
  apiKey: z.string().min(1),
  statuspagePageId: z.string().optional(),
  betterstackStatusPageId: z.string().optional(),
  instatusPageId: z.string().optional(),
};

export const PreviewImportInput = z.object({
  ...providerFields,
  /**
   * Target an existing status page — when provided the preview is scoped
   * against that page's current component count so the remaining-capacity
   * warnings line up with what `run` will actually do.
   */
  pageId: z.number().int().optional(),
});
export type PreviewImportInput = z.infer<typeof PreviewImportInput>;

export const ImportOptions = z.object({
  includeStatusReports: z.boolean().default(true),
  includeSubscribers: z.boolean().default(false),
  includeComponents: z.boolean().default(true),
  includeMonitors: z.boolean().default(true),
});
export type ImportOptions = z.infer<typeof ImportOptions>;

export const RunImportInput = z.object({
  ...providerFields,
  pageId: z.number().int().optional(),
  options: ImportOptions.partial().optional(),
});
export type RunImportInput = z.infer<typeof RunImportInput>;
