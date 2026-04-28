import { getLogger } from "@logtape/logtape";
import type {
  McpServer,
  RegisteredTool,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { statusReportStatusSchema } from "@openstatus/db/src/schema";
import type { ServiceContext } from "@openstatus/services";
import {
  addStatusReportUpdate,
  createStatusReport,
  listStatusReports,
  notifyStatusReport,
  resolveStatusReport,
  updateStatusReport,
} from "@openstatus/services/status-report";
import { z } from "zod";

import { runTool } from "../adapter";

const logger = getLogger("api-server");

const PER_PAGE_DEFAULT = 50;
const PER_PAGE_MAX = 200;

/**
 * "Active" = every status except `resolved`. Computed from the schema
 * so adding a new variant (e.g. `degraded`) automatically extends the
 * filter without touching this file.
 */
const ACTIVE_STATUSES = statusReportStatusSchema.options.filter(
  (s) => s !== "resolved",
);

export function registerStatusReportTools(
  server: McpServer,
  ctx: ServiceContext,
): Map<string, RegisteredTool> {
  const registered = new Map<string, RegisteredTool>();

  registered.set(
    "list_status_reports",
    server.registerTool(
      "list_status_reports",
      {
        description:
          "List status reports in this workspace, newest first. Filter by status (e.g. exclude 'resolved' to see active incidents). Returns the most recent update per report so the LLM can see the current public message without a follow-up call. Paginated via `page` (1-indexed) and `perPage`. The response's `pagination` object carries `totalSize`, `totalPages`, `page`, and `perPage` so the LLM can decide whether to fetch the next page or warn the user.",
        annotations: { readOnlyHint: true, openWorldHint: false },
        inputSchema: {
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
        },
        outputSchema: {
          items: z.array(
            z.object({
              id: z.number().int(),
              title: z.string(),
              status: statusReportStatusSchema,
              pageId: z.number().int().nullable(),
              createdAt: z.string().nullable(),
              updatedAt: z.string().nullable(),
              latestUpdate: z
                .object({
                  message: z.string(),
                  status: statusReportStatusSchema,
                  date: z.string().nullable(),
                })
                .nullable(),
            }),
          ),
          pagination: z.object({
            page: z.number().int(),
            perPage: z.number().int(),
            totalSize: z.number().int(),
            totalPages: z.number().int(),
          }),
        },
      },
      async ({ filter, pageId, page, perPage }) =>
        runTool(
          () =>
            listStatusReports({
              ctx,
              input: {
                limit: perPage ?? PER_PAGE_DEFAULT,
                offset: ((page ?? 1) - 1) * (perPage ?? PER_PAGE_DEFAULT),
                statuses: filter === "active" ? ACTIVE_STATUSES : [],
                pageId,
                order: "desc",
              },
            }),
          ({ items, totalSize }) => {
            const currentPage = page ?? 1;
            const size = perPage ?? PER_PAGE_DEFAULT;
            const summarised = items.map((r) => {
              const latestUpdate = r.updates[0] ?? null;
              return {
                id: r.id,
                title: r.title,
                status: r.status,
                pageId: r.pageId,
                createdAt: r.createdAt?.toISOString() ?? null,
                updatedAt: r.updatedAt?.toISOString() ?? null,
                latestUpdate: latestUpdate
                  ? {
                      message: latestUpdate.message,
                      status: latestUpdate.status,
                      date: latestUpdate.date?.toISOString() ?? null,
                    }
                  : null,
              };
            });
            const out = {
              items: summarised,
              pagination: {
                page: currentPage,
                perPage: size,
                totalSize,
                totalPages: Math.max(1, Math.ceil(totalSize / size)),
              },
            };
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(out),
                },
              ],
              structuredContent: out,
            };
          },
        ),
    ),
  );

  registered.set(
    "create_status_report",
    server.registerTool(
      "create_status_report",
      {
        description:
          "Create a new status report on a public status page. PUBLIC, AUDIT-LOGGED, AND POTENTIALLY NOTIFIES SUBSCRIBERS — irreversible side effects.\n\nMANDATORY workflow before calling:\n1. Draft the title, status, message, and affected components.\n2. Show the draft to the user for review.\n3. Ask explicitly: 'Should I notify subscribers (email + integrations) for this report? yes/no'.\n4. Only call this tool once the user has confirmed BOTH the content AND the notify decision.\n\nSubscriber notifications dispatch as part of this call only — you cannot notify retroactively for an existing update. There is NO separate notify tool. If notify is false here, that update will never reach subscribers. Note: the report persists even if the notify dispatch fails; the response's `notified` field reports whether subscribers were actually notified.\n\npageId MUST come from list_status_pages — never guess. pageComponentIds (if supplied) MUST belong to the same page.",
        annotations: {
          destructiveHint: true,
          idempotentHint: false,
          openWorldHint: true,
        },
        inputSchema: {
          title: z
            .string()
            .min(1)
            .max(256)
            .describe("Short, public-facing title for the incident."),
          status: statusReportStatusSchema.describe(
            "Initial status for the report.",
          ),
          message: z
            .string()
            .min(1)
            .describe(
              "Initial public update message customers will see on the status page.",
            ),
          pageId: z
            .number()
            .int()
            .describe(
              "Status page to attach the report to. Resolve via list_status_pages — do not guess.",
            ),
          pageComponentIds: z
            .array(z.number().int())
            .default([])
            .describe(
              "Optional component ids affected by the incident. Must belong to pageId.",
            ),
          date: z.iso
            .datetime()
            .optional()
            .describe(
              "Override the initial update's date. Defaults to now if omitted.",
            ),
          notify: z
            .boolean()
            .describe(
              "REQUIRED. Whether to dispatch subscriber notifications (email + integrations) for the initial update. You MUST ask the user before deciding — do not infer. true = notify on creation. false = create silently; subscribers will NEVER be notified about this update (you cannot notify retroactively). No-op if the workspace plan has subscriptions disabled.",
            ),
        },
        outputSchema: {
          statusReport: z.object({
            id: z.number().int(),
            title: z.string(),
            status: statusReportStatusSchema,
            pageId: z.number().int().nullable(),
            createdAt: z.string().nullable(),
          }),
          initialUpdateId: z.number().int(),
          notified: z.boolean(),
        },
      },
      async (input) =>
        runTool(
          async () => {
            const result = await createStatusReport({
              ctx,
              input: {
                title: input.title,
                status: input.status,
                message: input.message,
                pageId: input.pageId,
                pageComponentIds: input.pageComponentIds ?? [],
                date: input.date ? new Date(input.date) : new Date(),
              },
            });
            // Mutation succeeded; the row exists. A notify failure
            // here must NOT propagate as a tool error — that would
            // leave the LLM thinking the whole call failed and
            // possibly retrying create, double-publishing the
            // report. Report partial success via `notified: false`.
            let notified = false;
            if (input.notify) {
              try {
                await notifyStatusReport({
                  ctx,
                  input: { statusReportUpdateId: result.initialUpdate.id },
                });
                notified = true;
              } catch (err) {
                logger.error(
                  "notifyStatusReport failed after create_status_report {*}",
                  {
                    err,
                    workspaceId: ctx.workspace.id,
                    statusReportId: result.statusReport.id,
                    statusReportUpdateId: result.initialUpdate.id,
                  },
                );
              }
            }
            return { ...result, notified };
          },
          ({ statusReport, initialUpdate, notified }) => {
            const out = {
              statusReport: {
                id: statusReport.id,
                title: statusReport.title,
                status: statusReport.status,
                pageId: statusReport.pageId,
                createdAt: statusReport.createdAt?.toISOString() ?? null,
              },
              initialUpdateId: initialUpdate.id,
              notified,
            };
            return {
              content: [{ type: "text", text: JSON.stringify(out) }],
              structuredContent: out,
            };
          },
        ),
    ),
  );

  registered.set(
    "add_status_report_update",
    server.registerTool(
      "add_status_report_update",
      {
        description:
          "Append a new public update to an existing status report. PUBLIC, AUDIT-LOGGED, AND POTENTIALLY NOTIFIES SUBSCRIBERS — irreversible side effects. Sets the report's status to the new value (use resolve_status_report instead if the new status would be 'resolved').\n\nMANDATORY workflow before calling:\n1. Draft the new status and message.\n2. Show the draft to the user for review.\n3. Ask explicitly: 'Should I notify subscribers about this update? yes/no'.\n4. Only call this tool once the user has confirmed BOTH the content AND the notify decision.\n\nSubscriber notifications dispatch as part of this call only — you cannot notify retroactively. There is NO separate notify tool. If notify is false here, this update will never reach subscribers. Note: the update persists even if the notify dispatch fails; the response's `notified` field reports whether subscribers were actually notified.",
        annotations: {
          destructiveHint: true,
          idempotentHint: false,
          openWorldHint: true,
        },
        inputSchema: {
          statusReportId: z
            .number()
            .int()
            .describe(
              "Status report to update. Resolve via list_status_reports — do not guess.",
            ),
          status: statusReportStatusSchema.describe(
            "New status to set on the report. The update entry inherits this status.",
          ),
          message: z
            .string()
            .min(1)
            .describe("Public update message customers will see."),
          date: z.iso
            .datetime()
            .optional()
            .describe("Override the update's date. Defaults to now."),
          notify: z
            .boolean()
            .describe(
              "REQUIRED. Whether to dispatch subscriber notifications for this update. You MUST ask the user before deciding — do not infer. true = notify now. false = append silently; subscribers will NEVER be notified about this update (you cannot notify retroactively).",
            ),
        },
        outputSchema: {
          statusReportUpdateId: z.number().int(),
          notified: z.boolean(),
        },
      },
      async (input) =>
        runTool(
          async () => {
            const result = await addStatusReportUpdate({
              ctx,
              input: {
                statusReportId: input.statusReportId,
                status: input.status,
                message: input.message,
                date: input.date ? new Date(input.date) : undefined,
              },
            });
            // See `create_status_report` for the rationale: the
            // update is already persisted, so a notify dispatch
            // failure must not propagate as a tool error.
            let notified = false;
            if (input.notify) {
              try {
                await notifyStatusReport({
                  ctx,
                  input: {
                    statusReportUpdateId: result.statusReportUpdate.id,
                  },
                });
                notified = true;
              } catch (err) {
                logger.error(
                  "notifyStatusReport failed after add_status_report_update {*}",
                  {
                    err,
                    workspaceId: ctx.workspace.id,
                    statusReportId: result.statusReport.id,
                    statusReportUpdateId: result.statusReportUpdate.id,
                  },
                );
              }
            }
            return { ...result, notified };
          },
          ({ statusReportUpdate, notified }) => {
            const out = {
              statusReportUpdateId: statusReportUpdate.id,
              notified,
            };
            return {
              content: [{ type: "text", text: JSON.stringify(out) }],
              structuredContent: out,
            };
          },
        ),
    ),
  );

  registered.set(
    "update_status_report",
    server.registerTool(
      "update_status_report",
      {
        description:
          "Edit metadata on an existing status report (title, status, affected components). Does NOT add a public update — use add_status_report_update for that. Does NOT and CANNOT notify subscribers — there is no notify path on this tool because metadata edits do not create a new update entry to dispatch. If subscribers need to hear about a change, use add_status_report_update instead with notify: true. Audit-logged.\n\nMANDATORY workflow: draft the change, show it to the user, confirm before calling.",
        annotations: {
          destructiveHint: true,
          idempotentHint: true,
          openWorldHint: false,
        },
        inputSchema: {
          statusReportId: z
            .number()
            .int()
            .describe("Report to edit. Resolve via list_status_reports."),
          title: z.string().min(1).max(256).optional().describe("New title."),
          // Guard against `status: "resolved"` — that would flip the
          // report's status without publishing a resolution update,
          // leaving the public page in a divergent state (status
          // reads "resolved" but no resolution message). Force the
          // LLM to use resolve_status_report (which appends the
          // final update) instead. The tool description already
          // says this; the refine is the runtime backstop.
          status: statusReportStatusSchema
            .refine((s) => s !== "resolved", {
              error:
                "update_status_report cannot set status to 'resolved' — use resolve_status_report instead, which also publishes a final resolution update.",
            })
            .optional()
            .describe(
              "New status (without appending a public update entry). Cannot be 'resolved' — use resolve_status_report for that.",
            ),
          pageComponentIds: z
            .array(z.number().int())
            .optional()
            .describe(
              "Replace the full set of associated component ids. Empty array clears the association.",
            ),
        },
        outputSchema: {
          id: z.number().int(),
          title: z.string(),
          status: statusReportStatusSchema,
        },
      },
      async (input) =>
        runTool(
          () =>
            updateStatusReport({
              ctx,
              input: {
                id: input.statusReportId,
                title: input.title,
                status: input.status,
                pageComponentIds: input.pageComponentIds,
              },
            }),
          (report) => {
            const out = {
              id: report.id,
              title: report.title,
              status: report.status,
            };
            return {
              content: [{ type: "text", text: JSON.stringify(out) }],
              structuredContent: out,
            };
          },
        ),
    ),
  );

  registered.set(
    "resolve_status_report",
    server.registerTool(
      "resolve_status_report",
      {
        description:
          "Resolve an active status report. Appends a final public update with the supplied message and flips status to 'resolved'. PUBLIC, AUDIT-LOGGED, AND POTENTIALLY NOTIFIES SUBSCRIBERS — irreversible side effects.\n\nMANDATORY workflow before calling:\n1. Draft the resolution message.\n2. Show the draft to the user for review.\n3. Ask explicitly: 'Should I notify subscribers that this incident is resolved? yes/no'.\n4. Only call this tool once the user has confirmed BOTH the message AND the notify decision.\n\nSubscriber notifications dispatch as part of this call only — you cannot notify retroactively. There is NO separate notify tool. If notify is false here, the resolution will never reach subscribers. Note: the report flips to resolved even if the notify dispatch fails; the response's `notified` field reports whether subscribers were actually notified.",
        annotations: {
          destructiveHint: true,
          idempotentHint: false,
          openWorldHint: true,
        },
        inputSchema: {
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
              "REQUIRED. Whether to dispatch subscriber notifications for the resolution update. You MUST ask the user before deciding — do not infer. true = notify now. false = resolve silently; subscribers will NEVER hear about this resolution (you cannot notify retroactively).",
            ),
        },
        outputSchema: {
          statusReportUpdateId: z.number().int(),
          notified: z.boolean(),
        },
      },
      async (input) =>
        runTool(
          async () => {
            const result = await resolveStatusReport({
              ctx,
              input: {
                statusReportId: input.statusReportId,
                message: input.message,
                date: input.date ? new Date(input.date) : undefined,
              },
            });
            // See `create_status_report` for the rationale: the
            // resolution update is already persisted, so a notify
            // dispatch failure must not propagate as a tool error.
            let notified = false;
            if (input.notify) {
              try {
                await notifyStatusReport({
                  ctx,
                  input: {
                    statusReportUpdateId: result.statusReportUpdate.id,
                  },
                });
                notified = true;
              } catch (err) {
                logger.error(
                  "notifyStatusReport failed after resolve_status_report {*}",
                  {
                    err,
                    workspaceId: ctx.workspace.id,
                    statusReportId: result.statusReport.id,
                    statusReportUpdateId: result.statusReportUpdate.id,
                  },
                );
              }
            }
            return { ...result, notified };
          },
          ({ statusReportUpdate, notified }) => {
            const out = {
              statusReportUpdateId: statusReportUpdate.id,
              notified,
            };
            return {
              content: [{ type: "text", text: JSON.stringify(out) }],
              structuredContent: out,
            };
          },
        ),
    ),
  );

  return registered;
}
