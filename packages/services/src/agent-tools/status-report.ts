import {
  currentImpactsFromUpdates,
  statusReportStatusSchema,
} from "@openstatus/db/src/schema";
import { z } from "zod";

import { attributedUserSchema, toAgentUser } from "../attribution";
import type { ServiceContext } from "../context";
import {
  addStatusReportUpdate,
  deleteStatusReportUpdate,
  getStatusReport,
  listStatusReports,
  notifyStatusReport,
  resolveStatusReport,
  updateStatusReport,
  updateStatusReportUpdate,
} from "../status-report";
import { createStatusReport } from "../status-report/create";
import {
  type ComponentImpacts,
  componentImpactsSchema,
  type StatusReportStatus,
} from "../status-report/schemas";
import { formatComponentImpacts } from "../status-report/utils";
import type { AgentTool, SummaryLine } from "./types";

// Agent surfaces send only the impacts that CHANGED (see system prompt). Carry
// the report's current non-operational impacts into the update so each update's
// rows are self-contained for the per-update render — and so the confirmation
// preview shows the full impact, not just the delta.
async function withCarriedImpacts(
  ctx: ServiceContext,
  statusReportId: number,
  status: StatusReportStatus,
  componentImpacts: ComponentImpacts | undefined,
): Promise<ComponentImpacts | undefined> {
  // resolve clears every still-active component the update doesn't name; carrying
  // them forward would mark them named and defeat that, so skip carry on resolve.
  if (status === "resolved") return componentImpacts;
  const report = await getStatusReport({
    ctx,
    input: { id: statusReportId },
  });
  const current = currentImpactsFromUpdates(
    report.updates.map((u) => ({
      id: u.id,
      date: u.date,
      componentImpacts: u.componentImpacts,
    })),
  );
  const merged: ComponentImpacts = [...(componentImpacts ?? [])];
  const named = new Set(merged.map((ci) => ci.pageComponentId));
  for (const [pageComponentId, impact] of current) {
    if (impact !== "operational" && !named.has(pageComponentId)) {
      merged.push({ pageComponentId, impact });
    }
  }
  return merged.length > 0 ? merged : componentImpacts;
}

const componentImpactsInputShape = componentImpactsSchema
  .optional()
  .describe(
    "Per-component impact (operational | degraded_performance | partial_outage | major_outage). Component ids MUST come from list_page_components. Omit entirely for a report without impact tracking.",
  );

const PER_PAGE_DEFAULT = 50;
const PER_PAGE_MAX = 200;

/**
 * "Active" statuses are computed at module load — extending the
 * `statusReportStatusSchema` enum (e.g. adding `degraded`) automatically
 * widens the filter without touching this file.
 */
const ACTIVE_STATUSES = statusReportStatusSchema.options.filter(
  (s) => s !== "resolved",
);

// keeps list output bounded for long-running incidents
const LIST_UPDATES_LIMIT = 10;

const ListStatusReportsInputShape = z.object({
  filter: z
    .enum(["active", "all"])
    .default("active")
    .describe(
      "active = exclude resolved reports (default). all = every report regardless of status.",
    ),
  pageId: z
    .number()
    .int()
    .optional()
    .describe("If set, only reports attached to this page id."),
  page: z
    .number()
    .int()
    .min(1)
    .default(1)
    .describe("1-indexed page number (default 1)."),
  perPage: z
    .number()
    .int()
    .min(1)
    .max(PER_PAGE_MAX)
    .default(PER_PAGE_DEFAULT)
    .describe(
      `Items per page (default ${PER_PAGE_DEFAULT}, max ${PER_PAGE_MAX}).`,
    ),
});

const ListStatusReportsOutput = z.object({
  items: z.array(
    z.object({
      id: z.number().int(),
      title: z.string(),
      status: statusReportStatusSchema,
      pageId: z.number().int().nullable(),
      createdAt: z.string().nullable(),
      updatedAt: z.string().nullable(),
      createdBy: attributedUserSchema.nullable(),
      updatedBy: attributedUserSchema.nullable(),
      latestUpdate: z
        .object({
          id: z.number().int(),
          message: z.string(),
          status: statusReportStatusSchema,
          date: z.string().nullable(),
          createdBy: attributedUserSchema.nullable(),
        })
        .nullable(),
      updates: z.array(
        z.object({
          id: z.number().int(),
          status: statusReportStatusSchema,
          message: z.string(),
          date: z.string().nullable(),
        }),
      ),
    }),
  ),
  pagination: z.object({
    page: z.number().int(),
    perPage: z.number().int(),
    totalSize: z.number().int(),
    totalPages: z.number().int(),
  }),
});

export const listStatusReportsTool: AgentTool<
  z.infer<typeof ListStatusReportsInputShape>,
  z.infer<typeof ListStatusReportsOutput>
> = {
  name: "list_status_reports",
  description:
    "List status reports in this workspace, newest first. Filter by status (e.g. exclude 'resolved' to see active incidents). Returns each report's timeline newest-first under `updates`, capped at the 10 most recent entries (ids feed update_status_report_update / delete_status_report_update), plus `latestUpdate` with its author. Paginated via `page` (1-indexed) and `perPage`.",
  scope: "read",
  destructive: false,
  inputSchema: ListStatusReportsInputShape,
  outputSchema: ListStatusReportsOutput,
  async run({ ctx, input }) {
    const { filter, pageId, page, perPage } = input;
    const result = await listStatusReports({
      ctx,
      input: {
        limit: perPage,
        offset: (page - 1) * perPage,
        statuses: filter === "active" ? ACTIVE_STATUSES : [],
        pageId,
        order: "desc",
      },
    });
    return {
      items: result.items.map((r) => {
        const latestUpdate = r.updates[0] ?? null;
        return {
          id: r.id,
          title: r.title,
          status: r.status,
          pageId: r.pageId,
          createdAt: r.createdAt?.toISOString() ?? null,
          updatedAt: r.updatedAt?.toISOString() ?? null,
          createdBy: toAgentUser(r.createdByUser),
          updatedBy: toAgentUser(r.updatedByUser),
          latestUpdate: latestUpdate
            ? {
                id: latestUpdate.id,
                message: latestUpdate.message,
                status: latestUpdate.status,
                date: latestUpdate.date?.toISOString() ?? null,
                createdBy: toAgentUser(latestUpdate.createdByUser),
              }
            : null,
          updates: r.updates.slice(0, LIST_UPDATES_LIMIT).map((u) => ({
            id: u.id,
            status: u.status,
            message: u.message,
            date: u.date?.toISOString() ?? null,
          })),
        };
      }),
      pagination: {
        page,
        perPage,
        totalSize: result.totalSize,
        totalPages: Math.max(1, Math.ceil(result.totalSize / perPage)),
      },
    };
  },
};

const CreateStatusReportInputShape = z.object({
  title: z.string().min(1).max(256).describe("Short, public-facing title."),
  status: statusReportStatusSchema.describe("Initial status for the report."),
  message: z
    .string()
    .min(1)
    .describe("Initial public update message customers will see."),
  pageId: z
    .number()
    .int()
    .describe(
      "Status page to attach to. Resolve via list_status_pages — never guess.",
    ),
  pageComponentIds: z
    .array(z.number().int())
    .default([])
    .describe(
      "Optional component ids affected by the incident. Resolve via list_page_components({ pageId }) — never guess. Must belong to pageId.",
    ),
  componentImpacts: componentImpactsInputShape,
  date: z.iso
    .datetime()
    .optional()
    .describe("Override the initial update's date. Defaults to now."),
  incidentId: z
    .number()
    .int()
    .optional()
    .describe(
      "Managed incident this report communicates, from list_incidents. Links them.",
    ),
  notify: z
    .boolean()
    .describe(
      "Whether to dispatch subscriber notifications for the initial update. true = notify on creation. false = create silently; subscribers will NEVER hear about this update (no retroactive notify).",
    ),
});

const CreateStatusReportOutput = z.object({
  statusReport: z.object({
    id: z.number().int(),
    title: z.string(),
    status: statusReportStatusSchema,
    pageId: z.number().int().nullable(),
    createdAt: z.string().nullable(),
  }),
  initialUpdateId: z.number().int(),
  notified: z.boolean(),
});

export const createStatusReportTool: AgentTool<
  z.infer<typeof CreateStatusReportInputShape>,
  z.infer<typeof CreateStatusReportOutput>
> = {
  name: "create_status_report",
  description:
    "Create a new status report on a public status page. PUBLIC, AUDIT-LOGGED, AND POTENTIALLY NOTIFIES SUBSCRIBERS — irreversible side effects. Subscriber notifications dispatch as part of this call only — no retroactive notify. The report persists even if the notify dispatch fails; `notified` reports the actual outcome. pageId MUST come from list_status_pages — never guess. pageComponentIds (if supplied) MUST come from list_page_components({ pageId }) and belong to the same page.",
  scope: "write",
  destructive: true,
  inputSchema: CreateStatusReportInputShape,
  outputSchema: CreateStatusReportOutput,
  approval: {
    extraFlags: [{ id: "notify", label: "Notify subscribers" }],
    applyFlags: (input, flags) => ({ ...input, notify: flags.notify ?? false }),
    summarize: (input) => ({
      title: `Create Status Report: ${input.title}`,
      lines: [
        { label: "Title", value: input.title },
        { label: "Status", value: input.status },
        {
          label: "Page ID",
          value: String(input.pageId),
          ref: { kind: "page", pageId: input.pageId },
        },
        ...(input.pageComponentIds?.length
          ? [
              {
                label: "Components",
                value: input.pageComponentIds.join(", "),
                ref: {
                  kind: "components" as const,
                  componentIds: input.pageComponentIds,
                },
              },
            ]
          : []),
        ...(input.componentImpacts?.length
          ? [
              {
                label: "Impacts",
                value: formatComponentImpacts(input.componentImpacts).join(
                  ", ",
                ),
                ref: {
                  kind: "componentImpacts" as const,
                  impacts: input.componentImpacts,
                },
              },
            ]
          : []),
        ...(input.incidentId
          ? [{ label: "Incident", value: `#${input.incidentId}` }]
          : []),
        { label: "Message", value: input.message },
      ],
    }),
    verb: "created",
  },
  async run({ ctx, input }) {
    const result = await createStatusReport({
      ctx,
      input: {
        title: input.title,
        status: input.status,
        message: input.message,
        pageId: input.pageId,
        pageComponentIds: input.pageComponentIds ?? [],
        componentImpacts: input.componentImpacts,
        date: input.date ? new Date(input.date) : new Date(),
        incidentId: input.incidentId,
      },
    });
    let notified = false;
    if (input.notify) {
      try {
        await notifyStatusReport({
          ctx,
          input: { statusReportUpdateId: result.initialUpdate.id },
        });
        notified = true;
      } catch (err) {
        console.warn(
          "notifyStatusReport failed after create_status_report",
          err,
        );
      }
    }
    return {
      statusReport: {
        id: result.statusReport.id,
        title: result.statusReport.title,
        status: result.statusReport.status,
        pageId: result.statusReport.pageId,
        createdAt: result.statusReport.createdAt?.toISOString() ?? null,
      },
      initialUpdateId: result.initialUpdate.id,
      notified,
    };
  },
};

const AddStatusReportUpdateInputShape = z.object({
  statusReportId: z
    .number()
    .int()
    .describe("Status report to update. Resolve via list_status_reports."),
  status: statusReportStatusSchema.describe(
    "New status to set on the report. The update entry inherits this status.",
  ),
  message: z
    .string()
    .min(1)
    .describe("Public update message customers will see."),
  componentImpacts: componentImpactsInputShape,
  date: z.iso
    .datetime()
    .optional()
    .describe("Override the update's date. Defaults to now."),
  notify: z
    .boolean()
    .describe(
      "Whether to dispatch subscriber notifications for this update. No retroactive notify — false means subscribers will never hear about this update.",
    ),
});

const AddStatusReportUpdateOutput = z.object({
  statusReportUpdateId: z.number().int(),
  notified: z.boolean(),
  statusReport: z.object({
    id: z.number().int(),
    title: z.string(),
    status: statusReportStatusSchema,
    pageId: z.number().int().nullable(),
  }),
});

export const addStatusReportUpdateTool: AgentTool<
  z.infer<typeof AddStatusReportUpdateInputShape>,
  z.infer<typeof AddStatusReportUpdateOutput>
> = {
  name: "add_status_report_update",
  description:
    "Append a new public update to an existing status report. PUBLIC, AUDIT-LOGGED, AND POTENTIALLY NOTIFIES SUBSCRIBERS — irreversible side effects. Sets the report's status to the new value (use resolve_status_report instead if the new status would be 'resolved'). Subscriber notifications dispatch as part of this call only — no retroactive notify. The update persists even if the notify dispatch fails; `notified` reports the actual outcome.",
  scope: "write",
  destructive: true,
  inputSchema: AddStatusReportUpdateInputShape,
  outputSchema: AddStatusReportUpdateOutput,
  approval: {
    extraFlags: [{ id: "notify", label: "Notify subscribers" }],
    applyFlags: (input, flags) => ({ ...input, notify: flags.notify ?? false }),
    prepareDraftInput: async ({ ctx, input }) => ({
      ...input,
      componentImpacts: await withCarriedImpacts(
        ctx,
        input.statusReportId,
        input.status,
        input.componentImpacts,
      ),
    }),
    summarize: (input) => ({
      title: `Add Status Report Update (${input.status})`,
      lines: [
        { label: "Report ID", value: String(input.statusReportId) },
        { label: "New Status", value: input.status },
        ...(input.componentImpacts?.length
          ? [
              {
                label: "Impacts",
                value: formatComponentImpacts(input.componentImpacts).join(
                  ", ",
                ),
                ref: {
                  kind: "componentImpacts" as const,
                  impacts: input.componentImpacts,
                },
              },
            ]
          : []),
        { label: "Message", value: input.message },
      ],
    }),
    verb: "added",
  },
  async run({ ctx, input }) {
    const result = await addStatusReportUpdate({
      ctx,
      input: {
        statusReportId: input.statusReportId,
        status: input.status,
        message: input.message,
        componentImpacts: await withCarriedImpacts(
          ctx,
          input.statusReportId,
          input.status,
          input.componentImpacts,
        ),
        date: input.date ? new Date(input.date) : undefined,
      },
    });
    let notified = false;
    if (input.notify) {
      try {
        await notifyStatusReport({
          ctx,
          input: { statusReportUpdateId: result.statusReportUpdate.id },
        });
        notified = true;
      } catch (err) {
        console.warn(
          "notifyStatusReport failed after add_status_report_update",
          err,
        );
      }
    }
    return {
      statusReportUpdateId: result.statusReportUpdate.id,
      notified,
      statusReport: {
        id: result.statusReport.id,
        title: result.statusReport.title,
        status: result.statusReport.status,
        pageId: result.statusReport.pageId,
      },
    };
  },
};

const UpdateStatusReportInputShape = z.object({
  statusReportId: z
    .number()
    .int()
    .describe("Report to edit. Resolve via list_status_reports."),
  title: z.string().min(1).max(256).optional().describe("New title."),
  status: statusReportStatusSchema
    .refine((s) => s !== "resolved", {
      error:
        "update_status_report cannot set status to 'resolved' — use resolve_status_report instead, which also publishes a final resolution update.",
    })
    .optional()
    .describe(
      "New status (without appending a public update entry). Cannot be 'resolved'.",
    ),
  pageComponentIds: z
    .array(z.number().int())
    .optional()
    .describe(
      "Replace the full set of associated component ids. Resolve via list_page_components — never guess. Empty array clears the association.",
    ),
});

const UpdateStatusReportOutput = z.object({
  id: z.number().int(),
  title: z.string(),
  status: statusReportStatusSchema,
});

export const updateStatusReportTool: AgentTool<
  z.infer<typeof UpdateStatusReportInputShape>,
  z.infer<typeof UpdateStatusReportOutput>
> = {
  name: "update_status_report",
  description:
    "Edit metadata on an existing status report (title, status, affected components). Does NOT add a public update — use add_status_report_update for that. Does NOT and CANNOT notify subscribers — there is no notify path on this tool because metadata edits do not create a new update entry to dispatch. Audit-logged.",
  scope: "write",
  destructive: true,
  inputSchema: UpdateStatusReportInputShape,
  outputSchema: UpdateStatusReportOutput,
  approval: {
    summarize: (input) => {
      const lines: SummaryLine[] = [
        { label: "Report ID", value: String(input.statusReportId) },
      ];
      if (input.title) lines.push({ label: "New Title", value: input.title });
      if (input.status)
        lines.push({ label: "New Status", value: input.status });
      // Distinguish "don't touch components" (undefined) from
      // "clear all associations" ([]). The latter is destructive and
      // MUST be visible on the approval card.
      if (input.pageComponentIds !== undefined) {
        lines.push({
          label: "Components",
          value: input.pageComponentIds.length
            ? input.pageComponentIds.join(", ")
            : "(clear all)",
          ...(input.pageComponentIds.length
            ? {
                ref: {
                  kind: "components" as const,
                  componentIds: input.pageComponentIds,
                },
              }
            : {}),
        });
      }
      return {
        title: `Update Status Report${input.title ? `: ${input.title}` : ""}`,
        lines,
      };
    },
    verb: "updated",
  },
  async run({ ctx, input }) {
    const report = await updateStatusReport({
      ctx,
      input: {
        id: input.statusReportId,
        title: input.title,
        status: input.status,
        pageComponentIds: input.pageComponentIds,
      },
    });
    return { id: report.id, title: report.title, status: report.status };
  },
};

const ResolveStatusReportInputShape = z.object({
  statusReportId: z
    .number()
    .int()
    .describe("Report to resolve. Resolve via list_status_reports."),
  message: z
    .string()
    .min(1)
    .describe(
      "Resolution message customers will see explaining what was fixed.",
    ),
  date: z.iso
    .datetime()
    .optional()
    .describe("Override the resolution date. Defaults to now."),
  notify: z
    .boolean()
    .describe(
      "Whether to dispatch subscriber notifications for the resolution update. No retroactive notify — false means subscribers will never hear about this resolution.",
    ),
});

const ResolveStatusReportOutput = z.object({
  statusReportUpdateId: z.number().int(),
  notified: z.boolean(),
  statusReport: z.object({
    id: z.number().int(),
    title: z.string(),
    pageId: z.number().int().nullable(),
  }),
});

export const resolveStatusReportTool: AgentTool<
  z.infer<typeof ResolveStatusReportInputShape>,
  z.infer<typeof ResolveStatusReportOutput>
> = {
  name: "resolve_status_report",
  description:
    "Resolve an active status report. Appends a final public update with the supplied message and flips status to 'resolved'. PUBLIC, AUDIT-LOGGED, AND POTENTIALLY NOTIFIES SUBSCRIBERS — irreversible side effects. Subscriber notifications dispatch as part of this call only — no retroactive notify. The report flips to resolved even if the notify dispatch fails; `notified` reports the actual outcome.",
  scope: "write",
  destructive: true,
  inputSchema: ResolveStatusReportInputShape,
  outputSchema: ResolveStatusReportOutput,
  approval: {
    extraFlags: [{ id: "notify", label: "Notify subscribers" }],
    applyFlags: (input, flags) => ({ ...input, notify: flags.notify ?? false }),
    summarize: (input) => ({
      title: "Resolve Status Report",
      lines: [
        { label: "Report ID", value: String(input.statusReportId) },
        { label: "Message", value: input.message },
      ],
    }),
    verb: "resolved",
  },
  async run({ ctx, input }) {
    const result = await resolveStatusReport({
      ctx,
      input: {
        statusReportId: input.statusReportId,
        message: input.message,
        date: input.date ? new Date(input.date) : undefined,
      },
    });
    let notified = false;
    if (input.notify) {
      try {
        await notifyStatusReport({
          ctx,
          input: { statusReportUpdateId: result.statusReportUpdate.id },
        });
        notified = true;
      } catch (err) {
        console.warn(
          "notifyStatusReport failed after resolve_status_report",
          err,
        );
      }
    }
    return {
      statusReportUpdateId: result.statusReportUpdate.id,
      notified,
      statusReport: {
        id: result.statusReport.id,
        title: result.statusReport.title,
        pageId: result.statusReport.pageId,
      },
    };
  },
};

const UpdateStatusReportUpdateInputShape = z.object({
  id: z
    .number()
    .int()
    .describe(
      "Status report update id from list_status_reports (`updates[].id`; `latestUpdate.id` is the newest) or a prior create/add result — never guess.",
    ),
  status: statusReportStatusSchema
    .refine((s) => s !== "resolved", {
      error:
        "update_status_report_update cannot set status to 'resolved' — use resolve_status_report instead, which publishes a resolution update.",
    })
    .optional()
    .describe("New status for this entry. Cannot be 'resolved'."),
  message: z.string().min(1).optional().describe("New public message."),
  date: z.iso.datetime().optional().describe("New date for this entry."),
  componentImpacts: componentImpactsSchema
    .optional()
    .describe(
      "Replace this entry's full impact set (empty array clears it). Omit to leave impacts untouched. Component ids MUST come from list_page_components.",
    ),
});

const UpdateStatusReportUpdateOutput = z.object({
  id: z.number().int(),
  statusReportId: z.number().int(),
  status: statusReportStatusSchema,
  message: z.string(),
  date: z.string(),
});

export const updateStatusReportUpdateTool: AgentTool<
  z.infer<typeof UpdateStatusReportUpdateInputShape>,
  z.infer<typeof UpdateStatusReportUpdateOutput>
> = {
  name: "update_status_report_update",
  description:
    "Edit an existing status report timeline entry (message, date, status, component impacts). PUBLIC and AUDIT-LOGGED. Does not notify subscribers. Editing the latest entry's status re-derives the report's status. The update id MUST come from list_status_reports (`updates[].id`; `latestUpdate.id` is the newest) or a prior create/add result.",
  scope: "write",
  destructive: true,
  inputSchema: UpdateStatusReportUpdateInputShape,
  outputSchema: UpdateStatusReportUpdateOutput,
  approval: {
    summarize: (input) => ({
      title: `Edit Status Report Update #${input.id}`,
      lines: [
        ...(input.status ? [{ label: "Status", value: input.status }] : []),
        ...(input.date ? [{ label: "Date", value: input.date }] : []),
        ...(input.componentImpacts
          ? [
              {
                label: "Impacts",
                value: input.componentImpacts.length
                  ? formatComponentImpacts(input.componentImpacts).join(", ")
                  : "cleared",
                ref: {
                  kind: "componentImpacts" as const,
                  impacts: input.componentImpacts,
                },
              },
            ]
          : []),
        ...(input.message ? [{ label: "Message", value: input.message }] : []),
      ],
    }),
    verb: "updated",
  },
  async run({ ctx, input }) {
    const update = await updateStatusReportUpdate({
      ctx,
      input: {
        id: input.id,
        status: input.status,
        message: input.message,
        date: input.date ? new Date(input.date) : undefined,
        componentImpacts: input.componentImpacts,
      },
    });
    return {
      id: update.id,
      statusReportId: update.statusReportId,
      status: update.status,
      message: update.message,
      date: update.date.toISOString(),
    };
  },
};

const DeleteStatusReportUpdateInputShape = z.object({
  id: z
    .number()
    .int()
    .describe(
      "Status report update id from list_status_reports (`updates[].id`; `latestUpdate.id` is the newest) or a prior create/add result — never guess.",
    ),
});

const DeleteStatusReportUpdateOutput = z.object({
  id: z.number().int(),
  success: z.boolean(),
});

export const deleteStatusReportUpdateTool: AgentTool<
  z.infer<typeof DeleteStatusReportUpdateInputShape>,
  z.infer<typeof DeleteStatusReportUpdateOutput>
> = {
  name: "delete_status_report_update",
  description:
    "Delete a status report timeline entry. PUBLIC, AUDIT-LOGGED, AND IRREVERSIBLE. The report's status is re-derived from the remaining entries. A report must retain at least one update — to remove the only entry, delete the report from the dashboard instead. The update id MUST come from list_status_reports (`updates[].id`; `latestUpdate.id` is the newest) or a prior create/add result.",
  scope: "write",
  destructive: true,
  inputSchema: DeleteStatusReportUpdateInputShape,
  outputSchema: DeleteStatusReportUpdateOutput,
  approval: {
    summarize: (input) => ({
      title: `Delete Status Report Update #${input.id}`,
      lines: [{ label: "Update ID", value: String(input.id) }],
    }),
    verb: "deleted",
  },
  async run({ ctx, input }) {
    await deleteStatusReportUpdate({ ctx, input });
    return { id: input.id, success: true };
  },
};
