import { Events } from "@openstatus/analytics";
import {
  AddMonitorSlaExcusedWindowInput,
  addMonitorSlaExcusedWindow,
  archiveMonitorSlaPolicy,
  CreateMonitorSlaPolicyInput,
  createMonitorSlaPolicy,
  deleteMonitorSlaPolicy,
  ExportMonitorSlaPolicyInput,
  exportMonitorSlaPolicy,
  GetMonitorSlaExcusedWindowInput,
  GetMonitorSlaPolicyInput,
  getMonitorSlaExcusedWindow,
  getMonitorSlaPolicy,
  getMonitorSlaPolicySummary,
  ListMonitorSlaPoliciesInput,
  listMonitorSlaPolicies,
  listMonitorSlaPolicyMaintenances,
  MonitorSlaPolicyIdInput,
  RemoveMonitorSlaExcusedWindowInput,
  removeMonitorSlaExcusedWindow,
  UpdateMonitorSlaPolicyInput,
  updateMonitorSlaPolicy,
} from "@openstatus/services/monitor-sla-policy";

import { toServiceCtx, toTRPCError } from "../service-adapter";
import { createTRPCRouter, protectedProcedure } from "../trpc";

export const monitorSlaPolicyRouter = createTRPCRouter({
  list: protectedProcedure
    .input(ListMonitorSlaPoliciesInput.optional())
    .query(async ({ ctx, input }) => {
      try {
        return await listMonitorSlaPolicies({ ctx: toServiceCtx(ctx), input });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  get: protectedProcedure
    .input(GetMonitorSlaPolicyInput)
    .query(async ({ ctx, input }) => {
      try {
        return await getMonitorSlaPolicy({ ctx: toServiceCtx(ctx), input });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  summary: protectedProcedure
    .input(MonitorSlaPolicyIdInput)
    .query(async ({ ctx, input }) => {
      try {
        return await getMonitorSlaPolicySummary({
          ctx: toServiceCtx(ctx),
          input,
        });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  excusedWindow: protectedProcedure
    .input(GetMonitorSlaExcusedWindowInput)
    .query(async ({ ctx, input }) => {
      try {
        return await getMonitorSlaExcusedWindow({
          ctx: toServiceCtx(ctx),
          input,
        });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  maintenances: protectedProcedure
    .input(GetMonitorSlaPolicyInput)
    .query(async ({ ctx, input }) => {
      try {
        return await listMonitorSlaPolicyMaintenances({
          ctx: toServiceCtx(ctx),
          input,
        });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  export: protectedProcedure
    .input(ExportMonitorSlaPolicyInput)
    .query(async ({ ctx, input }) => {
      try {
        return await exportMonitorSlaPolicy({ ctx: toServiceCtx(ctx), input });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  create: protectedProcedure
    .meta({ track: Events.CreateMonitorSlaPolicy })
    .input(CreateMonitorSlaPolicyInput)
    .mutation(async ({ ctx, input }) => {
      try {
        return await createMonitorSlaPolicy({ ctx: toServiceCtx(ctx), input });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  update: protectedProcedure
    .meta({ track: Events.UpdateMonitorSlaPolicy })
    .input(UpdateMonitorSlaPolicyInput)
    .mutation(async ({ ctx, input }) => {
      try {
        return await updateMonitorSlaPolicy({ ctx: toServiceCtx(ctx), input });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  archive: protectedProcedure
    .meta({ track: Events.ArchiveMonitorSlaPolicy })
    .input(MonitorSlaPolicyIdInput)
    .mutation(async ({ ctx, input }) => {
      try {
        return await archiveMonitorSlaPolicy({ ctx: toServiceCtx(ctx), input });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  delete: protectedProcedure
    .meta({ track: Events.DeleteMonitorSlaPolicy })
    .input(MonitorSlaPolicyIdInput)
    .mutation(async ({ ctx, input }) => {
      try {
        return await deleteMonitorSlaPolicy({ ctx: toServiceCtx(ctx), input });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  addExcusedWindow: protectedProcedure
    .meta({ track: Events.AddMonitorSlaExcusedWindow })
    .input(AddMonitorSlaExcusedWindowInput)
    .mutation(async ({ ctx, input }) => {
      try {
        return await addMonitorSlaExcusedWindow({
          ctx: toServiceCtx(ctx),
          input,
        });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  removeExcusedWindow: protectedProcedure
    .meta({ track: Events.RemoveMonitorSlaExcusedWindow })
    .input(RemoveMonitorSlaExcusedWindowInput)
    .mutation(async ({ ctx, input }) => {
      try {
        return await removeMonitorSlaExcusedWindow({
          ctx: toServiceCtx(ctx),
          input,
        });
      } catch (err) {
        toTRPCError(err);
      }
    }),
});
