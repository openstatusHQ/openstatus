import { Events } from "@openstatus/analytics";
import { notifyMaintenance } from "@openstatus/services/maintenance";
import { notifyStatusReport } from "@openstatus/services/status-report";
import { z } from "zod";

import { toServiceCtx, toTRPCError } from "../service-adapter";
import { createTRPCRouter, protectedProcedure } from "../trpc";

// Subscriber dispatch fans out across every channel (email + webhook), so it
// must run on the lambda runtime: the email channel (Resend + react-email
// render) can't run on Edge and would silently drop emails while webhooks
// still go out. Kept off the statusReport/maintenance routers, which are
// Edge-served — see the `lambdas` list in the dashboard tRPC client.
export const subscriberNotificationRouter = createTRPCRouter({
  statusReport: protectedProcedure
    .meta({ track: Events.NotifyReport })
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await notifyStatusReport({
          ctx: toServiceCtx(ctx),
          input: { statusReportUpdateId: input.id },
        });
        return { success: true };
      } catch (err) {
        toTRPCError(err);
      }
    }),

  maintenance: protectedProcedure
    .meta({ track: Events.NotifyMaintenance })
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await notifyMaintenance({
          ctx: toServiceCtx(ctx),
          input: { maintenanceId: input.id },
        });
        return { success: true };
      } catch (err) {
        toTRPCError(err);
      }
    }),
});
