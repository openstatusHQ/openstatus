import { z } from "zod";

export const payloadSchema = z.object({
  workspaceId: z.string(),
  monitorId: z.string(),
  url: z.string(),
  cronTimestamp: z.number(),
  pageIds: z.array(z.string()),
});
