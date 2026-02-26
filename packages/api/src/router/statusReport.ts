import { z } from "zod";

import { type SQL, and, asc, desc, eq, gte } from "@openstatus/db";
import {
  insertStatusReportUpdateSchema,
  page,
  selectPageComponentSchema,
  selectPageSchema,
  selectStatusReportSchema,
  selectStatusReportUpdateSchema,
  statusReport,
  statusReportStatus,
  statusReportUpdate,
  statusReportsToPageComponents,
} from "@openstatus/db/src/schema";

import { Events } from "@openstatus/analytics";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { getPeriodDate, periods } from "./utils";

export const statusReportRouter = createTRPCRouter({
  createStatusReportUpdate: protectedProcedure
    .meta({ track: Events.CreateReportUpdate })
    .input(
      insertStatusReportUpdateSchema.extend({
        notifySubscribers: z.boolean().nullish(),
      }),
    )
    .mutation(async (opts) => {
      // update parent status report with latest status
      const _statusReport = await opts.ctx.db
        .update(statusReport)
        .set({ status: opts.input.status, updatedAt: new Date() })
        .where(
          and(
            eq(statusReport.id, opts.input.statusReportId),
            eq(statusReport.workspaceId, opts.ctx.workspace.id),
          ),
        )
        .returning()
        .get();

      if (!_statusReport) return;

      const { id, ...statusReportUpdateInput } = opts.input;

      const updatedValue = await opts.ctx.db
        .insert(statusReportUpdate)
        .values(statusReportUpdateInput)
        .returning()
        .get();

      return {
        ...selectStatusReportUpdateSchema.parse(updatedValue),
        notifySubscribers: opts.input.notifySubscribers,
      };
    }),

  updateStatusReportUpdate: protectedProcedure
    .meta({ track: Events.UpdateReportUpdate })
    .input(insertStatusReportUpdateSchema)
    .mutation(async (opts) => {
      const statusReportUpdateInput = opts.input;

      if (!statusReportUpdateInput.id) return;

      const existing = await opts.ctx.db.query.statusReportUpdate.findFirst({
        where: eq(statusReportUpdate.id, statusReportUpdateInput.id),
        with: { statusReport: true },
      });

      if (existing?.statusReport.workspaceId !== opts.ctx.workspace.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not allowed to update this status report update",
        });
      }

      const currentStatusReportUpdate = await opts.ctx.db
        .update(statusReportUpdate)
        .set({ ...statusReportUpdateInput, updatedAt: new Date() })
        .where(eq(statusReportUpdate.id, statusReportUpdateInput.id))
        .returning()
        .get();

      return selectStatusReportUpdateSchema.parse(currentStatusReportUpdate);
    }),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async (opts) => {
      const result = await opts.ctx.db.query.statusReport.findFirst({
        where: and(
          eq(statusReport.id, opts.input.id),
          eq(statusReport.workspaceId, opts.ctx.workspace.id),
        ),
        with: {
          statusReportUpdates: true,
          statusReportsToPageComponents: { with: { pageComponent: true } },
          page: { with: { pageComponents: true } },
        },
      });

      if (!result) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Status report not found",
        });
      }

      return selectStatusReportSchema
        .extend({
          updates: z.array(selectStatusReportUpdateSchema).prefault([]),
          pageComponents: z.array(selectPageComponentSchema).prefault([]),
          page: selectPageSchema.extend({
            pageComponents: z.array(selectPageComponentSchema).prefault([]),
          }),
        })
        .parse({
          ...result,
          updates: result.statusReportUpdates,
          pageComponents: result.statusReportsToPageComponents.map(
            ({ pageComponent }) => pageComponent,
          ),
        });
    }),

  list: protectedProcedure
    .input(
      z.object({
        period: z.enum(periods).optional(),
        order: z.enum(["asc", "desc"]).optional(),
        pageId: z.number().optional(),
      }),
    )
    .query(async (opts) => {
      const whereConditions: SQL[] = [
        eq(statusReport.workspaceId, opts.ctx.workspace.id),
      ];

      if (opts.input?.period) {
        whereConditions.push(
          gte(statusReport.createdAt, getPeriodDate(opts.input.period)),
        );
      }

      if (opts.input?.pageId) {
        whereConditions.push(eq(statusReport.pageId, opts.input.pageId));
      }

      const result = await opts.ctx.db.query.statusReport.findMany({
        where: and(...whereConditions),
        with: {
          statusReportUpdates: true,
          statusReportsToPageComponents: { with: { pageComponent: true } },
          page: { with: { pageComponents: true } },
        },
        orderBy: (statusReport) => [
          opts.input.order === "asc"
            ? asc(statusReport.createdAt)
            : desc(statusReport.createdAt),
        ],
      });

      return selectStatusReportSchema
        .extend({
          updates: z.array(selectStatusReportUpdateSchema).prefault([]),
          pageComponents: z.array(selectPageComponentSchema).prefault([]),
          page: selectPageSchema.extend({
            pageComponents: z.array(selectPageComponentSchema).prefault([]),
          }),
        })
        .array()
        .parse(
          result.map((report) => ({
            ...report,
            updates: report.statusReportUpdates,
            pageComponents: report.statusReportsToPageComponents.map(
              ({ pageComponent }) => pageComponent,
            ),
          })),
        );
    }),

  create: protectedProcedure
    .meta({ track: Events.CreateReport })
    .input(
      z.object({
        title: z.string(),
        status: z.enum(statusReportStatus),
        pageId: z.number(),
        pageComponents: z.array(z.number()),
        date: z.coerce.date(),
        message: z.string(),
        notifySubscribers: z.boolean().nullish(),
      }),
    )
    .mutation(async (opts) => {
      const existingPage = await opts.ctx.db.query.page.findFirst({
        where: and(
          eq(page.id, opts.input.pageId),
          eq(page.workspaceId, opts.ctx.workspace.id),
        ),
      });

      if (!existingPage) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Page not found.",
        });
      }

      return opts.ctx.db.transaction(async (tx) => {
        const newStatusReport = await tx
          .insert(statusReport)
          .values({
            workspaceId: opts.ctx.workspace.id,
            title: opts.input.title,
            status: opts.input.status,
            pageId: opts.input.pageId,
          })
          .returning()
          .get();

        const newStatusReportUpdate = await tx
          .insert(statusReportUpdate)
          .values({
            statusReportId: newStatusReport.id,
            status: opts.input.status,
            date: opts.input.date,
            message: opts.input.message,
          })
          .returning()
          .get();

        if (opts.input.pageComponents.length > 0) {
          await tx
            .insert(statusReportsToPageComponents)
            .values(
              opts.input.pageComponents.map((pageComponent) => ({
                pageComponentId: pageComponent,
                statusReportId: newStatusReport.id,
              })),
            )
            .run();
        }

        return {
          ...newStatusReportUpdate,
          notifySubscribers: opts.input.notifySubscribers,
        };
      });
    }),

  updateStatus: protectedProcedure
    .meta({ track: Events.UpdateReport })
    .input(
      z.object({
        id: z.number(),
        pageComponents: z.array(z.number()),
        title: z.string(),
        status: z.enum(statusReportStatus),
      }),
    )
    .mutation(async (opts) => {
      const existing = await opts.ctx.db.query.statusReport.findFirst({
        where: and(
          eq(statusReport.id, opts.input.id),
          eq(statusReport.workspaceId, opts.ctx.workspace.id),
        ),
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Status report not found",
        });
      }

      await opts.ctx.db.transaction(async (tx) => {
        await tx
          .update(statusReport)
          .set({
            title: opts.input.title,
            status: opts.input.status,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(statusReport.id, opts.input.id),
              eq(statusReport.workspaceId, opts.ctx.workspace.id),
            ),
          )
          .run();

        await tx
          .delete(statusReportsToPageComponents)
          .where(
            eq(statusReportsToPageComponents.statusReportId, opts.input.id),
          )
          .run();

        if (opts.input.pageComponents.length > 0) {
          await tx
            .insert(statusReportsToPageComponents)
            .values(
              opts.input.pageComponents.map((pageComponent) => ({
                pageComponentId: pageComponent,
                statusReportId: opts.input.id,
              })),
            )
            .run();
        }
      });
    }),

  delete: protectedProcedure
    .meta({ track: Events.DeleteReport })
    .input(z.object({ id: z.number() }))
    .mutation(async (opts) => {
      const whereConditions: SQL[] = [
        eq(statusReport.id, opts.input.id),
        eq(statusReport.workspaceId, opts.ctx.workspace.id),
      ];

      await opts.ctx.db.transaction(async (tx) => {
        await tx
          .delete(statusReport)
          .where(and(...whereConditions))
          .run();
      });
    }),

  deleteUpdate: protectedProcedure
    .meta({ track: Events.DeleteReportUpdate })
    .input(z.object({ id: z.number() }))
    .mutation(async (opts) => {
      await opts.ctx.db.transaction(async (tx) => {
        const update = await tx.query.statusReportUpdate.findFirst({
          where: eq(statusReportUpdate.id, opts.input.id),
          with: {
            statusReport: true,
          },
        });

        if (update?.statusReport.workspaceId !== opts.ctx.workspace.id) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You are not allowed to delete this update",
          });
        }

        await tx
          .delete(statusReportUpdate)
          .where(eq(statusReportUpdate.id, opts.input.id))
          .run();
      });
    }),
});
