import { Events } from "@openstatus/analytics";
import {
  UpsertIncidentResponseTargetInput,
  deleteIncidentResponseTarget,
  getIncidentTargetAttainment,
  getIncidentResponseTarget,
  upsertIncidentResponseTarget,
} from "@openstatus/services/incident-response-target";

import { toServiceCtx, toTRPCError } from "../service-adapter";
import { createTRPCRouter, protectedProcedure } from "../trpc";

export const incidentResponseTargetRouter = createTRPCRouter({
  get: protectedProcedure.query(async ({ ctx }) => {
    try {
      return await getIncidentResponseTarget({ ctx: toServiceCtx(ctx) });
    } catch (err) {
      toTRPCError(err);
    }
  }),

  attainment: protectedProcedure.query(async ({ ctx }) => {
    try {
      return await getIncidentTargetAttainment({ ctx: toServiceCtx(ctx) });
    } catch (err) {
      toTRPCError(err);
    }
  }),

  upsert: protectedProcedure
    .meta({ track: Events.SaveIncidentResponseTarget })
    .input(UpsertIncidentResponseTargetInput)
    .mutation(async ({ ctx, input }) => {
      try {
        return await upsertIncidentResponseTarget({
          ctx: toServiceCtx(ctx),
          input,
        });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  delete: protectedProcedure
    .meta({ track: Events.DeleteIncidentResponseTarget })
    .mutation(async ({ ctx }) => {
      try {
        return await deleteIncidentResponseTarget({ ctx: toServiceCtx(ctx) });
      } catch (err) {
        toTRPCError(err);
      }
    }),
});
