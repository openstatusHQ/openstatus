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

const READ_LIMIT_DEFAULT = 50;
const READ_LIMIT_MAX = 200;

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
          "List maintenance windows in this workspace. Defaults to upcoming-only (windows whose `to` is still in the future) which is what callers usually want when scheduling. Pass `filter: 'all'` to include past maintenances too. Caveat: with `filter: 'upcoming'`, this scans up to 200 most-recent windows and post-filters; workspaces with very long maintenance history may see the upcoming subset truncated — assume the result is the most-recent slice, not exhaustive.",
        annotations: { readOnlyHint: true, openWorldHint: false },
        inputSchema: {
          filter: z
            .enum(["upcoming", "all"])
            .default("upcoming")
            .describe(
              "upcoming = only windows whose end time is still in the future (default). all = every window regardless of date.",
            ),
          pageId: z
            .number()
            .int()
            .optional()
            .describe("If set, only maintenances attached to this page id."),
          limit: z
            .number()
            .int()
            .min(1)
            .max(READ_LIMIT_MAX)
            .default(READ_LIMIT_DEFAULT)
            .describe(
              `Max maintenances to return (default ${READ_LIMIT_DEFAULT}, max ${READ_LIMIT_MAX}).`,
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
        },
      },
      async ({ filter, pageId, limit }) =>
        runTool(
          () =>
            listMaintenances({
              ctx,
              input: {
                // The service has no `upcoming` flag, so we over-fetch
                // and post-filter. For `upcoming`, fetch the maximum
                // window the tool exposes so the post-filter has a
                // best chance of returning a full page even when the
                // workspace has lots of historical maintenances mixed
                // in. This is a known ceiling — workspaces with more
                // than READ_LIMIT_MAX past+upcoming windows will see
                // the upcoming subset truncate; that's acceptable for
                // v1 and matches the description's implied bound.
                limit:
                  filter === "upcoming"
                    ? READ_LIMIT_MAX
                    : limit ?? READ_LIMIT_DEFAULT,
                offset: 0,
                pageId,
                order: "desc",
              },
            }),
          ({ items }) => {
            const cap = limit ?? READ_LIMIT_DEFAULT;
            const now = Date.now();
            const filtered =
              filter === "upcoming"
                ? items.filter((m) => m.to.getTime() > now)
                : items;
            const summarised = filtered.slice(0, cap).map((m) => ({
              id: m.id,
              title: m.title,
              message: m.message,
              from: m.from.toISOString(),
              to: m.to.toISOString(),
              pageId: m.pageId,
              pageComponentIds: m.pageComponentIds,
            }));
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({ items: summarised }),
                },
              ],
              structuredContent: { items: summarised },
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
          "Schedule a maintenance window on a status page. PUBLIC, AUDIT-LOGGED, AND POTENTIALLY NOTIFIES SUBSCRIBERS — irreversible side effects.\n\nMANDATORY workflow before calling:\n1. Draft the title, message, and time window (ISO 8601 from/to).\n2. Show the draft to the user for review.\n3. Ask explicitly: 'Should I notify subscribers (email + integrations) about this maintenance window? yes/no'.\n4. Only call this tool once the user has confirmed BOTH the content AND the notify decision.\n\nSubscriber notifications fire atomically with creation — you cannot notify retroactively. There is NO separate notify tool. If notify is omitted or false here, this window will never reach subscribers.\n\npageId MUST come from list_status_pages — never guess.",
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
            if (input.notify) {
              await notifyMaintenance({
                ctx,
                input: { maintenanceId: record.id },
              });
            }
            return { record, notified: input.notify };
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
