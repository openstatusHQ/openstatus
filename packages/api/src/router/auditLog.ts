import {
  ListAuditLogsInput,
  getAuditLog,
  listAuditLogs,
} from "@openstatus/services/audit";
import { z } from "zod";

import { toServiceCtx } from "../service-adapter";
import { createTRPCRouter, protectedProcedure } from "../trpc";

export const auditLogRouter = createTRPCRouter({
  list: protectedProcedure
    .input(ListAuditLogsInput)
    .query(async ({ ctx, input }) =>
      listAuditLogs({ ctx: toServiceCtx(ctx), input }),
    ),
  get: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .query(async ({ ctx, input }) =>
      getAuditLog({ ctx: toServiceCtx(ctx), input }),
    ),
});
