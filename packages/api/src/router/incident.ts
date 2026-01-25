import { z } from "zod";

import { type SQL, and, asc, desc, eq, gte, schema } from "@openstatus/db";
import {
  incidentTable,
  selectIncidentSchema,
  selectMonitorSchema,
} from "@openstatus/db/src/schema";

import { Events } from "@openstatus/analytics";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { getPeriodDate, periods } from "./utils";

export const incidentRouter = createTRPCRouter({
  delete: protectedProcedure
    .meta({ track: Events.DeleteIncident })
    .input(z.object({ id: z.number() }))
    .mutation(async (opts) => {
      const incidentToDelete = await opts.ctx.db
        .select()
        .from(schema.incidentTable)
        .where(
          and(
            eq(schema.incidentTable.id, opts.input.id),
            eq(schema.incidentTable.workspaceId, opts.ctx.workspace.id),
          ),
        )
        .get();
      if (!incidentToDelete) return;

      await opts.ctx.db
        .delete(schema.incidentTable)
        .where(eq(schema.incidentTable.id, incidentToDelete.id))
        .run();
    }),

  list: protectedProcedure
    .input(
      z
        .object({
          period: z.enum(periods).optional(),
          monitorId: z.number().nullish(),
          order: z.enum(["asc", "desc"]).optional(),
        })
        .optional(),
    )
    .query(async (opts) => {
      const whereConditions: SQL[] = [
        eq(incidentTable.workspaceId, opts.ctx.workspace.id),
      ];

      if (opts.input?.period) {
        whereConditions.push(
          gte(incidentTable.startedAt, getPeriodDate(opts.input.period)),
        );
      }

      if (opts.input?.monitorId) {
        whereConditions.push(eq(incidentTable.monitorId, opts.input.monitorId));
      }

      const result = await opts.ctx.db.query.incidentTable.findMany({
        where: and(...whereConditions),
        with: {
          monitor: true,
        },
        orderBy:
          opts.input?.order === "asc"
            ? asc(incidentTable.startedAt)
            : desc(incidentTable.startedAt),
      });

      return selectIncidentSchema
        .extend({
          monitor: selectMonitorSchema,
        })
        .array()
        .parse(result);
    }),

  acknowledge: protectedProcedure
    .meta({ track: Events.AcknowledgeIncident })
    .input(z.object({ id: z.number() }))
    .mutation(async (opts) => {
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
      if (!currentIncident) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Incident not found",
        });
      }
      if (currentIncident.acknowledgedAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Incident already acknowledged",
        });
      }
      await opts.ctx.db
        .update(schema.incidentTable)
        .set({
          acknowledgedAt: new Date(),
          acknowledgedBy: opts.ctx.user.id,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(schema.incidentTable.id, opts.input.id),
            eq(schema.incidentTable.workspaceId, opts.ctx.workspace.id),
          ),
        );
      return true;
    }),

  resolve: protectedProcedure
    .meta({ track: Events.ResolveIncident })
    .input(z.object({ id: z.number() }))
    .mutation(async (opts) => {
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
      if (!currentIncident) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Incident not found",
        });
      }
      if (currentIncident.resolvedAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Incident already resolved",
        });
      }
      await opts.ctx.db
        .update(schema.incidentTable)
        .set({
          resolvedAt: new Date(),
          resolvedBy: opts.ctx.user.id,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(schema.incidentTable.id, opts.input.id),
            eq(schema.incidentTable.workspaceId, opts.ctx.workspace.id),
          ),
        );
      return true;
    }),
});
