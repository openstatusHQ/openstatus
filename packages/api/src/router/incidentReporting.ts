import { Events } from "@openstatus/analytics";
import {
  UpsertIncidentSlaPolicyInput,
  deleteIncidentSlaPolicy,
  getIncidentSlaAttainment,
  getIncidentSlaPolicy,
  upsertIncidentSlaPolicy,
} from "@openstatus/services/incident-sla-policy";

import { toServiceCtx, toTRPCError } from "../service-adapter";
import { createTRPCRouter, protectedProcedure } from "../trpc";

export const incidentSlaPolicyRouter = createTRPCRouter({
  get: protectedProcedure.query(async ({ ctx }) => {
    try {
      return await getIncidentSlaPolicy({ ctx: toServiceCtx(ctx) });
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
    .meta({ track: Events.SaveIncidentSlaPolicy })
    .input(UpsertIncidentSlaPolicyInput)
    .mutation(async ({ ctx, input }) => {
      try {
        return await upsertIncidentSlaPolicy({ ctx: toServiceCtx(ctx), input });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  delete: protectedProcedure
    .meta({ track: Events.DeleteIncidentSlaPolicy })
    .mutation(async ({ ctx }) => {
      try {
        return await deleteIncidentSlaPolicy({ ctx: toServiceCtx(ctx) });
      } catch (err) {
        toTRPCError(err);
      }
    }),
});
