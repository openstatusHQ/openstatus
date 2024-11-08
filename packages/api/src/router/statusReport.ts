import { z } from "zod";

import { and, eq, inArray, isNotNull, sql } from "@openstatus/db";
import {
  insertStatusReportSchema,
  insertStatusReportUpdateSchema,
  monitorsToStatusReport,
  page,
  pageSubscriber,
  selectMonitorSchema,
  selectPublicStatusReportSchemaWithRelation,
  selectStatusReportSchema,
  selectStatusReportUpdateSchema,
  statusReport,
  statusReportStatusSchema,
  statusReportUpdate,
  workspace,
} from "@openstatus/db/src/schema";
import { sendBatchEmailHtml } from "@openstatus/emails/src/send";

import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";

export const statusReportRouter = createTRPCRouter({
  createStatusReport: protectedProcedure
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
            })),
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
            eq(statusReport.workspaceId, opts.ctx.workspace.id),
          ),
        )
        .returning()
        .get();

      const { id, ...statusReportUpdateInput } = opts.input;

      // Send email

      const updatedValue = await opts.ctx.db
        .insert(statusReportUpdate)
        .values(statusReportUpdateInput)
        .returning()
        .get();

      const currentWorkspace = await opts.ctx.db
        .select()
        .from(workspace)
        .where(eq(workspace.id, opts.ctx.workspace.id))
        .get();
      if (currentWorkspace?.plan !== "pro" && _statusReport.pageId) {
        const subscribers = await opts.ctx.db
          .select()
          .from(pageSubscriber)
          .where(
            and(
              eq(pageSubscriber.pageId, _statusReport.pageId),
              isNotNull(pageSubscriber.acceptedAt),
            ),
          )
          .all();
        const pageInfo = await opts.ctx.db
          .select()
          .from(page)
          .where(eq(page.id, _statusReport.pageId))
          .get();
        if (pageInfo) {
          const emails = subscribers.map((subscriber) => {
            return {
              to: subscriber.email,

              subject: `New status update for ${pageInfo.title}`,
              html: `<p>Hi,</p><p>${pageInfo.title} just posted an update on their status page:</p><p>New Status : ${updatedValue.status}</p><p>${updatedValue.message}</p></p><p></p><p>Powered by OpenStatus</p><p></p><p></p><p></p><p></p><p></p>
        `,
              from: "Notification OpenStatus <notification@notifications.openstatus.dev>",
            };
          });
          if (emails.length > 0) {
            await sendBatchEmailHtml(emails);
          }
        }
      }
      return updatedValue;
    }),

  updateStatusReport: protectedProcedure
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
            eq(statusReport.workspaceId, opts.ctx.workspace.id),
          ),
        )
        .returning()
        .get();

      const currentMonitorsToStatusReport = await opts.ctx.db
        .select()
        .from(monitorsToStatusReport)
        .where(
          eq(monitorsToStatusReport.statusReportId, currentStatusReport.id),
        )
        .all();

      const addedMonitors = monitors.filter(
        (x) =>
          !currentMonitorsToStatusReport
            .map(({ monitorId }) => monitorId)
            .includes(x),
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
              inArray(monitorsToStatusReport.monitorId, removedMonitors),
            ),
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
        .set(statusReportUpdateInput)
        .where(eq(statusReportUpdate.id, statusReportUpdateInput.id))
        .returning()
        .get();

      return currentStatusReportUpdate;
    }),

  deleteStatusReport: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async (opts) => {
      const statusReportToDelete = await opts.ctx.db
        .select()
        .from(statusReport)
        .where(
          and(
            eq(statusReport.id, opts.input.id),
            eq(statusReport.workspaceId, opts.ctx.workspace.id),
          ),
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
              }),
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
            : undefined,
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
          }),
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
            }),
          )
          .default([]),
        statusReportUpdates: z.array(selectStatusReportUpdateSchema),
      });

      const result = await opts.ctx.db.query.statusReport.findMany({
        where: and(
          eq(statusReport.workspaceId, opts.ctx.workspace.id),
          eq(statusReport.pageId, opts.input.id),
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
          eq(statusReport.workspaceId, result.workspaceId),
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
});
