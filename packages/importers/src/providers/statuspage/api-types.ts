import { z } from "zod";

import { lenientEnum } from "../../schemas";

export const StatuspageComponentSchema = z.object({
  id: z.string(),
  page_id: z.string(),
  group_id: z.string().nullish(),
  name: z.string(),
  description: z.string().nullish(),
  position: z.number().nullish(),
  status: lenientEnum([
    "operational",
    "degraded_performance",
    "partial_outage",
    "major_outage",
    "under_maintenance",
    // the spec allows an empty status
    "",
  ]),
  showcase: z.boolean().nullish(),
  only_show_if_degraded: z.boolean().nullish(),
  group: z.boolean().nullish(),
  start_date: z.string().nullish(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type StatuspageComponent = z.infer<typeof StatuspageComponentSchema>;

export const StatuspageGroupComponentSchema = z.object({
  id: z.string(),
  page_id: z.string(),
  name: z.string(),
  description: z.string().nullish(),
  components: z.array(z.string()).nullish(),
  position: z.number().nullish(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type StatuspageGroupComponent = z.infer<
  typeof StatuspageGroupComponentSchema
>;

// `postmortem` is set on the incident and on the update that publishes it.
const StatuspageIncidentStatusSchema = lenientEnum([
  "investigating",
  "identified",
  "monitoring",
  "resolved",
  "postmortem",
  "scheduled",
  "in_progress",
  "verifying",
  "completed",
]);

export const StatuspageIncidentUpdateSchema = z.object({
  id: z.string(),
  incident_id: z.string(),
  status: StatuspageIncidentStatusSchema,
  body: z.string().nullish(),
  display_at: z.string().nullish(),
  deliver_notifications: z.boolean().nullish(),
  affected_components: z
    .array(
      z.object({
        code: z.string(),
        name: z.string(),
        old_status: z.string(),
        new_status: z.string(),
      }),
    )
    .nullish(),
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
  status: StatuspageIncidentStatusSchema,
  impact: lenientEnum([
    "none",
    "maintenance",
    "minor",
    "major",
    "critical",
  ]).nullish(),
  shortlink: z.string().nullish(),
  scheduled_for: z.string().nullish(),
  scheduled_until: z.string().nullish(),
  resolved_at: z.string().nullish(),
  monitoring_at: z.string().nullish(),
  created_at: z.string(),
  updated_at: z.string(),
  incident_updates: z.array(StatuspageIncidentUpdateSchema).optional(),
  components: z.array(StatuspageComponentSchema).optional(),
  postmortem_body: z.string().nullish(),
  metadata: z.unknown().nullish(),
});

export type StatuspageIncident = z.infer<typeof StatuspageIncidentSchema>;

export const StatuspageSubscriberSchema = z.object({
  id: z.string(),
  page_id: z.string().nullish(),
  mode: lenientEnum([
    "email",
    "sms",
    "slack",
    "webhook",
    "teams",
    "integration_partner",
  ]),
  email: z.string().nullish(),
  endpoint: z.string().nullish(),
  phone_number: z.string().nullish(),
  phone_country: z.string().nullish(),
  display_phone_number: z.string().nullish(),
  obfuscated_channel_name: z.string().nullish(),
  workspace_name: z.string().nullish(),
  components: z.array(z.string()).nullish(),
  quarantined_at: z.string().nullish(),
  created_at: z.string(),
});

export type StatuspageSubscriber = z.infer<typeof StatuspageSubscriberSchema>;

export const StatuspagePageSchema = z.object({
  id: z.string(),
  name: z.string(),
  page_description: z.string().nullish(),
  subdomain: z.string(),
  domain: z.string().nullish(),
  url: z.string().nullish(),
  support_url: z.string().nullish(),
  time_zone: z.string().nullish(),
  allow_page_subscribers: z.boolean().nullish(),
  allow_email_subscribers: z.boolean().nullish(),
  allow_sms_subscribers: z.boolean().nullish(),
  allow_webhook_subscribers: z.boolean().nullish(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type StatuspagePage = z.infer<typeof StatuspagePageSchema>;
