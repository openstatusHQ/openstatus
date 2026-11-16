import { Events } from "@openstatus/analytics";
import {
  AddUptimeTargetExcusedWindowInput,
  addUptimeTargetExcusedWindow,
  archiveUptimeTarget,
  CreateUptimeTargetInput,
  createUptimeTarget,
  deleteUptimeTarget,
  ExportUptimeTargetInput,
  exportUptimeTarget,
  GetUptimeTargetExcusedWindowInput,
  GetUptimeTargetMonthInput,
  GetUptimeTargetInput,
  getUptimeTargetExcusedWindow,
  getUptimeTargetMonth,
  getUptimeTarget,
  getUptimeTargetSummary,
  ListUptimeTargetsForMonitorInput,
  ListUptimeTargetsInput,
  listUptimeTargets,
  listUptimeTargetsForMonitor,
  listUptimeTargetMaintenances,
  UptimeTargetIdInput,
  PreviewUptimeTargetExcusedWindowInput,
  previewUptimeTargetExcusedWindow,
  RemoveUptimeTargetExcusedWindowInput,
  removeUptimeTargetExcusedWindow,
  UpdateUptimeTargetInput,
  updateUptimeTarget,
} from "@openstatus/services/uptime-target";

import { toServiceCtx, toTRPCError } from "../service-adapter";
import { createTRPCRouter, protectedProcedure } from "../trpc";

export const uptimeTargetRouter = createTRPCRouter({
  list: protectedProcedure
    .input(ListUptimeTargetsInput.optional())
    .query(async ({ ctx, input }) => {
      try {
        return await listUptimeTargets({ ctx: toServiceCtx(ctx), input });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  listForMonitor: protectedProcedure
    .input(ListUptimeTargetsForMonitorInput)
    .query(async ({ ctx, input }) => {
      try {
        return await listUptimeTargetsForMonitor({
          ctx: toServiceCtx(ctx),
          input,
        });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  get: protectedProcedure
    .input(GetUptimeTargetInput)
    .query(async ({ ctx, input }) => {
      try {
        return await getUptimeTarget({ ctx: toServiceCtx(ctx), input });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  summary: protectedProcedure
    .input(UptimeTargetIdInput)
    .query(async ({ ctx, input }) => {
      try {
        return await getUptimeTargetSummary({
          ctx: toServiceCtx(ctx),
          input,
        });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  monitorMonth: protectedProcedure
    .input(GetUptimeTargetMonthInput)
    .query(async ({ ctx, input }) => {
      try {
        return await getUptimeTargetMonth({
          ctx: toServiceCtx(ctx),
          input,
        });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  excusedWindow: protectedProcedure
    .input(GetUptimeTargetExcusedWindowInput)
    .query(async ({ ctx, input }) => {
      try {
        return await getUptimeTargetExcusedWindow({
          ctx: toServiceCtx(ctx),
          input,
        });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  excusedWindowPreview: protectedProcedure
    .input(PreviewUptimeTargetExcusedWindowInput)
    .query(async ({ ctx, input }) => {
      try {
        return await previewUptimeTargetExcusedWindow({
          ctx: toServiceCtx(ctx),
          input,
        });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  maintenances: protectedProcedure
    .input(GetUptimeTargetInput)
    .query(async ({ ctx, input }) => {
      try {
        return await listUptimeTargetMaintenances({
          ctx: toServiceCtx(ctx),
          input,
        });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  export: protectedProcedure
    .input(ExportUptimeTargetInput)
    .query(async ({ ctx, input }) => {
      try {
        return await exportUptimeTarget({ ctx: toServiceCtx(ctx), input });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  create: protectedProcedure
    .meta({ track: Events.CreateUptimeTarget })
    .input(CreateUptimeTargetInput)
    .mutation(async ({ ctx, input }) => {
      try {
        return await createUptimeTarget({ ctx: toServiceCtx(ctx), input });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  update: protectedProcedure
    .meta({ track: Events.UpdateUptimeTarget })
    .input(UpdateUptimeTargetInput)
    .mutation(async ({ ctx, input }) => {
      try {
        return await updateUptimeTarget({ ctx: toServiceCtx(ctx), input });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  archive: protectedProcedure
    .meta({ track: Events.ArchiveUptimeTarget })
    .input(UptimeTargetIdInput)
    .mutation(async ({ ctx, input }) => {
      try {
        return await archiveUptimeTarget({ ctx: toServiceCtx(ctx), input });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  delete: protectedProcedure
    .meta({ track: Events.DeleteUptimeTarget })
    .input(UptimeTargetIdInput)
    .mutation(async ({ ctx, input }) => {
      try {
        return await deleteUptimeTarget({ ctx: toServiceCtx(ctx), input });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  addExcusedWindow: protectedProcedure
    .meta({ track: Events.AddUptimeTargetExcusedWindow })
    .input(AddUptimeTargetExcusedWindowInput)
    .mutation(async ({ ctx, input }) => {
      try {
        return await addUptimeTargetExcusedWindow({
          ctx: toServiceCtx(ctx),
          input,
        });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  removeExcusedWindow: protectedProcedure
    .meta({ track: Events.RemoveUptimeTargetExcusedWindow })
    .input(RemoveUptimeTargetExcusedWindowInput)
    .mutation(async ({ ctx, input }) => {
      try {
        return await removeUptimeTargetExcusedWindow({
          ctx: toServiceCtx(ctx),
          input,
        });
      } catch (err) {
        toTRPCError(err);
      }
    }),
});
