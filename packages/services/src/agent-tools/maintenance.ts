import { z } from "zod";

import {
  createMaintenance,
  listMaintenances,
  notifyMaintenance,
} from "../maintenance";
import type { AgentTool } from "./types";

const PER_PAGE_DEFAULT = 50;
const PER_PAGE_MAX = 200;

function formatMaintenanceDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

const ListMaintenancesInputShape = z.object({
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
});

const ListMaintenancesOutput = z.object({
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
});

export const listMaintenancesTool: AgentTool<
  z.infer<typeof ListMaintenancesInputShape>,
  z.infer<typeof ListMaintenancesOutput>
> = {
  name: "list_maintenances",
  description:
    "List maintenance windows in this workspace, newest first. Paginated via `page` (1-indexed) and `perPage`.",
  scope: "read",
  destructive: false,
  inputSchema: ListMaintenancesInputShape,
  outputSchema: ListMaintenancesOutput,
  async run({ ctx, input }) {
    const { pageId, page, perPage } = input;
    const result = await listMaintenances({
      ctx,
      input: {
        limit: perPage,
        offset: (page - 1) * perPage,
        pageId,
        order: "desc",
      },
    });
    return {
      items: result.items.map((m) => ({
        id: m.id,
        title: m.title,
        message: m.message,
        from: m.from.toISOString(),
        to: m.to.toISOString(),
        pageId: m.pageId,
        pageComponentIds: m.pageComponentIds,
      })),
      pagination: {
        page,
        perPage,
        totalSize: result.totalSize,
        totalPages: Math.max(1, Math.ceil(result.totalSize / perPage)),
      },
    };
  },
};

const CreateMaintenanceInputShape = z.object({
  title: z.string().min(1).max(256).describe("Short, public-facing title."),
  message: z
    .string()
    .min(1)
    .describe("Public message describing the work, shown on the page."),
  from: z.iso
    .datetime()
    .describe("Start time, ISO 8601 (e.g. 2026-04-30T14:00:00Z)."),
  to: z.iso
    .datetime()
    .describe("End time, ISO 8601. Must be strictly after `from`."),
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
      "Optional component ids affected by the maintenance. Resolve via list_page_components({ pageId }) — never guess. Must belong to pageId.",
    ),
  notify: z
    .boolean()
    .describe(
      "Whether to dispatch subscriber notifications. No retroactive notify — false means subscribers will never hear about this window.",
    ),
});

const CreateMaintenanceOutput = z.object({
  id: z.number().int(),
  title: z.string(),
  from: z.string(),
  to: z.string(),
  pageId: z.number().int().nullable(),
  notified: z.boolean(),
});

export const createMaintenanceTool: AgentTool<
  z.infer<typeof CreateMaintenanceInputShape>,
  z.infer<typeof CreateMaintenanceOutput>
> = {
  name: "create_maintenance",
  description:
    "Schedule a maintenance window on a status page. PUBLIC, AUDIT-LOGGED, AND POTENTIALLY NOTIFIES SUBSCRIBERS — irreversible side effects. Subscriber notifications dispatch as part of this call only — no retroactive notify. The maintenance row persists even if the notify dispatch fails; `notified` reports the actual outcome. pageId MUST come from list_status_pages — never guess. pageComponentIds (if supplied) MUST come from list_page_components({ pageId }) and belong to the same page.",
  scope: "write",
  destructive: true,
  inputSchema: CreateMaintenanceInputShape,
  outputSchema: CreateMaintenanceOutput,
  approval: {
    extraFlags: [{ id: "notify", label: "Notify subscribers" }],
    applyFlags: (input, flags) => ({ ...input, notify: flags.notify ?? false }),
    summarize: (input) => ({
      title: `Schedule Maintenance: ${input.title}`,
      lines: [
        { label: "Title", value: input.title },
        {
          label: "Page ID",
          value: String(input.pageId),
          ref: { kind: "page", pageId: input.pageId },
        },
        { label: "From", value: formatMaintenanceDate(input.from) },
        { label: "To", value: formatMaintenanceDate(input.to) },
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
        { label: "Message", value: input.message },
      ],
    }),
    verb: "scheduled",
  },
  async run({ ctx, input }) {
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
    let notified = false;
    if (input.notify) {
      try {
        await notifyMaintenance({
          ctx,
          input: { maintenanceId: record.id },
        });
        notified = true;
      } catch (err) {
        console.warn("notifyMaintenance failed after create_maintenance", err);
      }
    }
    return {
      id: record.id,
      title: record.title,
      from: record.from.toISOString(),
      to: record.to.toISOString(),
      pageId: record.pageId,
      notified,
    };
  },
};
