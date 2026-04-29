import { getLogger } from "@logtape/logtape";
import type {
  McpServer,
  RegisteredTool,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ServiceContext } from "@openstatus/services";
import {
  createMaintenance,
  listMaintenances,
  notifyMaintenance,
} from "@openstatus/services/maintenance";
import { z } from "zod";

import { runTool } from "../adapter";

const logger = getLogger("api-server");

const PER_PAGE_DEFAULT = 50;
const PER_PAGE_MAX = 200;

export function registerMaintenanceTools(
  server: McpServer,
  ctx: ServiceContext,
): Map<string, RegisteredTool> {
  const registered = new Map<string, RegisteredTool>();

  registered.set(
    "list_maintenances",
    server.registerTool(
      "list_maintenances",
      {
        description:
          "List maintenance windows in this workspace, newest first. Paginated via `page` (1-indexed) and `perPage`. The response's `pagination` object carries `totalSize`, `totalPages`, `page`, and `perPage` so the LLM can decide whether to fetch the next page or warn the user that the result is paginated.",
        annotations: { readOnlyHint: true, openWorldHint: false },
        inputSchema: {
          pageId: z
            .number()
            .int()
            .optional()
            .describe("If set, only maintenances attached to this page id."),
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
              message: z.string(),
              from: z.string(),
              to: z.string(),
              pageId: z.number().int().nullable(),
              pageComponentIds: z.array(z.number().int()),
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
      async ({ pageId, page, perPage }) =>
        runTool(
          () =>
            listMaintenances({
              ctx,
              input: {
                limit: perPage ?? PER_PAGE_DEFAULT,
                offset: ((page ?? 1) - 1) * (perPage ?? PER_PAGE_DEFAULT),
                pageId,
                order: "desc",
              },
            }),
          ({ items, totalSize }) => {
            const currentPage = page ?? 1;
            const size = perPage ?? PER_PAGE_DEFAULT;
            const summarised = items.map((m) => ({
              id: m.id,
              title: m.title,
              message: m.message,
              from: m.from.toISOString(),
              to: m.to.toISOString(),
              pageId: m.pageId,
              pageComponentIds: m.pageComponentIds,
            }));
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
              content: [{ type: "text", text: JSON.stringify(out) }],
              structuredContent: out,
            };
          },
        ),
    ),
  );

  registered.set(
    "create_maintenance",
    server.registerTool(
      "create_maintenance",
      {
        description:
          "Schedule a maintenance window on a status page. PUBLIC, AUDIT-LOGGED, AND POTENTIALLY NOTIFIES SUBSCRIBERS — irreversible side effects.\n\nMANDATORY workflow before calling:\n1. Draft the title, message, and time window (ISO 8601 from/to).\n2. Show the draft to the user for review.\n3. Ask explicitly: 'Should I notify subscribers (email + integrations) about this maintenance window? yes/no'.\n4. Only call this tool once the user has confirmed BOTH the content AND the notify decision.\n\nSubscriber notifications dispatch as part of this call only — you cannot notify retroactively for an existing window. There is NO separate notify tool. If notify is false here, this window will never reach subscribers. Note: the maintenance row persists even if the notify dispatch fails; the response's `notified` field reports whether subscribers were actually notified.\n\npageId MUST come from list_status_pages — never guess.",
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
            .describe("Short, public-facing title for the maintenance window."),
          message: z
            .string()
            .min(1)
            .describe("Public message describing the work, shown on the page."),
          from: z.iso
            .datetime()
            .describe("Start time, ISO 8601 (e.g. 2026-04-30T14:00:00Z)."),
          to: z.iso
            .datetime()
            .describe(
              "End time, ISO 8601. Must be strictly after `from` — service rejects otherwise.",
            ),
          pageId: z
            .number()
            .int()
            .describe(
              "Status page to attach the maintenance to. Resolve via list_status_pages — do not guess.",
            ),
          pageComponentIds: z
            .array(z.number().int())
            .default([])
            .describe(
              "Optional component ids affected by the maintenance. Must belong to pageId.",
            ),
          notify: z
            .boolean()
            .describe(
              "REQUIRED. Whether to dispatch subscriber notifications for the new window. You MUST ask the user before deciding — do not infer. true = notify on creation. false = create silently; subscribers will NEVER be notified about this window (you cannot notify retroactively).",
            ),
        },
        outputSchema: {
          id: z.number().int(),
          title: z.string(),
          from: z.string(),
          to: z.string(),
          pageId: z.number().int().nullable(),
          notified: z.boolean(),
        },
      },
      async (input) =>
        runTool(
          async () => {
            const record = await createMaintenance({
              ctx,
              input: {
                title: input.title,
                message: input.message,
                from: new Date(input.from),
                to: new Date(input.to),
                pageId: input.pageId,
                pageComponentIds: input.pageComponentIds ?? [],
              },
            });
            // The maintenance row is already persisted; a notify
            // dispatch failure must not propagate as a tool error.
            // Otherwise the LLM treats the whole call as failed and
            // may retry, double-publishing the window. Report
            // partial success via `notified: false`.
            let notified = false;
            if (input.notify) {
              try {
                await notifyMaintenance({
                  ctx,
                  input: { maintenanceId: record.id },
                });
                notified = true;
              } catch (err) {
                logger.error(
                  "notifyMaintenance failed after create_maintenance {*}",
                  {
                    err,
                    workspaceId: ctx.workspace.id,
                    maintenanceId: record.id,
                  },
                );
              }
            }
            return { record, notified };
          },
          ({ record, notified }) => {
            const out = {
              id: record.id,
              title: record.title,
              from: record.from.toISOString(),
              to: record.to.toISOString(),
              pageId: record.pageId,
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
