import { z } from "zod";

import { OSTinybird } from "@openstatus/tinybird";

import { env } from "../../env";
import { createTRPCRouter, protectedProcedure } from "../../trpc";

const tb = new OSTinybird({ token: env.TINY_BIRD_API_KEY });

// WORK IN PROGRESS - we can create a tb router to call it via TRPC server and client

export const tinybirdRouter = createTRPCRouter({
  lastCronTimestamp: protectedProcedure.query(async (opts) => {
    const workspaceId = String(opts.ctx.workspace.id);
    return await tb.endpointLastCronTimestamp("workspace")({ workspaceId });
  }),

  monitorMetricsFromWorkspace: protectedProcedure
    .input(z.object({ period: z.string() }))
    .query(async (opts) => {
      const workspaceId = String(opts.ctx.workspace.id);
    }),
});
