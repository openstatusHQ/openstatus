import { z } from "zod";

import { eq } from "@openstatus/db";
import {
  incident,
  incidentUpdate,
  insertIncidentSchema,
  insertIncidentUpdateSchema,
  page,
  workspace,
} from "@openstatus/db/src/schema";

import { createTRPCRouter, protectedProcedure } from "../trpc";

export const incidentRouter = createTRPCRouter({
  createIncident: protectedProcedure
    .input(insertIncidentSchema)
    .mutation(async (opts) => {
      // FIXME: SECURE THIS
      return opts.ctx.db.insert(incident).values(opts.input).returning().get();
    }),

  createIncidentUpdate: protectedProcedure
    .input(insertIncidentUpdateSchema)
    .mutation(async (opts) => {
      // FIXME: SECURE THIS
      return await opts.ctx.db
        .insert(incidentUpdate)
        .values(opts.input)
        .returning()
        .get();
    }),

  updateIncident: protectedProcedure
    .input(
      z.object({
        incidentId: z.number(),
        data: insertIncidentSchema.pick({ status: true }),
      }),
    )
    .mutation(async (opts) => {
      return opts.ctx.db
        .update(incident)
        .set({ status: opts.input.data.status, updatedAt: new Date() })
        .where(eq(incident.id, opts.input.incidentId))
        .returning()
        .get();
    }),
  // FIXME: SECURE THIS
  getIncidentByWorkspace: protectedProcedure
    .input(z.object({ workspaceSlug: z.string() }))
    .query(async (opts) => {
      const currentWorkspace = await opts.ctx.db
        .select()
        .from(workspace)
        .where(eq(workspace.slug, opts.input.workspaceSlug))
        .get();
      const pageQuery = opts.ctx.db
        .select()
        .from(page)
        .where(eq(page.workspaceId, currentWorkspace.id))
        .as("pageQuery");
      return opts.ctx.db
        .select()
        .from(incident)
        .innerJoin(pageQuery, eq(incident.pageId, pageQuery.id))
        .all();
    }),
});
