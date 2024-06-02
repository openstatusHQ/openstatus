import { z } from "zod";

import { base } from "@openstatus/assertions";
import { monitorMethods, monitorStatus } from "@openstatus/db/src/schema";

export const payloadSchema = z.object({
  workspaceId: z.string(),
  monitorId: z.string(),
  method: z.enum(monitorMethods),
  body: z.string().optional(),
  headers: z.array(z.object({ key: z.string(), value: z.string() })).optional(),
  url: z.string(),
  cronTimestamp: z.number(),
  status: z.enum(monitorStatus),
  assertions: z.array(base).nullable(),
});

export type Payload = z.infer<typeof payloadSchema>;
