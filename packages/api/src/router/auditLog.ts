import { ListAuditLogsInput, listAuditLogs } from "@openstatus/services/audit";

import { toServiceCtx } from "../service-adapter";
import { createTRPCRouter, protectedProcedure } from "../trpc";

export const auditLogRouter = createTRPCRouter({
  list: protectedProcedure
    .input(ListAuditLogsInput)
    .query(async ({ ctx, input }) =>
      listAuditLogs({ ctx: toServiceCtx(ctx), input }),
    ),
});
