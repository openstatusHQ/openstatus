import { z } from "zod";

import { OSTinybird } from "@openstatus/tinybird";

import { flyRegions } from "@openstatus/db/src/schema/constants";
import { env } from "../../env";
import { createTRPCRouter, protectedProcedure } from "../../trpc";

const tb = new OSTinybird(env.TINY_BIRD_API_KEY);

// WORK IN PROGRESS - we can create a tb router to call it via TRPC server and client

export const tinybirdRouter = createTRPCRouter({
  httpGetMonthly: protectedProcedure
    .input(
      z.object({
        monitorId: z.string(),
        region: z.enum(flyRegions).optional(),
        cronTimestamp: z.number().int().optional(),
      }),
    )
    .query(async (opts) => {
      return await tb.httpGetMonthly(opts.input);
    }),
});
