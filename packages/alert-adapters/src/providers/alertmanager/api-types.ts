import { z } from "zod";

export const AlertmanagerAlertSchema = z.object({
  status: z.string(),
  labels: z.record(z.string(), z.string()).default({}),
  annotations: z.record(z.string(), z.string()).default({}),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
  generatorURL: z.string().optional(),
  fingerprint: z.string().optional(),
});
export type AlertmanagerAlert = z.infer<typeof AlertmanagerAlertSchema>;

export const AlertmanagerPayloadSchema = z.object({
  version: z.string().optional(),
  groupKey: z.string().optional(),
  truncatedAlerts: z.number().optional(),
  status: z.string(),
  receiver: z.string().optional(),
  groupLabels: z.record(z.string(), z.string()).default({}),
  commonLabels: z.record(z.string(), z.string()).default({}),
  commonAnnotations: z.record(z.string(), z.string()).default({}),
  externalURL: z.string().optional(),
  alerts: z.array(AlertmanagerAlertSchema).default([]),
});
export type AlertmanagerPayload = z.infer<typeof AlertmanagerPayloadSchema>;
