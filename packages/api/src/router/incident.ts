import { z } from "zod";

import { and, asc, desc, eq, inArray } from "@openstatus/db";
import {
  incident,
  incidentUpdate,
  insertIncidentSchema,
  insertIncidentSchemaWithMonitors,
  insertIncidentUpdateSchema,
  page,
  selectIncidentSchema,
  // insertIncidentUpdateSchema,
  selectIncidentUpdateSchema,
  selectMonitorSchema,
  StatusEnum,
  user,
  usersToWorkspaces,
  workspace,
} from "@openstatus/db/src/schema";

import { createTRPCRouter, protectedProcedure } from "../trpc";

export const incidentRouter = createTRPCRouter({
  createIncident: protectedProcedure
    .input(insertIncidentSchema)
    .mutation(async (opts) => {
      const currentWorkspace = await opts.ctx.db
        .select()
        .from(workspace)
        .where(eq(workspace.slug, opts.input.workspaceSlug))
        .get();
      const currentUser = opts.ctx.db
        .select()
        .from(user)
        .where(eq(user.tenantId, opts.ctx.auth.userId))
        .as("currentUser");
      const result = await opts.ctx.db
        .select()
        .from(usersToWorkspaces)
        .where(eq(usersToWorkspaces.workspaceId, currentWorkspace.id))
        .innerJoin(currentUser, eq(usersToWorkspaces.userId, currentUser.id))
        .get();

      if (!result) return;
      const { id, workspaceSlug, monitors, ...incidentInput } = opts.input;

      // add monitors inside of `monitorsToIncidents`

      return opts.ctx.db
        .insert(incident)
        .values({ workspaceId: currentWorkspace.id, ...incidentInput })
        .returning()
        .get();
    }),

  createIncidentUpdate: protectedProcedure
    .input(insertIncidentUpdateSchema)
    .mutation(async (opts) => {
      const currentWorkspace = await opts.ctx.db
        .select()
        .from(workspace)
        .where(eq(workspace.slug, opts.input.workspaceSlug))
        .get();
      const currentUser = opts.ctx.db
        .select()
        .from(user)
        .where(eq(user.tenantId, opts.ctx.auth.userId))
        .as("currentUser");
      const result = await opts.ctx.db
        .select()
        .from(usersToWorkspaces)
        .where(eq(usersToWorkspaces.workspaceId, currentWorkspace.id))
        .innerJoin(currentUser, eq(usersToWorkspaces.userId, currentUser.id))
        .get();

      // TODO: incidentId is valid and user is owner

      if (!result) return;

      // update parent incident with latest status
      const a = await opts.ctx.db
        .update(incident)
        .set({ status: opts.input.status })
        .where(eq(incident.id, opts.input.incidentId))
        .returning()
        .get();

      console.log({ a });

      const { workspaceSlug, ...incidentUpdateInput } = opts.input;
      return await opts.ctx.db
        .insert(incidentUpdate)
        .values(incidentUpdateInput)
        .returning()
        .get();
    }),

  updateIncident: protectedProcedure
    .input(insertIncidentSchemaWithMonitors)
    .mutation(async (opts) => {
      const { monitors, workspaceSlug, ...incidentInput } = opts.input;
      if (!incidentInput.id) return;
      const currentIncident = await opts.ctx.db
        .update(incident)
        .set(incidentInput)
        .where(eq(incident.id, incidentInput.id))
        .returning()
        .get();

      return currentIncident;
    }),

  updateIncidentUpdate: protectedProcedure
    .input(insertIncidentUpdateSchema)
    .mutation(async (opts) => {
      const { workspaceSlug, ...incidentUpdateInput } = opts.input;
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
      // TODO: this looks not very affective
      const currentUser = await opts.ctx.db
        .select()
        .from(user)
        .where(eq(user.tenantId, opts.ctx.auth.userId))
        .get();

      const result = await opts.ctx.db
        .select()
        .from(usersToWorkspaces)
        .where(eq(usersToWorkspaces.userId, currentUser.id))
        .all();
      const workspaceIds = result.map((workspace) => workspace.workspaceId);
      // two queries - can we reduce it?

      const incidentToDelete = await opts.ctx.db
        .select()
        .from(incident)
        .where(
          and(
            eq(incident.id, opts.input.id),
            inArray(incident.workspaceId, workspaceIds),
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
      // TODO: this looks not very affective
      const currentUser = await opts.ctx.db
        .select()
        .from(user)
        .where(eq(user.tenantId, opts.ctx.auth.userId))
        .get();

      const result = await opts.ctx.db
        .select()
        .from(usersToWorkspaces)
        .where(eq(usersToWorkspaces.userId, currentUser.id))
        .all();
      const workspaceIds = result.map((workspace) => workspace.workspaceId);
      // two queries - can we reduce it?

      // const incidentUpdateToDelete = await opts.ctx.db
      //   .select()
      //   .from(incidentUpdate)
      //   .where(
      //     and(
      //       eq(incidentUpdate.id, opts.input.id),
      //       inArray(incidentUpdate.workspaceId, workspaceIds),
      //     ),
      //   )
      //   .get();
      // if (!incidentUpdateToDelete) return;

      await opts.ctx.db
        .delete(incidentUpdate)
        .where(eq(incidentUpdate.id, opts.input.id))
        .run();
    }),

  getIncidentById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async (opts) => {
      const selectIncidentSchemaWithRelation = selectIncidentSchema.extend({
        status: StatusEnum.default("investigating"), // TODO: remove!
        monitors: z
          .array(z.object({ incidentId: z.number(), monitorId: z.number() }))
          .default([]),
        incidentUpdates: z.array(selectIncidentUpdateSchema),
      });

      const data = await opts.ctx.db.query.incident.findFirst({
        where: eq(incident.id, opts.input.id),
        with: {
          monitorsToIncidents: true,
          incidentUpdates: {
            orderBy: (incidentUpdate, { desc }) => [
              desc(incidentUpdate.createdAt),
            ],
          },
        },
      });
      // TODO:
      return selectIncidentSchemaWithRelation.parse(data);
    }),

  getIncidentUpdateById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async (opts) => {
      const data = await opts.ctx.db.query.incidentUpdate.findFirst({
        where: eq(incidentUpdate.id, opts.input.id),
      });
      return selectIncidentUpdateSchema.parse(data);
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

      const selectIncidentSchemaWithRelation = selectIncidentSchema.extend({
        status: StatusEnum.default("investigating"), // TODO: remove!
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
      // TODO: parse

      const data = await opts.ctx.db.query.incident.findMany({
        where: eq(incident.workspaceId, currentWorkspace.id),
        with: {
          monitorsToIncidents: { with: { monitor: true } },
          incidentUpdates: {
            orderBy: (incidentUpdate, { desc }) => [
              desc(incidentUpdate.createdAt),
            ],
          },
        },
        orderBy: (incident, { desc }) => [desc(incident.createdAt)],
      });

      return z.array(selectIncidentSchemaWithRelation).parse(data);
    }),
});
