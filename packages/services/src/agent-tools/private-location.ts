import { z } from "zod";

import { listPrivateLocations } from "../private-location";
import type { AgentTool } from "./types";

const PER_PAGE_DEFAULT = 50;
const PER_PAGE_MAX = 100;

const ListPrivateLocationsInputShape = z.object({
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

// `token` is omitted — it's the agent's bearer credential, and possession of it
// grants access to monitor configs including secret request headers.
const ListPrivateLocationsOutput = z.object({
  items: z.array(
    z.object({
      id: z.number().int(),
      name: z.string(),
      monitorIds: z.array(z.number().int()),
      lastSeenAt: z.string().nullable(),
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

export const listPrivateLocationsTool: AgentTool<
  z.infer<typeof ListPrivateLocationsInputShape>,
  z.infer<typeof ListPrivateLocationsOutput>
> = {
  name: "list_private_locations",
  description:
    "List private locations (self-hosted checker agents) in this workspace, with the monitors each one runs and when it last reported in. Read-only — agent tokens are NOT exposed. Use `lastSeenAt` to tell whether an agent is still alive before blaming a monitor for missing checks.",
  scope: "read",
  destructive: false,
  inputSchema: ListPrivateLocationsInputShape,
  outputSchema: ListPrivateLocationsOutput,
  async run({ ctx, input }) {
    const { page, perPage } = input;
    const result = await listPrivateLocations({
      ctx,
      input: {
        limit: perPage,
        offset: (page - 1) * perPage,
      },
    });
    return {
      items: result.items.map((location) => ({
        id: location.id,
        name: location.name,
        monitorIds: location.monitors.map((m) => m.id),
        lastSeenAt: location.lastSeenAt?.toISOString() ?? null,
        createdAt: location.createdAt?.toISOString() ?? null,
        updatedAt: location.updatedAt?.toISOString() ?? null,
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
