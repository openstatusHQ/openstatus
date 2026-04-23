import {
  PreviewImportInput,
  RunImportInput,
  previewImport,
  runImport,
} from "@openstatus/services/import";

import { toServiceCtx, toTRPCError } from "../service-adapter";
import { createTRPCRouter, protectedProcedure } from "../trpc";

export const importRouter = createTRPCRouter({
  preview: protectedProcedure
    .input(PreviewImportInput)
    .mutation(async ({ ctx, input }) => {
      try {
        return await previewImport({ ctx: toServiceCtx(ctx), input });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  run: protectedProcedure
    .input(RunImportInput)
    .mutation(async ({ ctx, input }) => {
      try {
        return await runImport({ ctx: toServiceCtx(ctx), input });
      } catch (err) {
        toTRPCError(err);
      }
    }),
});
