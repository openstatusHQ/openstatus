import { z } from "zod";

import { METHODS } from "@openstatus/db/src/schema";

export const payloadSchema = z.object({
  workspaceId: z.string(),
  monitorId: z.string(),
  method: z.enum(METHODS),
  body: z.string().optional(),
  headers: z.array(z.object({ key: z.string(), value: z.string() })).optional(),
  url: z.string(),
  cronTimestamp: z.number(),
  pageIds: z.array(z.string()),
});
