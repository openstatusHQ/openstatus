import { z } from "zod";

export const OpsGenieSchema = z.object({
  opsgenie: z.object({
    apiKey: z.string(),
    region: z.enum(["eu", "us"]),
  }),
});

export const OpsGeniePayloadAlert = z.object({
  message: z.string(),
  alias: z.string(),
  description: z.string(),
  source: z.string().default("OpenStatus"),
  details: z
    .object({
      message: z.string(),
      status: z.number().optional(),
      severity: z.enum(["degraded", "down"]),
    })
    .optional(),
});

export const OpsGenieCloseAlert = z.object({
  source: z.string().default("OpenStatus"),
});
