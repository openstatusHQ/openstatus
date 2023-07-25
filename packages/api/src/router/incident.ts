import { customAlphabet, urlAlphabet } from "nanoid";
import { z } from "zod";

import { eq } from "@openstatus/db";
import {
  incident,
  incidentUpdate,
  insertIncidentSchema,
  insertIncidentUpdateSchema,
  page,
} from "@openstatus/db/src/schema";

import { createTRPCRouter, protectedProcedure } from "../trpc";

export const incidentRouter = createTRPCRouter({
  createIncident: protectedProcedure
    .input(insertIncidentSchema)
    .mutation(async (opts) => {
      const nanoid = customAlphabet(urlAlphabet, 10);

      return opts.ctx.db
        .insert(incident)
        .values({ id: nanoid(), ...opts.input })
        .returning()
        .get();
    }),

  createIncidentUpdate: protectedProcedure
    .input(insertIncidentUpdateSchema)
    .mutation(async (opts) => {
      const nanoid = customAlphabet(urlAlphabet, 10);

      return opts.ctx.db
        .insert(incidentUpdate)
        .values({ id: nanoid(), ...opts.input })
        .returning()
        .get();
    }),

  updateIncident: protectedProcedure
    .input(
      z.object({
        incidentId: z.string(),
        status: insertIncidentSchema.pick({ status: true }),
      }),
    )
    .mutation(async (opts) => {
      return opts.ctx.db
        .update(incident)
        .set(opts.input.status)
        .where(eq(incident.id, opts.input.incidentId))
        .returning()
        .get();
    }),
  getIncidentByWorkspace: protectedProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async (opts) => {
      const pageQuery = opts.ctx.db
        .select()
        .from(page)
        .where(eq(page.workspaceId, opts.input.workspaceId))
        .as("pageQuery");
      return opts.ctx.db
        .select()
        .from(incident)
        .innerJoin(pageQuery, eq(incident.pageId, pageQuery.id))
        .all();
    }),
});
