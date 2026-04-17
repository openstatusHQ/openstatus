import { z } from "zod";

export const BetterstackMonitorSchema = z.object({
  id: z.string(),
  type: z.literal("monitor"),
  attributes: z.object({
    url: z.string(),
    pronounceable_name: z.string(),
    monitor_type: z.string(),
    monitor_group_id: z
      .union([z.string(), z.number()])
      .nullable()
      .transform((v) => (v != null ? String(v) : null)),
    http_method: z.string().default("get"),
    check_frequency: z.number(),
    request_timeout: z.number(),
    request_headers: z
      .array(
        z.object({
          id: z.string().optional(),
          name: z.string(),
          value: z.string(),
        }),
      )
      .default([]),
    request_body: z.string().default(""),
    expected_status_codes: z.array(z.number()).default([]),
    required_keyword: z.string().nullable().default(null),
    verify_ssl: z.boolean().default(true),
    regions: z.array(z.string()).default([]),
    status: z.string(),
    paused_at: z.string().nullable(),
    created_at: z.string(),
    updated_at: z.string(),
  }),
});

export type BetterstackMonitor = z.infer<typeof BetterstackMonitorSchema>;

export const BetterstackMonitorGroupSchema = z.object({
  id: z.string(),
  type: z.literal("monitor_group"),
  attributes: z.object({
    name: z.string(),
    sort_index: z.number().nullable(),
    paused: z.boolean(),
    created_at: z.string(),
    updated_at: z.string(),
  }),
});

export type BetterstackMonitorGroup = z.infer<
  typeof BetterstackMonitorGroupSchema
>;

export const BetterstackStatusPageSchema = z.object({
  id: z.string(),
  type: z.literal("status_page"),
  attributes: z.object({
    company_name: z.string(),
    company_url: z.string().nullable(),
    subdomain: z.string(),
    custom_domain: z.string().nullable(),
    timezone: z.string().nullable(),
    subscribable: z.boolean().default(false),
    aggregate_state: z.string(),
    created_at: z.string(),
    updated_at: z.string(),
  }),
});

export type BetterstackStatusPage = z.infer<typeof BetterstackStatusPageSchema>;

export const BetterstackStatusPageSectionSchema = z.object({
  id: z.string(),
  type: z.literal("status_page_section"),
  attributes: z.object({
    name: z.string(),
    position: z.number(),
    status_page_id: z.number(),
  }),
});

export type BetterstackStatusPageSection = z.infer<
  typeof BetterstackStatusPageSectionSchema
>;

export const BetterstackIncidentSchema = z.object({
  id: z.string(),
  type: z.literal("incident"),
  attributes: z.object({
    name: z.string().nullable(),
    url: z.string().nullable(),
    cause: z.string().nullable(),
    started_at: z.string(),
    acknowledged_at: z.string().nullable(),
    resolved_at: z.string().nullable(),
    status: z.string(),
    regions: z.array(z.string()).default([]),
  }),
});

export type BetterstackIncident = z.infer<typeof BetterstackIncidentSchema>;

export const BetterstackStatusPageResourceSchema = z.object({
  id: z.string(),
  type: z.literal("status_page_resource"),
  attributes: z.object({
    status_page_section_id: z.number().nullable(),
    resource_id: z.number().nullable(),
    resource_type: z.string().nullable(),
    public_name: z.string(),
    explanation: z.string().nullable().default(null),
    position: z.number().default(0),
    widget_type: z.string().nullable().default(null),
    status: z.string().nullable().default(null),
  }),
});

export type BetterstackStatusPageResource = z.infer<
  typeof BetterstackStatusPageResourceSchema
>;

const BetterstackAffectedResourceSchema = z.object({
  status_page_resource_id: z.string(),
  status: z.string(),
});

export const BetterstackStatusReportSchema = z.object({
  id: z.string(),
  type: z.literal("status_report"),
  attributes: z.object({
    title: z.string(),
    report_type: z.string(),
    starts_at: z.string().nullable(),
    ends_at: z.string().nullable(),
    status_page_id: z.number(),
    affected_resources: z.array(BetterstackAffectedResourceSchema).default([]),
    aggregate_state: z.string().nullable(),
  }),
});

export type BetterstackStatusReport = z.infer<
  typeof BetterstackStatusReportSchema
>;

export const BetterstackStatusUpdateSchema = z.object({
  id: z.string(),
  type: z.literal("status_update"),
  attributes: z.object({
    message: z.string().nullable(),
    published_at: z.string(),
    affected_resources: z.array(BetterstackAffectedResourceSchema).default([]),
    status_report_id: z.number().nullable(),
  }),
});

export type BetterstackStatusUpdate = z.infer<
  typeof BetterstackStatusUpdateSchema
>;

export const PaginationSchema = z.object({
  first: z.string().nullable(),
  last: z.string().nullable(),
  prev: z.string().nullable(),
  next: z.string().nullable(),
});

export function paginatedResponse<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    data: z.array(dataSchema),
    pagination: PaginationSchema,
  });
}
