import { z } from "zod";

export const payloadSchema = z.object({
  workspaceId: z.string(),
  monitorId: z.string(),
  url: z.string(),
  cronTimestamp: z.number(),
  pageId: z.array(z.string()),
});
