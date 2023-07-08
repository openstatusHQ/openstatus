import { z } from "zod";

import { eq } from "@openstatus/db";
import {
  insertMonitorSchema,
  monitor,
  page,
  user,
  workspace,
} from "@openstatus/db/src/schema";

import { createTRPCRouter, protectedProcedure } from "../trpc";

export const monitorRouter = createTRPCRouter({
  createMonitor: protectedProcedure
    .input(insertMonitorSchema)
    .mutation(async (opts) => {
      await opts.ctx.db.insert(monitor).values(opts.input).execute();
    }),
});
