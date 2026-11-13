import { Events } from "@openstatus/analytics";
import {
  AddMonitorSlaExcusedWindowInput,
  addMonitorSlaExcusedWindow,
  archiveMonitorReporting,
  CreateMonitorReportingInput,
  createMonitorReporting,
  deleteMonitorReporting,
  ExportMonitorReportingInput,
  exportMonitorReporting,
  GetMonitorSlaExcusedWindowInput,
  GetMonitorSlaMonitorMonthInput,
  GetMonitorReportingInput,
  getMonitorSlaExcusedWindow,
  getMonitorSlaMonitorMonth,
  getMonitorReporting,
  getMonitorReportingSummary,
  ListMonitorReportingsForMonitorInput,
  ListMonitorReportingsInput,
  listMonitorReportings,
  listMonitorReportingsForMonitor,
  listMonitorReportingMaintenances,
  MonitorReportingIdInput,
  RemoveMonitorSlaExcusedWindowInput,
  removeMonitorSlaExcusedWindow,
  UpdateMonitorReportingInput,
  updateMonitorReporting,
} from "@openstatus/services/monitor-reporting";

import { toServiceCtx, toTRPCError } from "../service-adapter";
import { createTRPCRouter, protectedProcedure } from "../trpc";

export const monitorReportingRouter = createTRPCRouter({
  list: protectedProcedure
    .input(ListMonitorReportingsInput.optional())
    .query(async ({ ctx, input }) => {
      try {
        return await listMonitorReportings({ ctx: toServiceCtx(ctx), input });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  listForMonitor: protectedProcedure
    .input(ListMonitorReportingsForMonitorInput)
    .query(async ({ ctx, input }) => {
      try {
        return await listMonitorReportingsForMonitor({
          ctx: toServiceCtx(ctx),
          input,
        });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  get: protectedProcedure
    .input(GetMonitorReportingInput)
    .query(async ({ ctx, input }) => {
      try {
        return await getMonitorReporting({ ctx: toServiceCtx(ctx), input });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  summary: protectedProcedure
    .input(MonitorReportingIdInput)
    .query(async ({ ctx, input }) => {
      try {
        return await getMonitorReportingSummary({
          ctx: toServiceCtx(ctx),
          input,
        });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  monitorMonth: protectedProcedure
    .input(GetMonitorSlaMonitorMonthInput)
    .query(async ({ ctx, input }) => {
      try {
        return await getMonitorSlaMonitorMonth({
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
    .input(GetMonitorReportingInput)
    .query(async ({ ctx, input }) => {
      try {
        return await listMonitorReportingMaintenances({
          ctx: toServiceCtx(ctx),
          input,
        });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  export: protectedProcedure
    .input(ExportMonitorReportingInput)
    .query(async ({ ctx, input }) => {
      try {
        return await exportMonitorReporting({ ctx: toServiceCtx(ctx), input });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  create: protectedProcedure
    .meta({ track: Events.CreateMonitorReporting })
    .input(CreateMonitorReportingInput)
    .mutation(async ({ ctx, input }) => {
      try {
        return await createMonitorReporting({ ctx: toServiceCtx(ctx), input });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  update: protectedProcedure
    .meta({ track: Events.UpdateMonitorReporting })
    .input(UpdateMonitorReportingInput)
    .mutation(async ({ ctx, input }) => {
      try {
        return await updateMonitorReporting({ ctx: toServiceCtx(ctx), input });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  archive: protectedProcedure
    .meta({ track: Events.ArchiveMonitorReporting })
    .input(MonitorReportingIdInput)
    .mutation(async ({ ctx, input }) => {
      try {
        return await archiveMonitorReporting({ ctx: toServiceCtx(ctx), input });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  delete: protectedProcedure
    .meta({ track: Events.DeleteMonitorReporting })
    .input(MonitorReportingIdInput)
    .mutation(async ({ ctx, input }) => {
      try {
        return await deleteMonitorReporting({ ctx: toServiceCtx(ctx), input });
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
