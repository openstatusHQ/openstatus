import { z } from "zod";

export const importProviders = [
  "statuspage",
  "betterstack",
  "instatus",
] as const;
export type ImportProviderName = (typeof importProviders)[number];

/**
 * `nullish().transform(v => v ?? undefined)` preserves the legacy
 * router contract (which accepted `null` for every provider page-id
 * field via `.nullish()`) while normalising the value to `undefined`
 * inside the service — downstream `buildProviderConfig` expects
 * `string | undefined` and doesn't want to learn about `null`.
 * Switching these to plain `.optional()` would've silently rejected
 * every client still sending `null`.
 */
const nullishString = z
  .string()
  .nullish()
  .transform((v) => v ?? undefined);

const providerFields = {
  provider: z.enum(importProviders),
  apiKey: z.string().min(1),
  statuspagePageId: nullishString,
  betterstackStatusPageId: nullishString,
  instatusPageId: nullishString,
};

export const ImportOptions = z.object({
  includeStatusReports: z.boolean().default(true),
  includeSubscribers: z.boolean().default(false),
  includeComponents: z.boolean().default(true),
  includeMonitors: z.boolean().default(true),
});
export type ImportOptions = z.infer<typeof ImportOptions>;

export const PreviewImportInput = z.object({
  ...providerFields,
  /**
   * Target an existing status page — when provided the preview is scoped
   * against that page's current component count so the remaining-capacity
   * warnings line up with what `run` will actually do.
   */
  pageId: z.number().int().optional(),
  /**
   * Optional same-shape `options` as `RunImportInput`. Exposed on preview
   * so warning generation can match what the actual run would do — e.g.
   * a user planning `includeSubscribers: false` shouldn't see a
   * "subscribers cannot be imported" warning here.
   */
  options: ImportOptions.partial().optional(),
});
export type PreviewImportInput = z.infer<typeof PreviewImportInput>;

export const RunImportInput = z.object({
  ...providerFields,
  pageId: z.number().int().optional(),
  options: ImportOptions.partial().optional(),
});
export type RunImportInput = z.infer<typeof RunImportInput>;
