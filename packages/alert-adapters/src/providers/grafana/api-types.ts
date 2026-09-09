import { z } from "zod";

export const GrafanaAlertSchema = z.object({
  status: z.string(),
  labels: z.record(z.string(), z.string()).default({}),
  annotations: z.record(z.string(), z.string()).default({}),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
  generatorURL: z.string().optional(),
  fingerprint: z.string().optional(),
  silenceURL: z.string().optional(),
  dashboardURL: z.string().optional(),
  panelURL: z.string().optional(),
  valueString: z.string().optional(),
});
export type GrafanaAlert = z.infer<typeof GrafanaAlertSchema>;

export const GrafanaPayloadSchema = z.object({
  receiver: z.string().optional(),
  status: z.string(),
  orgId: z.number().optional(),
  alerts: z.array(GrafanaAlertSchema).default([]),
  groupLabels: z.record(z.string(), z.string()).default({}),
  commonLabels: z.record(z.string(), z.string()).default({}),
  commonAnnotations: z.record(z.string(), z.string()).default({}),
  externalURL: z.string().optional(),
  version: z.string().optional(),
  groupKey: z.string().optional(),
  truncatedAlerts: z.number().optional(),
  title: z.string().optional(),
  state: z.string().optional(),
  message: z.string().optional(),
});
export type GrafanaPayload = z.infer<typeof GrafanaPayloadSchema>;
