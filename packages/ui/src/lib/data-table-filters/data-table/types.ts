import { z } from "zod";

export const facetMetadataSchema = z.object({
  rows: z.array(z.object({ value: z.any(), total: z.number() })),
  total: z.number(),
  min: z.number().optional(),
  max: z.number().optional(),
});

export type FacetMetadataSchema = z.infer<typeof facetMetadataSchema>;

export type BaseChartSchema = { timestamp: number; [key: string]: number };
