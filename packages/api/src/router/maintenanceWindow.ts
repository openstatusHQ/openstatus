import {
  CreateMaintenanceWindowInput,
  DeleteMaintenanceWindowInput,
  EndMaintenanceWindowInput,
  GetMaintenanceWindowInput,
  ListMaintenanceWindowsInput,
  UpdateMaintenanceWindowInput,
  createMaintenanceWindow,
  deleteMaintenanceWindow,
  endMaintenanceWindow,
  getMaintenanceWindow,
  listMaintenanceWindows,
  updateMaintenanceWindow,
} from "@openstatus/services/maintenance-window";

import { toServiceCtx, toTRPCError } from "../service-adapter";
import { createTRPCRouter, protectedProcedure } from "../trpc";

export const maintenanceWindowRouter = createTRPCRouter({
  list: protectedProcedure
    .input(ListMaintenanceWindowsInput.optional())
    .query(async ({ ctx, input }) => {
      try {
        return await listMaintenanceWindows({ ctx: toServiceCtx(ctx), input });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  get: protectedProcedure
    .input(GetMaintenanceWindowInput)
    .query(async ({ ctx, input }) => {
      try {
        return await getMaintenanceWindow({ ctx: toServiceCtx(ctx), input });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  create: protectedProcedure
    .input(CreateMaintenanceWindowInput)
    .mutation(async ({ ctx, input }) => {
      try {
        return await createMaintenanceWindow({ ctx: toServiceCtx(ctx), input });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  update: protectedProcedure
    .input(UpdateMaintenanceWindowInput)
    .mutation(async ({ ctx, input }) => {
      try {
        return await updateMaintenanceWindow({ ctx: toServiceCtx(ctx), input });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  end: protectedProcedure
    .input(EndMaintenanceWindowInput)
    .mutation(async ({ ctx, input }) => {
      try {
        return await endMaintenanceWindow({ ctx: toServiceCtx(ctx), input });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  delete: protectedProcedure
    .input(DeleteMaintenanceWindowInput)
    .mutation(async ({ ctx, input }) => {
      try {
        await deleteMaintenanceWindow({ ctx: toServiceCtx(ctx), input });
      } catch (err) {
        toTRPCError(err);
      }
    }),
});
