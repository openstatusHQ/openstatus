import { z } from "zod";

import { and, eq, inArray, isNotNull } from "@openstatus/db";
import {
  insertStatusReportSchema,
  insertStatusReportUpdateSchema,
  monitorsToStatusReport,
  page,
  pagesToStatusReports,
  pageSubscriber,
  selectMonitorSchema,
  selectStatusReportSchema,
  selectStatusReportUpdateSchema,
  statusReport,
  statusReportStatusSchema,
  statusReportUpdate,
  workspace,
} from "@openstatus/db/src/schema";
import { sendEmailHtml } from "@openstatus/emails/emails/send";

import { createTRPCRouter, protectedProcedure } from "../trpc";

export const statusReportRouter = createTRPCRouter({
  createStatusReport: protectedProcedure
    .input(insertStatusReportSchema)
    .mutation(async (opts) => {
      const { id, monitors, pages, date, message, ...statusReportInput } =
        opts.input;

      const newStatusReport = await opts.ctx.db
        .insert(statusReport)
        .values({
          workspaceId: opts.ctx.workspace.id,
          ...statusReportInput,
        })
        .returning()
        .get();

      if (Boolean(monitors.length)) {
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

      if (Boolean(pages.length)) {
        await opts.ctx.db
          .insert(pagesToStatusReports)
          .values(
            pages.map((page) => ({
              pageId: page,
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
      await opts.ctx.db
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
      if (currentWorkspace?.plan !== "pro") {
        const allPages = await opts.ctx.db
          .select()
          .from(pagesToStatusReports)
          .where(
            eq(
              pagesToStatusReports.statusReportId,
              updatedValue.statusReportId,
            ),
          )
          .all();
        for (const currentPage of allPages) {
          const subscribers = await opts.ctx.db
            .select()
            .from(pageSubscriber)
            .where(
              and(
                eq(pageSubscriber.pageId, currentPage.pageId),
                isNotNull(pageSubscriber.acceptedAt),
              ),
            )
            .all();
          const pageInfo = await opts.ctx.db
            .select()
            .from(page)
            .where(eq(page.id, currentPage.pageId))
            .get();
          if (!pageInfo) continue;
          const subscribersEmails = subscribers.map(
            (subscriber) => subscriber.email,
          );
          await sendEmailHtml({
            to: subscribersEmails,
            subject: `New status update for ${pageInfo.title}`,
            html: `<p>Hi,</p><p>${pageInfo.title} just posted an update on their status page:</p><p>New Status : ${statusReportUpdate.status}</p><p>${statusReportUpdate.message}</p></p><p></p><p>Powered by OpenStatus</p><p></p><p></p><p></p><p></p><p></p>
        `,
            from: "Notification OpenStatus <notification@openstatus.dev>",
          });
        }
      }
      return updatedValue;
    }),

  updateStatusReport: protectedProcedure
    .input(insertStatusReportSchema)
    .mutation(async (opts) => {
      const { monitors, pages, ...statusReportInput } = opts.input;

      if (!statusReportInput.id) return;

      console.log({ pages });

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

      if (Boolean(addedMonitors.length)) {
        const values = addedMonitors.map((monitorId) => ({
          monitorId: monitorId,
          statusReportId: currentStatusReport.id,
        }));

        await opts.ctx.db.insert(monitorsToStatusReport).values(values).run();
      }

      const removedMonitors = currentMonitorsToStatusReport
        .map(({ monitorId }) => monitorId)
        .filter((x) => !monitors?.includes(x));

      if (Boolean(removedMonitors.length)) {
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

      const currentPagesToStatusReports = await opts.ctx.db
        .select()
        .from(pagesToStatusReports)
        .where(eq(pagesToStatusReports.statusReportId, currentStatusReport.id))
        .all();

      const addedPages = pages?.filter(
        (x) =>
          !currentPagesToStatusReports.map(({ pageId }) => pageId)?.includes(x),
      );

      if (Boolean(addedPages.length)) {
        const values = addedPages.map((pageId) => ({
          pageId,
          statusReportId: currentStatusReport.id,
        }));

        await opts.ctx.db.insert(pagesToStatusReports).values(values).run();
      }

      const removedPages = currentPagesToStatusReports
        .map(({ pageId }) => pageId)
        .filter((x) => !pages?.includes(x));

      console.log({
        currentPagesToStatusReports,
        removedPages,
        pages,
        addedPages,
      });

      if (Boolean(removedPages.length)) {
        await opts.ctx.db
          .delete(pagesToStatusReports)
          .where(
            and(
              eq(pagesToStatusReports.statusReportId, currentStatusReport.id),
              inArray(pagesToStatusReports.pageId, removedPages),
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
    .input(z.object({ id: z.number() }))
    .query(async (opts) => {
      const selectStatusReportSchemaWithRelation =
        selectStatusReportSchema.extend({
          status: statusReportStatusSchema.default("investigating"), // TODO: remove!
          monitorsToStatusReports: z
            .array(
              z.object({ statusReportId: z.number(), monitorId: z.number() }),
            )
            .default([]),
          pagesToStatusReports: z
            .array(z.object({ statusReportId: z.number(), pageId: z.number() }))
            .default([]),
          statusReportUpdates: z.array(selectStatusReportUpdateSchema),
          date: z.date().default(new Date()),
        });

      const data = await opts.ctx.db.query.statusReport.findFirst({
        where: and(
          eq(statusReport.id, opts.input.id),
          eq(statusReport.workspaceId, opts.ctx.workspace.id),
        ),
        with: {
          monitorsToStatusReports: true,
          pagesToStatusReports: true,
          statusReportUpdates: {
            orderBy: (statusReportUpdate, { desc }) => [
              desc(statusReportUpdate.createdAt),
            ],
          },
        },
      });

      return selectStatusReportSchemaWithRelation.parse(data);
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
    console.log(result);
    return z.array(selectStatusSchemaWithRelation).parse(result);
  }),
});
