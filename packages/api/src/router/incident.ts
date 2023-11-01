import { z } from "zod";

import { and, eq, inArray } from "@openstatus/db";
import {
  incident,
  incidentStatusSchema,
  incidentUpdate,
  insertIncidentSchema,
  insertIncidentUpdateSchema,
  monitorsToIncidents,
  pagesToIncidents,
  selectIncidentSchema,
  selectIncidentUpdateSchema,
  selectMonitorSchema,
} from "@openstatus/db/src/schema";

import { createTRPCRouter, protectedProcedure } from "../trpc";

export const incidentRouter = createTRPCRouter({
  createIncident: protectedProcedure
    .input(insertIncidentSchema)
    .mutation(async (opts) => {
      const { id, monitors, pages, date, message, ...incidentInput } =
        opts.input;

      const newIncident = await opts.ctx.db
        .insert(incident)
        .values({
          workspaceId: opts.ctx.workspace.id,
          ...incidentInput,
        })
        .returning()
        .get();

      if (monitors.length > 0) {
        await opts.ctx.db
          .insert(monitorsToIncidents)
          .values(
            monitors.map((monitor) => ({
              monitorId: monitor,
              incidentId: newIncident.id,
            })),
          )
          .returning()
          .get();
      }

      if (pages.length > 0) {
        await opts.ctx.db
          .insert(pagesToIncidents)
          .values(
            pages.map((page) => ({
              pageId: page,
              incidentId: newIncident.id,
            })),
          )
          .returning()
          .get();
      }

      return newIncident;
    }),

  createIncidentUpdate: protectedProcedure
    .input(insertIncidentUpdateSchema)
    .mutation(async (opts) => {
      // update parent incident with latest status
      await opts.ctx.db
        .update(incident)
        .set({ status: opts.input.status, updatedAt: new Date() })
        .where(
          and(
            eq(incident.id, opts.input.incidentId),
            eq(incident.workspaceId, opts.ctx.workspace.id),
          ),
        )
        .returning()
        .get();

      const { id, ...incidentUpdateInput } = opts.input;
      return await opts.ctx.db
        .insert(incidentUpdate)
        .values(incidentUpdateInput)
        .returning()
        .get();
    }),

  updateIncident: protectedProcedure
    .input(insertIncidentSchema)
    .mutation(async (opts) => {
      const { monitors, pages, ...incidentInput } = opts.input;

      if (!incidentInput.id) return;

      const { title, status } = incidentInput;

      const currentIncident = await opts.ctx.db
        .update(incident)
        .set({ title, status, updatedAt: new Date() })
        .where(
          and(
            eq(incident.id, incidentInput.id),
            eq(incident.workspaceId, opts.ctx.workspace.id),
          ),
        )
        .returning()
        .get();

      const currentMonitorToIncidents = await opts.ctx.db
        .select()
        .from(monitorsToIncidents)
        .where(eq(monitorsToIncidents.incidentId, currentIncident.id))
        .all();

      const currentMonitorToIncidentsIds = currentMonitorToIncidents.map(
        ({ monitorId }) => monitorId,
      );

      const removedMonitors = currentMonitorToIncidentsIds.filter(
        (x) => !monitors?.includes(x),
      );

      const addedMonitors = monitors?.filter(
        (x) => !currentMonitorToIncidentsIds?.includes(x),
      );

      if (addedMonitors && addedMonitors.length > 0) {
        const values = addedMonitors.map((monitorId) => ({
          monitorId: monitorId,
          incidentId: currentIncident.id,
        }));

        await opts.ctx.db.insert(monitorsToIncidents).values(values).run();
      }

      if (removedMonitors && removedMonitors.length > 0) {
        await opts.ctx.db
          .delete(monitorsToIncidents)
          .where(
            and(
              eq(monitorsToIncidents.incidentId, currentIncident.id),
              inArray(monitorsToIncidents.monitorId, removedMonitors),
            ),
          )
          .run();
      }

      const currentPagesToIncidents = await opts.ctx.db
        .select()
        .from(pagesToIncidents)
        .where(eq(pagesToIncidents.incidentId, currentIncident.id))
        .all();

      const currentPagesToIncidentsIds = currentPagesToIncidents.map(
        ({ pageId }) => pageId,
      );

      const removedPages = currentPagesToIncidentsIds.filter(
        (x) => !pages?.includes(x),
      );

      const addedPages = pages?.filter(
        (x) => !currentPagesToIncidentsIds?.includes(x),
      );

      if (addedPages && addedPages.length > 0) {
        const values = addedPages.map((pageId) => ({
          pageId,
          incidentId: currentIncident.id,
        }));

        await opts.ctx.db.insert(pagesToIncidents).values(values).run();
      }

      if (removedPages && removedPages.length > 0) {
        await opts.ctx.db
          .delete(pagesToIncidents)
          .where(
            and(
              eq(pagesToIncidents.incidentId, currentIncident.id),
              inArray(pagesToIncidents.pageId, removedPages),
            ),
          )
          .run();
      }

      return currentIncident;
    }),

  updateIncidentUpdate: protectedProcedure
    .input(insertIncidentUpdateSchema)
    .mutation(async (opts) => {
      const incidentUpdateInput = opts.input;

      if (!incidentUpdateInput.id) return;

      const currentIncident = await opts.ctx.db
        .update(incidentUpdate)
        .set(incidentUpdateInput)
        .where(eq(incidentUpdate.id, incidentUpdateInput.id))
        .returning()
        .get();

      return currentIncident;
    }),

  deleteIncident: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async (opts) => {
      const incidentToDelete = await opts.ctx.db
        .select()
        .from(incident)
        .where(
          and(
            eq(incident.id, opts.input.id),
            eq(incident.workspaceId, opts.ctx.workspace.id),
          ),
        )
        .get();
      if (!incidentToDelete) return;

      await opts.ctx.db
        .delete(incident)
        .where(eq(incident.id, incidentToDelete.id))
        .run();
    }),

  deleteIncidentUpdate: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async (opts) => {
      const incidentUpdateToDelete = await opts.ctx.db
        .select()
        .from(incidentUpdate)
        .where(and(eq(incidentUpdate.id, opts.input.id)))
        // FIXME: check if incident related to workspaceId
        // .innerJoin(incident, inArray(incident.workspaceId, workspaceIds))
        .get();

      if (!incidentUpdateToDelete) return;

      await opts.ctx.db
        .delete(incidentUpdate)
        .where(eq(incidentUpdate.id, opts.input.id))
        .run();
    }),

  getIncidentById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async (opts) => {
      const selectIncidentSchemaWithRelation = selectIncidentSchema.extend({
        status: incidentStatusSchema.default("investigating"), // TODO: remove!
        monitorsToIncidents: z
          .array(z.object({ incidentId: z.number(), monitorId: z.number() }))
          .default([]),
        pagesToIncidents: z
          .array(z.object({ incidentId: z.number(), pageId: z.number() }))
          .default([]),
        incidentUpdates: z.array(selectIncidentUpdateSchema),
        date: z.date().default(new Date()),
      });

      const data = await opts.ctx.db.query.incident.findFirst({
        where: and(
          eq(incident.id, opts.input.id),
          eq(incident.workspaceId, opts.ctx.workspace.id),
        ),
        with: {
          monitorsToIncidents: true,
          pagesToIncidents: true,
          incidentUpdates: {
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
      const data = await opts.ctx.db.query.incidentUpdate.findFirst({
        where: and(eq(incidentUpdate.id, opts.input.id)),
      });
      return selectIncidentUpdateSchema.parse(data);
    }),

  getIncidentByWorkspace: protectedProcedure.query(async (opts) => {
    // FIXME: can we get rid of that?
    const selectIncidentSchemaWithRelation = selectIncidentSchema.extend({
      status: incidentStatusSchema.default("investigating"), // TODO: remove!
      monitorsToIncidents: z
        .array(
          z.object({
            incidentId: z.number(),
            monitorId: z.number(),
            monitor: selectMonitorSchema,
          }),
        )
        .default([]),
      incidentUpdates: z.array(selectIncidentUpdateSchema),
    });

    const result = await opts.ctx.db.query.incident.findMany({
      where: eq(incident.workspaceId, opts.ctx.workspace.id),
      with: {
        monitorsToIncidents: { with: { monitor: true } },
        incidentUpdates: {
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
