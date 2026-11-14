import { Events } from "@openstatus/analytics";
import {
  UpsertIncidentReportingInput,
  deleteIncidentReporting,
  getIncidentSlaAttainment,
  getIncidentReporting,
  upsertIncidentReporting,
} from "@openstatus/services/incident-reporting";

import { toServiceCtx, toTRPCError } from "../service-adapter";
import { createTRPCRouter, protectedProcedure } from "../trpc";

export const incidentReportingRouter = createTRPCRouter({
  get: protectedProcedure.query(async ({ ctx }) => {
    try {
      return await getIncidentReporting({ ctx: toServiceCtx(ctx) });
    } catch (err) {
      toTRPCError(err);
    }
  }),

  attainment: protectedProcedure.query(async ({ ctx }) => {
    try {
      return await getIncidentSlaAttainment({ ctx: toServiceCtx(ctx) });
    } catch (err) {
      toTRPCError(err);
    }
  }),

  upsert: protectedProcedure
    .meta({ track: Events.SaveIncidentReporting })
    .input(UpsertIncidentReportingInput)
    .mutation(async ({ ctx, input }) => {
      try {
        return await upsertIncidentReporting({ ctx: toServiceCtx(ctx), input });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  delete: protectedProcedure
    .meta({ track: Events.DeleteIncidentReporting })
    .mutation(async ({ ctx }) => {
      try {
        return await deleteIncidentReporting({ ctx: toServiceCtx(ctx) });
      } catch (err) {
        toTRPCError(err);
      }
    }),
});
