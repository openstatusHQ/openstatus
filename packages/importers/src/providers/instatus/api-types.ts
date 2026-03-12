import { z } from "zod";

export const InstatusPageSchema = z.object({
  id: z.string(),
  name: z.string(),
  subdomain: z.string(),
  customDomain: z.string().nullable(),
  status: z.string(),
  logoUrl: z.string().nullable(),
  faviconUrl: z.string().nullable(),
  websiteUrl: z.string().nullable(),
  language: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type InstatusPage = z.infer<typeof InstatusPageSchema>;

export const InstatusComponentSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  status: z.enum([
    "OPERATIONAL",
    "UNDERMAINTENANCE",
    "DEGRADEDPERFORMANCE",
    "PARTIALOUTAGE",
    "MAJOROUTAGE",
  ]),
  order: z.number(),
  group: z.string().nullable(),
  showUptime: z.boolean(),
  grouped: z.boolean(),
});

export type InstatusComponent = z.infer<typeof InstatusComponentSchema>;

export const InstatusIncidentUpdateSchema = z.object({
  id: z.string(),
  message: z.string().nullable(),
  messageHtml: z.string().nullable(),
  status: z.enum(["INVESTIGATING", "IDENTIFIED", "MONITORING", "RESOLVED"]),
  notify: z.boolean(),
  started: z.string(),
  createdAt: z.string(),
});

export type InstatusIncidentUpdate = z.infer<
  typeof InstatusIncidentUpdateSchema
>;

export const InstatusIncidentSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(["INVESTIGATING", "IDENTIFIED", "MONITORING", "RESOLVED"]),
  started: z.string(),
  resolved: z.string().nullable(),
  updates: z.array(InstatusIncidentUpdateSchema).optional(),
  components: z.array(z.string()).optional(),
});

export type InstatusIncident = z.infer<typeof InstatusIncidentSchema>;

export const InstatusMaintenanceUpdateSchema = z.object({
  id: z.string(),
  message: z.string().nullable(),
  messageHtml: z.string().nullable(),
  status: z.enum(["NOTSTARTEDYET", "INPROGRESS", "COMPLETED"]),
  notify: z.boolean(),
  started: z.string(),
});

export type InstatusMaintenanceUpdate = z.infer<
  typeof InstatusMaintenanceUpdateSchema
>;

export const InstatusMaintenanceSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(["NOTSTARTEDYET", "INPROGRESS", "COMPLETED"]),
  start: z.string(),
  duration: z.number().nullable(),
  updates: z.array(InstatusMaintenanceUpdateSchema).optional(),
  components: z.array(z.string()).optional(),
});

export type InstatusMaintenance = z.infer<typeof InstatusMaintenanceSchema>;

export const InstatusSubscriberSchema = z.object({
  id: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  webhook: z.string().nullable(),
  confirmed: z.boolean(),
  all: z.boolean(),
  components: z.array(z.string()).optional(),
});

export type InstatusSubscriber = z.infer<typeof InstatusSubscriberSchema>;
