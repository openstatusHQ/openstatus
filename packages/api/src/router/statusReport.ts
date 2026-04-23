import { Events } from "@openstatus/analytics";
import { NotFoundError } from "@openstatus/services";
import {
  AddStatusReportUpdateInput,
  CreateStatusReportInput,
  addStatusReportUpdate,
  createStatusReport,
  deleteStatusReport,
  deleteStatusReportUpdate,
  getStatusReport,
  listStatusReports,
  updateStatusReport,
  updateStatusReportUpdate,
} from "@openstatus/services/status-report";
import { z } from "zod";

import { toServiceCtx, toTRPCError } from "../service-adapter";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { periods } from "./utils";

// tRPC-side input schemas. These preserve the existing wire contract exactly;
// each procedure adapts between this shape and the canonical service schema.

const createStatusReportTRPCInput = z.object({
  title: z.string(),
  status: CreateStatusReportInput.shape.status,
  pageId: z.number(),
  pageComponents: z.array(z.number()),
  date: z.coerce.date(),
  message: z.string(),
  notifySubscribers: z.boolean().nullish(),
});

const createStatusReportUpdateTRPCInput = z.object({
  id: z.number().optional(),
  statusReportId: z.number(),
  status: AddStatusReportUpdateInput.shape.status,
  message: z.string(),
  date: z.coerce.date().optional(),
  notifySubscribers: z.boolean().nullish(),
});

const updateStatusReportUpdateTRPCInput = z.object({
  id: z.number(),
  statusReportId: z.number().optional(),
  status: AddStatusReportUpdateInput.shape.status.optional(),
  message: z.string().optional(),
  date: z.coerce.date().optional(),
});

const updateStatusTRPCInput = z.object({
  id: z.number(),
  pageComponents: z.array(z.number()),
  title: z.string(),
  status: CreateStatusReportInput.shape.status,
});

export const statusReportRouter = createTRPCRouter({
  create: protectedProcedure
    .meta({ track: Events.CreateReport })
    .input(createStatusReportTRPCInput)
    .mutation(async ({ ctx, input }) => {
      try {
        const { initialUpdate } = await createStatusReport({
          ctx: toServiceCtx(ctx),
          input: {
            title: input.title,
            status: input.status,
            pageId: input.pageId,
            pageComponentIds: input.pageComponents,
            date: input.date,
            message: input.message,
          },
        });
        // Preserve the original "return the initial update row with
        // notifySubscribers merged in" shape the dashboard consumes.
        return { ...initialUpdate, notifySubscribers: input.notifySubscribers };
      } catch (err) {
        toTRPCError(err);
      }
    }),

  createStatusReportUpdate: protectedProcedure
    .meta({ track: Events.CreateReportUpdate })
    .input(createStatusReportUpdateTRPCInput)
    .mutation(async ({ ctx, input }) => {
      try {
        const { statusReportUpdate } = await addStatusReportUpdate({
          ctx: toServiceCtx(ctx),
          input: {
            statusReportId: input.statusReportId,
            status: input.status,
            message: input.message,
            date: input.date,
          },
        });
        return {
          ...statusReportUpdate,
          notifySubscribers: input.notifySubscribers,
        };
      } catch (err) {
        toTRPCError(err);
      }
    }),

  updateStatusReportUpdate: protectedProcedure
    .meta({ track: Events.UpdateReportUpdate })
    .input(updateStatusReportUpdateTRPCInput)
    .mutation(async ({ ctx, input }) => {
      try {
        return await updateStatusReportUpdate({
          ctx: toServiceCtx(ctx),
          input: {
            id: input.id,
            status: input.status,
            message: input.message,
            date: input.date,
          },
        });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  updateStatus: protectedProcedure
    .meta({ track: Events.UpdateReport })
    .input(updateStatusTRPCInput)
    .mutation(async ({ ctx, input }) => {
      try {
        await updateStatusReport({
          ctx: toServiceCtx(ctx),
          input: {
            id: input.id,
            title: input.title,
            status: input.status,
            pageComponentIds: input.pageComponents,
          },
        });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  delete: protectedProcedure
    .meta({ track: Events.DeleteReport })
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await deleteStatusReport({
          ctx: toServiceCtx(ctx),
          input: { id: input.id },
        });
      } catch (err) {
        // Preserve the pre-migration idempotent behaviour — the old tRPC
        // delete silently succeeded when the row was already gone.
        if (err instanceof NotFoundError) return;
        toTRPCError(err);
      }
    }),

  deleteUpdate: protectedProcedure
    .meta({ track: Events.DeleteReportUpdate })
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await deleteStatusReportUpdate({
          ctx: toServiceCtx(ctx),
          input: { id: input.id },
        });
      } catch (err) {
        toTRPCError(err);
      }
    }),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      try {
        const result = await getStatusReport({
          ctx: toServiceCtx(ctx),
          input: { id: input.id },
        });
        return narrowPage(result);
      } catch (err) {
        toTRPCError(err);
      }
    }),

  list: protectedProcedure
    .input(
      z.object({
        period: z.enum(periods).optional(),
        order: z.enum(["asc", "desc"]).optional(),
        pageId: z.number().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        const { items } = await listStatusReports({
          ctx: toServiceCtx(ctx),
          input: {
            pageId: input.pageId,
            period: input.period,
            order: input.order ?? "desc",
            // tRPC consumers (dashboard) want the full set — no paging UI
            // today. Pass a sentinel ceiling rather than silently truncating;
            // Connect's separate handler imposes its own max=100.
            limit: 10_000,
            offset: 0,
            statuses: [],
          },
        });
        return items.map(narrowPage);
      } catch (err) {
        toTRPCError(err);
      }
    }),
});

/**
 * Narrow the service's nullable `page` field to a required one for the tRPC
 * return type. Every status report is expected to have a `pageId` (and
 * therefore a `page`) by the dashboard's schema; a null page here is a
 * data-integrity signal we surface rather than silently return.
 */
function narrowPage<T extends { id: number; page: unknown }>(
  report: T,
): T & { page: NonNullable<T["page"]> } {
  if (report.page == null) {
    throw new Error(
      `status report ${report.id} has no associated page (data inconsistency)`,
    );
  }
  return report as T & { page: NonNullable<T["page"]> };
}
