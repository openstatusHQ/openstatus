import { z } from "zod";

import { and, eq, inArray, isNotNull, sql } from "@openstatus/db";
import {
  insertStatusReportSchema,
  insertStatusReportUpdateSchema,
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
import { sendEmailHtml } from "@openstatus/emails/emails/send";

import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";

export const statusReportRouter = createTRPCRouter({
  createStatusReport: protectedProcedure
    .input(insertStatusReportSchema)
    .mutation(async (opts) => {
      const { id, date, message, ...statusReportInput } = opts.input;

      const newStatusReport = await opts.ctx.db
        .insert(statusReport)
        .values({
          workspaceId: opts.ctx.workspace.id,
          ...statusReportInput,
        })
        .returning()
        .get();

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
      if (currentWorkspace?.plan !== "pro") {
        const subscribers = await opts.ctx.db
          .select()
          .from(pageSubscriber)
          .where(
            and(
              eq(pageSubscriber.pageId, _statusReport.pageId),
              isNotNull(pageSubscriber.acceptedAt)
            )
          )
          .all();
        const pageInfo = await opts.ctx.db
          .select()
          .from(page)
          .where(eq(page.id, _statusReport.pageId))
          .get();
        if (pageInfo) {
          const subscribersEmails = subscribers.map(
            (subscriber) => subscriber.email
          );
          await sendEmailHtml({
            to: subscribersEmails,
            subject: `New status update for ${pageInfo.title}`,
            html: `<p>Hi,</p><p>${pageInfo.title} just posted an update on their status page:</p><p>New Status : ${updatedValue.status}</p><p>${updatedValue.message}</p></p><p></p><p>Powered by OpenStatus</p><p></p><p></p><p></p><p></p><p></p>
        `,
            from: "Notification OpenStatus <notification@notifications.openstatus.dev>",
          });
        }
      }
      return updatedValue;
    }),

  updateStatusReport: protectedProcedure
    .input(insertStatusReportSchema)
    .mutation(async (opts) => {
      const { ...statusReportInput } = opts.input;

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
    .input(z.object({ id: z.number() }))
    .query(async (opts) => {
      const selectPublicStatusReportSchemaWithRelation =
        selectStatusReportSchema.extend({
          status: statusReportStatusSchema.default("investigating"), // TODO: remove!

          statusReportUpdates: z.array(selectStatusReportUpdateSchema),
          date: z.date().default(new Date()),
        });

      const data = await opts.ctx.db.query.statusReport.findFirst({
        where: and(
          eq(statusReport.id, opts.input.id),
          eq(statusReport.workspaceId, opts.ctx.workspace.id)
        ),
        with: {
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
      statusReportUpdates: z.array(selectStatusReportUpdateSchema),
    });

    const result = await opts.ctx.db.query.statusReport.findMany({
      where: eq(statusReport.workspaceId, opts.ctx.workspace.id),
      with: {
        statusReportUpdates: {
          orderBy: (statusReportUpdate, { desc }) => [
            desc(statusReportUpdate.createdAt),
          ],
        },
      },
      orderBy: (statusReport, { desc }) => [desc(statusReport.updatedAt)],
    });
    console.log(result);
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
          eq(statusReport.workspaceId, result.workspaceId)
        ),
        with: {
          statusReportUpdates: {
            orderBy: (reports, { desc }) => desc(reports.date),
          },
        },
      });

      if (!_statusReport) return;

      return selectPublicStatusReportSchemaWithRelation.parse(_statusReport);
    }),
});
