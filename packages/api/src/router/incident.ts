import { z } from "zod";

import {
  type SQL,
  and,
  asc,
  desc,
  eq,
  gte,
  isNull,
  schema,
} from "@openstatus/db";
import {
  incidentTable,
  selectIncidentSchema,
  selectMonitorSchema,
} from "@openstatus/db/src/schema";

import { Events } from "@openstatus/analytics";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "../trpc";

export const incidentRouter = createTRPCRouter({
  // TODO: rename getIncidentsByWorkspace to make it consistent with the other methods
  getIncidentsByWorkspace: protectedProcedure
    .output(z.array(selectIncidentSchema))
    .query(async (opts) => {
      const result = await opts.ctx.db
        .select()
        .from(schema.incidentTable)
        .where(eq(schema.incidentTable.workspaceId, opts.ctx.workspace.id))
        .leftJoin(
          schema.monitor,
          eq(schema.incidentTable.monitorId, schema.monitor.id),
        )
        .all();
      return z
        .array(selectIncidentSchema)
        .parse(
          result.map((r) => ({ ...r.incident, monitorName: r.monitor?.name })),
        );
    }),

  getIncidentById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .output(selectIncidentSchema)
    .query(async (opts) => {
      const result = await opts.ctx.db
        .select()
        .from(schema.incidentTable)
        .where(
          and(
            eq(schema.incidentTable.id, opts.input.id),
            eq(schema.incidentTable.workspaceId, opts.ctx.workspace.id),
          ),
        )
        .leftJoin(
          schema.monitor,
          eq(schema.incidentTable.monitorId, schema.monitor.id),
        )
        .get();

      return selectIncidentSchema.parse({
        ...result?.incident,
        monitorName: result?.monitor?.name,
      });
    }),

  getOpenIncidents: protectedProcedure.query(async (opts) => {
    return await opts.ctx.db
      .select()
      .from(schema.incidentTable)
      .where(
        and(
          eq(schema.incidentTable.workspaceId, opts.ctx.workspace.id),
          isNull(schema.incidentTable.resolvedAt),
        ),
      )
      .all();
  }),

  acknowledgeIncident: protectedProcedure
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
        throw new Error("Incident not found");
      }
      if (currentIncident.acknowledgedAt) {
        throw new Error("Incident already acknowledged");
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
  resolvedIncident: protectedProcedure
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
        throw new Error("Incident not found");
      }
      if (!currentIncident.acknowledgedAt) {
        throw new Error("Incident not acknowledged");
      }
      if (currentIncident.resolvedAt) {
        throw new Error("Incident already resolved");
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

  // DASHBOARD

  list: protectedProcedure
    .input(
      z
        .object({
          startedAt: z
            .object({
              gte: z.date().optional(),
            })
            .optional(),
          monitorId: z.number().nullish(),
          order: z.enum(["asc", "desc"]).optional(),
        })
        .optional(),
    )
    .query(async (opts) => {
      const whereConditions: SQL[] = [
        eq(incidentTable.workspaceId, opts.ctx.workspace.id),
      ];

      if (opts.input?.startedAt?.gte) {
        whereConditions.push(
          gte(incidentTable.startedAt, opts.input.startedAt.gte),
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
