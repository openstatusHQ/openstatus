import { z } from "zod";

export const StatuspageComponentSchema = z.object({
  id: z.string(),
  page_id: z.string(),
  group_id: z.string().nullable(),
  name: z.string(),
  description: z.string().nullable(),
  position: z.number(),
  status: z.enum([
    "operational",
    "degraded_performance",
    "partial_outage",
    "major_outage",
    "under_maintenance",
  ]),
  showcase: z.boolean(),
  only_show_if_degraded: z.boolean(),
  group: z.boolean(),
  start_date: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type StatuspageComponent = z.infer<typeof StatuspageComponentSchema>;

export const StatuspageGroupComponentSchema = z.object({
  id: z.string(),
  page_id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  components: z.array(z.string()),
  position: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type StatuspageGroupComponent = z.infer<
  typeof StatuspageGroupComponentSchema
>;

export const StatuspageIncidentUpdateSchema = z.object({
  id: z.string(),
  incident_id: z.string(),
  status: z.enum([
    "investigating",
    "identified",
    "monitoring",
    "resolved",
    "scheduled",
    "in_progress",
    "verifying",
    "completed",
  ]),
  body: z.string().nullable(),
  display_at: z.string().nullable(),
  deliver_notifications: z.boolean(),
  affected_components: z
    .array(
      z.object({
        code: z.string(),
        name: z.string(),
        old_status: z.string(),
        new_status: z.string(),
      }),
    )
    .nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type StatuspageIncidentUpdate = z.infer<
  typeof StatuspageIncidentUpdateSchema
>;

export const StatuspageIncidentSchema = z.object({
  id: z.string(),
  page_id: z.string(),
  name: z.string(),
  status: z.enum([
    "investigating",
    "identified",
    "monitoring",
    "resolved",
    "scheduled",
    "in_progress",
    "verifying",
    "completed",
  ]),
  impact: z.enum(["none", "minor", "major", "critical"]).nullable(),
  shortlink: z.string().nullable(),
  scheduled_for: z.string().nullable(),
  scheduled_until: z.string().nullable(),
  resolved_at: z.string().nullable(),
  monitoring_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  incident_updates: z.array(StatuspageIncidentUpdateSchema).optional(),
  components: z.array(StatuspageComponentSchema).optional(),
  postmortem_body: z.string().nullable(),
  metadata: z.unknown().nullable(),
});

export type StatuspageIncident = z.infer<typeof StatuspageIncidentSchema>;

export const StatuspageSubscriberSchema = z.object({
  id: z.string(),
  page_id: z.string(),
  mode: z.enum(["email", "sms", "slack", "webhook", "integration_partner"]),
  email: z.string().nullable(),
  endpoint: z.string().nullable(),
  phone_number: z.string().nullable(),
  phone_country: z.string().nullable(),
  display_phone_number: z.string().nullable(),
  obfuscated_channel_name: z.string().nullable(),
  workspace_name: z.string().nullable(),
  components: z.array(z.string()).nullable(),
  quarantined_at: z.string().nullable(),
  created_at: z.string(),
});

export type StatuspageSubscriber = z.infer<typeof StatuspageSubscriberSchema>;

export const StatuspagePageSchema = z.object({
  id: z.string(),
  name: z.string(),
  page_description: z.string().nullable(),
  subdomain: z.string(),
  domain: z.string().nullable(),
  url: z.string().nullable(),
  support_url: z.string().nullable(),
  time_zone: z.string().nullable(),
  allow_page_subscribers: z.boolean(),
  allow_email_subscribers: z.boolean(),
  allow_sms_subscribers: z.boolean(),
  allow_webhook_subscribers: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type StatuspagePage = z.infer<typeof StatuspagePageSchema>;
