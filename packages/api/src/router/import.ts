import { and, db, eq } from "@openstatus/db";
import { page } from "@openstatus/db/src/schema";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { previewImport, runImport } from "../service/import";
import { createTRPCRouter, protectedProcedure } from "../trpc";

export const importRouter = createTRPCRouter({
  preview: protectedProcedure
    .input(
      z.object({
        provider: z.enum(["statuspage"]),
        apiKey: z.string().min(1),
        statuspagePageId: z.string().optional(),
      }),
    )
    .query(async (opts) => {
      return previewImport({
        apiKey: opts.input.apiKey,
        statuspagePageId: opts.input.statuspagePageId,
        workspaceId: opts.ctx.workspace.id,
      });
    }),

  run: protectedProcedure
    .input(
      z.object({
        provider: z.enum(["statuspage"]),
        apiKey: z.string().min(1),
        pageId: z.number().optional(),
        statuspagePageId: z.string().optional(),
        options: z
          .object({
            includeIncidents: z.boolean().default(true),
            includeSubscribers: z.boolean().default(false),
            includeComponents: z.boolean().default(true),
          })
          .optional(),
      }),
    )
    .mutation(async (opts) => {
      // If pageId provided, verify it belongs to workspace
      if (opts.input.pageId) {
        const existing = await db
          .select()
          .from(page)
          .where(
            and(
              eq(page.id, opts.input.pageId),
              eq(page.workspaceId, opts.ctx.workspace.id),
            ),
          )
          .get();

        if (!existing) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Page not found or does not belong to this workspace",
          });
        }
      }

      return runImport({
        apiKey: opts.input.apiKey,
        statuspagePageId: opts.input.statuspagePageId,
        workspaceId: opts.ctx.workspace.id,
        pageId: opts.input.pageId,
        options: opts.input.options,
        limits: opts.ctx.workspace.limits,
      });
    }),
});
