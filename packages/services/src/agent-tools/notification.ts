import { z } from "zod";

import { listNotifications } from "../notification";
import type { AgentTool } from "./types";

const PER_PAGE_DEFAULT = 50;
const PER_PAGE_MAX = 200;

const ListNotificationsInputShape = z.object({
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

// `data` (channel-config) is omitted — it holds tokens, webhook URLs, phone numbers.
const ListNotificationsOutput = z.object({
  items: z.array(
    z.object({
      id: z.number().int(),
      name: z.string(),
      provider: z.string(),
      monitorIds: z.array(z.number().int()),
      createdAt: z.string().nullable(),
      updatedAt: z.string().nullable(),
    }),
  ),
  pagination: z.object({
    page: z.number().int(),
    perPage: z.number().int(),
    totalSize: z.number().int(),
    totalPages: z.number().int(),
  }),
});

export const listNotificationsTool: AgentTool<
  z.infer<typeof ListNotificationsInputShape>,
  z.infer<typeof ListNotificationsOutput>
> = {
  name: "list_notifications",
  description:
    "List notification channels (email/Slack/Discord/PagerDuty/Webhook/etc.) configured in this workspace, with the monitors each one is wired to. Read-only — channel credentials/data are NOT exposed. Use to advise whether alerts will fire for a given monitor.",
  scope: "read",
  destructive: false,
  inputSchema: ListNotificationsInputShape,
  outputSchema: ListNotificationsOutput,
  async run({ ctx, input }) {
    const { page, perPage } = input;
    const result = await listNotifications({
      ctx,
      input: {
        limit: perPage,
        offset: (page - 1) * perPage,
        order: "desc",
      },
    });
    return {
      items: result.items.map((n) => ({
        id: n.id,
        name: n.name,
        provider: n.provider,
        monitorIds: n.monitors.map((m) => m.id),
        createdAt: n.createdAt?.toISOString() ?? null,
        updatedAt: n.updatedAt?.toISOString() ?? null,
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
