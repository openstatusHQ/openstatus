import { z } from "zod";

import { and, desc, asc, eq, gte, inArray, SQL, sql } from "@openstatus/db";
import {
  insertStatusReportSchema,
  insertStatusReportUpdateSchema,
  monitorsToStatusReport,
  page,
  selectPageSchema,
  selectMonitorSchema,
  selectPublicStatusReportSchemaWithRelation,
  selectStatusReportSchema,
  selectStatusReportUpdateSchema,
  statusReport,
  statusReportStatus,
  statusReportStatusSchema,
  statusReportUpdate,
} from "@openstatus/db/src/schema";

import { Events } from "@openstatus/analytics";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";

export const statusReportRouter = createTRPCRouter({
  createStatusReport: protectedProcedure
    .meta({ track: Events.CreateReport })
    .input(insertStatusReportSchema)
    .mutation(async (opts) => {
      const { id, monitors, date, message, ...statusReportInput } = opts.input;

      const newStatusReport = await opts.ctx.db
        .insert(statusReport)
        .values({
          workspaceId: opts.ctx.workspace.id,
          ...statusReportInput,
        })
        .returning()
        .get();

      if (monitors.length > 0) {
        await opts.ctx.db
          .insert(monitorsToStatusReport)
          .values(
            monitors.map((monitor) => ({
              monitorId: monitor,
              statusReportId: newStatusReport.id,
            }))
          )
          .returning()
          .get();
      }

      return newStatusReport;
    }),

  createStatusReportUpdate: protectedProcedure
    .input(insertStatusReportUpdateSchema)
    .mutation(async (opts) => {
      // update parent status report with latest status
      const _statusReport = await opts.ctx.db
        .update(statusReport)
        .set({ status: opts.input.status, updatedAt: new Date() })
        .where(
          and(
            eq(statusReport.id, opts.input.statusReportId),
            eq(statusReport.workspaceId, opts.ctx.workspace.id)
          )
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

      return selectStatusReportUpdateSchema.parse(updatedValue);
    }),

  updateStatusReport: protectedProcedure
    .meta({ track: Events.UpdateReport })
    .input(insertStatusReportSchema)
    .mutation(async (opts) => {
      const { monitors, ...statusReportInput } = opts.input;

      if (!statusReportInput.id) return;

      const { title, status } = statusReportInput;

      const currentStatusReport = await opts.ctx.db
        .update(statusReport)
        .set({ title, status, updatedAt: new Date() })
        .where(
          and(
            eq(statusReport.id, statusReportInput.id),
            eq(statusReport.workspaceId, opts.ctx.workspace.id)
          )
        )
        .returning()
        .get();

      const currentMonitorsToStatusReport = await opts.ctx.db
        .select()
        .from(monitorsToStatusReport)
        .where(
          eq(monitorsToStatusReport.statusReportId, currentStatusReport.id)
        )
        .all();

      const addedMonitors = monitors.filter(
        (x) =>
          !currentMonitorsToStatusReport
            .map(({ monitorId }) => monitorId)
            .includes(x)
      );

      if (addedMonitors.length) {
        const values = addedMonitors.map((monitorId) => ({
          monitorId: monitorId,
          statusReportId: currentStatusReport.id,
        }));

        await opts.ctx.db.insert(monitorsToStatusReport).values(values).run();
      }

      const removedMonitors = currentMonitorsToStatusReport
        .map(({ monitorId }) => monitorId)
        .filter((x) => !monitors?.includes(x));

      if (removedMonitors.length) {
        await opts.ctx.db
          .delete(monitorsToStatusReport)
          .where(
            and(
              eq(monitorsToStatusReport.statusReportId, currentStatusReport.id),
              inArray(monitorsToStatusReport.monitorId, removedMonitors)
            )
          )
          .run();
      }

      return currentStatusReport;
    }),

  updateStatusReportUpdate: protectedProcedure
    .input(insertStatusReportUpdateSchema)
    .mutation(async (opts) => {
      const statusReportUpdateInput = opts.input;

      if (!statusReportUpdateInput.id) return;

      const currentStatusReportUpdate = await opts.ctx.db
        .update(statusReportUpdate)
        .set({ ...statusReportUpdateInput, updatedAt: new Date() })
        .where(eq(statusReportUpdate.id, statusReportUpdateInput.id))
        .returning()
        .get();

      return selectStatusReportUpdateSchema.parse(currentStatusReportUpdate);
    }),

  deleteStatusReport: protectedProcedure
    .meta({ track: Events.DeleteReport })
    .input(z.object({ id: z.number() }))
    .mutation(async (opts) => {
      const statusReportToDelete = await opts.ctx.db
        .select()
        .from(statusReport)
        .where(
          and(
            eq(statusReport.id, opts.input.id),
            eq(statusReport.workspaceId, opts.ctx.workspace.id)
          )
        )
        .get();
      if (!statusReportToDelete) return;

      await opts.ctx.db
        .delete(statusReport)
        .where(eq(statusReport.id, statusReportToDelete.id))
        .run();
    }),

  deleteStatusReportUpdate: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async (opts) => {
      const statusReportUpdateToDelete = await opts.ctx.db
        .select()
        .from(statusReportUpdate)
        .where(and(eq(statusReportUpdate.id, opts.input.id)))
        .get();

      if (!statusReportUpdateToDelete) return;

      await opts.ctx.db
        .delete(statusReportUpdate)
        .where(eq(statusReportUpdate.id, opts.input.id))
        .run();
    }),

  getStatusReportById: protectedProcedure
    .input(z.object({ id: z.number(), pageId: z.number().optional() }))
    .query(async (opts) => {
      const selectPublicStatusReportSchemaWithRelation =
        selectStatusReportSchema.extend({
          status: statusReportStatusSchema.default("investigating"), // TODO: remove!
          monitorsToStatusReports: z
            .array(
              z.object({
                statusReportId: z.number(),
                monitorId: z.number(),
                monitor: selectMonitorSchema,
              })
            )
            .default([]),
          statusReportUpdates: z.array(selectStatusReportUpdateSchema),
          date: z.date().default(new Date()),
        });

      const data = await opts.ctx.db.query.statusReport.findFirst({
        where: and(
          eq(statusReport.id, opts.input.id),
          eq(statusReport.workspaceId, opts.ctx.workspace.id),
          // only allow to fetch status report if it belongs to the page
          opts.input.pageId
            ? eq(statusReport.pageId, opts.input.pageId)
            : undefined
        ),
        with: {
          monitorsToStatusReports: { with: { monitor: true } },
          statusReportUpdates: {
            orderBy: (statusReportUpdate, { desc }) => [
              desc(statusReportUpdate.createdAt),
            ],
          },
        },
      });

      return selectPublicStatusReportSchemaWithRelation.parse(data);
    }),

  getStatusReportUpdateById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async (opts) => {
      const data = await opts.ctx.db.query.statusReportUpdate.findFirst({
        where: and(eq(statusReportUpdate.id, opts.input.id)),
      });
      return selectStatusReportUpdateSchema.parse(data);
    }),

  getStatusReportByWorkspace: protectedProcedure.query(async (opts) => {
    // FIXME: can we get rid of that?
    const selectStatusSchemaWithRelation = selectStatusReportSchema.extend({
      status: statusReportStatusSchema.default("investigating"), // TODO: remove!
      monitorsToStatusReports: z
        .array(
          z.object({
            statusReportId: z.number(),
            monitorId: z.number(),
            monitor: selectMonitorSchema,
          })
        )
        .default([]),
      statusReportUpdates: z.array(selectStatusReportUpdateSchema),
    });

    const result = await opts.ctx.db.query.statusReport.findMany({
      where: eq(statusReport.workspaceId, opts.ctx.workspace.id),
      with: {
        monitorsToStatusReports: { with: { monitor: true } },
        statusReportUpdates: {
          orderBy: (statusReportUpdate, { desc }) => [
            desc(statusReportUpdate.createdAt),
          ],
        },
      },
      orderBy: (statusReport, { desc }) => [desc(statusReport.updatedAt)],
    });
    return z.array(selectStatusSchemaWithRelation).parse(result);
  }),

  getStatusReportByPageId: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async (opts) => {
      // FIXME: can we get rid of that?
      const selectStatusSchemaWithRelation = selectStatusReportSchema.extend({
        status: statusReportStatusSchema.default("investigating"), // TODO: remove!
        monitorsToStatusReports: z
          .array(
            z.object({
              statusReportId: z.number(),
              monitorId: z.number(),
              monitor: selectMonitorSchema,
            })
          )
          .default([]),
        statusReportUpdates: z.array(selectStatusReportUpdateSchema),
      });

      const result = await opts.ctx.db.query.statusReport.findMany({
        where: and(
          eq(statusReport.workspaceId, opts.ctx.workspace.id),
          eq(statusReport.pageId, opts.input.id)
        ),
        with: {
          monitorsToStatusReports: { with: { monitor: true } },
          statusReportUpdates: {
            orderBy: (statusReportUpdate, { desc }) => [
              desc(statusReportUpdate.createdAt),
            ],
          },
        },
        orderBy: (statusReport, { desc }) => [desc(statusReport.updatedAt)],
      });
      return z.array(selectStatusSchemaWithRelation).parse(result);
    }),

  getPublicStatusReportById: publicProcedure
    .input(z.object({ slug: z.string().toLowerCase(), id: z.number() }))
    .query(async (opts) => {
      const result = await opts.ctx.db.query.page.findFirst({
        where: sql`lower(${page.slug}) = ${opts.input.slug} OR  lower(${page.customDomain}) = ${opts.input.slug}`,
      });

      if (!result) return;

      const _statusReport = await opts.ctx.db.query.statusReport.findFirst({
        where: and(
          eq(statusReport.id, opts.input.id),
          eq(statusReport.pageId, result.id),
          eq(statusReport.workspaceId, result.workspaceId)
        ),
        with: {
          monitorsToStatusReports: { with: { monitor: true } },
          statusReportUpdates: {
            orderBy: (reports, { desc }) => desc(reports.date),
          },
        },
      });

      if (!_statusReport) return;

      return selectPublicStatusReportSchemaWithRelation.parse(_statusReport);
    }),

  // DASHBOARD

  list: protectedProcedure
    .input(
      z.object({
        createdAt: z
          .object({
            gte: z.date().optional(),
          })
          .optional(),
        order: z.enum(["asc", "desc"]).optional(),
        pageId: z.number().optional(),
      })
    )
    .query(async (opts) => {
      const whereConditions: SQL[] = [
        eq(statusReport.workspaceId, opts.ctx.workspace.id),
      ];

      if (opts.input?.createdAt?.gte) {
        whereConditions.push(
          gte(statusReport.createdAt, opts.input.createdAt.gte)
        );
      }

      if (opts.input?.pageId) {
        whereConditions.push(eq(statusReport.pageId, opts.input.pageId));
      }

      const result = await opts.ctx.db.query.statusReport.findMany({
        where: and(...whereConditions),
        with: {
          statusReportUpdates: true,
          monitorsToStatusReports: { with: { monitor: true } },
          page: true,
        },
        orderBy: (statusReport) => [
          opts.input.order === "asc"
            ? asc(statusReport.createdAt)
            : desc(statusReport.createdAt),
        ],
      });

      return selectStatusReportSchema
        .extend({
          updates: z.array(selectStatusReportUpdateSchema).default([]),
          monitors: z.array(selectMonitorSchema).default([]),
          page: selectPageSchema,
        })
        .array()
        .parse(
          result.map((report) => ({
            ...report,
            updates: report.statusReportUpdates,
            monitors: report.monitorsToStatusReports.map(
              ({ monitor }) => monitor
            ),
          }))
        );
    }),

  create: protectedProcedure
    .meta({ track: Events.CreateReport })
    .input(
      z.object({
        title: z.string(),
        status: z.enum(statusReportStatus),
        pageId: z.number(),
        monitors: z.array(z.number()),
        date: z.coerce.date(),
        message: z.string(),
      })
    )
    .mutation(async (opts) => {
      // TODO: send email via eailRouter.sendStatusReport

      opts.ctx.db.transaction(async (tx) => {
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

        await tx
          .insert(statusReportUpdate)
          .values({
            statusReportId: newStatusReport.id,
            status: opts.input.status,
            date: opts.input.date,
            message: opts.input.message,
          })
          .returning()
          .get();

        if (opts.input.monitors.length > 0) {
          await tx
            .insert(monitorsToStatusReport)
            .values(
              opts.input.monitors.map((monitor) => ({
                monitorId: monitor,
                statusReportId: newStatusReport.id,
              }))
            )
            .returning()
            .get();
        }
      });
    }),

  updateStatus: protectedProcedure
    .meta({ track: Events.UpdateReport })
    .input(
      z.object({
        id: z.number(),
        monitors: z.array(z.number()),
        title: z.string(),
        status: z.enum(statusReportStatus),
      })
    )
    .mutation(async (opts) => {
      opts.ctx.db.transaction(async (tx) => {
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
              eq(statusReport.workspaceId, opts.ctx.workspace.id)
            )
          )
          .run();

        await tx
          .delete(monitorsToStatusReport)
          .where(eq(monitorsToStatusReport.statusReportId, opts.input.id))
          .run();

        if (opts.input.monitors.length > 0) {
          await tx
            .insert(monitorsToStatusReport)
            .values(
              opts.input.monitors.map((monitor) => ({
                monitorId: monitor,
                statusReportId: opts.input.id,
              }))
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
