import { z } from "zod";

import { and, eq, schema } from "@openstatus/db";
import { selectIncidentSchema } from "@openstatus/db/src/schema";

import { createTRPCRouter, protectedProcedure } from "../trpc";

export const incidentRouter = createTRPCRouter({
  getAllIncidents: protectedProcedure
    .output(z.array(selectIncidentSchema))
    .query(async (opts) => {
      const result = await opts.ctx.db
        .select()
        .from(schema.incidentTable)
        .where(eq(schema.incidentTable.workspaceId, opts.ctx.workspace.id))
        .all();
      return z.array(selectIncidentSchema).parse(result);
    }),

  getIncidentById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .output(selectIncidentSchema)
    .query(async (opts) => {
      const currentIncident = await opts.ctx.db
        .select()
        .from(schema.incidentTable)
        .where(
          and(
            eq(schema.incidentTable.id, opts.input.id),
            eq(schema.incidentTable.workspaceId, opts.ctx.workspace.id),
          ),
        )
        .get();
      return selectIncidentSchema.parse(currentIncident);
    }),
});
