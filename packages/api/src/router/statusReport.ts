import { z } from "zod";

import { and, eq, inArray } from "@openstatus/db";
import {
  insertStatusReportSchema,
  insertStatusReportUpdateSchema,
  monitorsToStatusReport,
  pagesToStatusReports,
  selectMonitorSchema,
  selectStatusReportSchema,
  selectStatusReportUpdateUpdateSchema,
  statusReport,
  statusReportStatusSchema,
  statusReportUpdate,
} from "@openstatus/db/src/schema";

import { createTRPCRouter, protectedProcedure } from "../trpc";

export const statusReportRouter = createTRPCRouter({
  createIncident: protectedProcedure
    .input(insertStatusReportSchema)
    .mutation(async (opts) => {
      const { id, monitors, pages, date, message, ...incidentInput } =
        opts.input;

      const newStatusReport = await opts.ctx.db
        .insert(statusReport)
        .values({
          workspaceId: opts.ctx.workspace.id,
          ...incidentInput,
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

  createIncidentUpdate: protectedProcedure
    .input(insertStatusReportUpdateSchema)
    .mutation(async (opts) => {
      // update parent incident with latest status
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

      const { id, ...incidentUpdateInput } = opts.input;
      return await opts.ctx.db
        .insert(statusReportUpdate)
        .values(incidentUpdateInput)
        .returning()
        .get();
    }),

  updateIncident: protectedProcedure
    .input(insertStatusReportSchema)
    .mutation(async (opts) => {
      const { monitors, pages, ...incidentInput } = opts.input;

      if (!incidentInput.id) return;

      const { title, status } = incidentInput;

      const currentStatusReport = await opts.ctx.db
        .update(statusReport)
        .set({ title, status, updatedAt: new Date() })
        .where(
          and(
            eq(statusReport.id, incidentInput.id),
            eq(statusReport.workspaceId, opts.ctx.workspace.id),
          ),
        )
        .returning()
        .get();

      const currentMonitorToIncidents = await opts.ctx.db
        .select()
        .from(monitorsToStatusReport)
        .where(
          eq(monitorsToStatusReport.statusReportId, currentStatusReport.id),
        )
        .all();

      const addedMonitors = monitors.filter(
        (x) =>
          !currentMonitorToIncidents
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

      const removedMonitors = currentMonitorToIncidents
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

      const currentPagesToIncidents = await opts.ctx.db
        .select()
        .from(pagesToStatusReports)
        .where(eq(pagesToStatusReports.statusReportId, currentStatusReport.id))
        .all();

      const addedPages = pages?.filter(
        (x) =>
          !currentPagesToIncidents.map(({ pageId }) => pageId)?.includes(x),
      );

      if (Boolean(addedPages.length)) {
        const values = addedPages.map((pageId) => ({
          pageId,
          statusReportId: currentStatusReport.id,
        }));

        await opts.ctx.db.insert(pagesToStatusReports).values(values).run();
      }

      const removedPages = currentPagesToIncidents
        .map(({ pageId }) => pageId)
        .filter((x) => !pages?.includes(x));

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

  updateIncidentUpdate: protectedProcedure
    .input(insertStatusReportUpdateSchema)
    .mutation(async (opts) => {
      const incidentUpdateInput = opts.input;

      if (!incidentUpdateInput.id) return;

      const currentIncident = await opts.ctx.db
        .update(statusReportUpdate)
        .set(incidentUpdateInput)
        .where(eq(statusReportUpdate.id, incidentUpdateInput.id))
        .returning()
        .get();

      return currentIncident;
    }),

  deleteIncident: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async (opts) => {
      const incidentToDelete = await opts.ctx.db
        .select()
        .from(statusReport)
        .where(
          and(
            eq(statusReport.id, opts.input.id),
            eq(statusReport.workspaceId, opts.ctx.workspace.id),
          ),
        )
        .get();
      if (!incidentToDelete) return;

      await opts.ctx.db
        .delete(statusReport)
        .where(eq(statusReport.id, incidentToDelete.id))
        .run();
    }),

  deleteIncidentUpdate: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async (opts) => {
      const incidentUpdateToDelete = await opts.ctx.db
        .select()
        .from(statusReportUpdate)
        .where(and(eq(statusReportUpdate.id, opts.input.id)))
        // FIXME: check if incident related to workspaceId
        // .innerJoin(incident, inArray(incident.workspaceId, workspaceIds))
        .get();

      if (!incidentUpdateToDelete) return;

      await opts.ctx.db
        .delete(statusReportUpdate)
        .where(eq(statusReportUpdate.id, opts.input.id))
        .run();
    }),

  getIncidentById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async (opts) => {
      const selectIncidentSchemaWithRelation = selectStatusReportSchema.extend({
        status: statusReportStatusSchema.default("investigating"), // TODO: remove!
        monitorsToIncidents: z
          .array(z.object({ incidentId: z.number(), monitorId: z.number() }))
          .default([]),
        pagesToIncidents: z
          .array(z.object({ incidentId: z.number(), pageId: z.number() }))
          .default([]),
        incidentUpdates: z.array(selectStatusReportUpdateUpdateSchema),
        date: z.date().default(new Date()),
      });

      const data = await opts.ctx.db.query.statusReport.findFirst({
        where: and(
          eq(statusReport.id, opts.input.id),
          eq(statusReport.workspaceId, opts.ctx.workspace.id),
        ),
        with: {
          monitorsToStatusReports: true,
          pagesToStatusReport: true,
          statusReportUpdates: {
            orderBy: (incidentUpdate, { desc }) => [
              desc(incidentUpdate.createdAt),
            ],
          },
        },
      });

      return selectIncidentSchemaWithRelation.parse(data);
    }),

  getIncidentUpdateById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async (opts) => {
      const data = await opts.ctx.db.query.statusReportUpdate.findFirst({
        where: and(eq(statusReportUpdate.id, opts.input.id)),
      });
      return selectStatusReportUpdateUpdateSchema.parse(data);
    }),

  getIncidentByWorkspace: protectedProcedure.query(async (opts) => {
    // FIXME: can we get rid of that?
    const selectIncidentSchemaWithRelation = selectStatusReportSchema.extend({
      status: statusReportStatusSchema.default("investigating"), // TODO: remove!
      monitorsToIncidents: z
        .array(
          z.object({
            incidentId: z.number(),
            monitorId: z.number(),
            monitor: selectMonitorSchema,
          }),
        )
        .default([]),
      incidentUpdates: z.array(selectStatusReportUpdateUpdateSchema),
    });

    const result = await opts.ctx.db.query.statusReport.findMany({
      where: eq(statusReport.workspaceId, opts.ctx.workspace.id),
      with: {
        monitorsToStatusReports: { with: { monitor: true } },
        statusReportUpdates: {
          orderBy: (incidentUpdate, { desc }) => [
            desc(incidentUpdate.createdAt),
          ],
        },
      },
      orderBy: (incident, { desc }) => [desc(incident.updatedAt)],
    });

    return z.array(selectIncidentSchemaWithRelation).parse(result);
  }),
});
