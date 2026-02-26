import { and, eq } from "@openstatus/db";
import {
  privateLocation,
  privateLocationToMonitors,
} from "@openstatus/db/src/schema";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "../trpc";

export const privateLocationRouter = createTRPCRouter({
  list: protectedProcedure.query(async (opts) => {
    const privateLocations = await opts.ctx.db.transaction(async (tx) => {
      return await tx.query.privateLocation.findMany({
        where: eq(privateLocation.workspaceId, opts.ctx.workspace.id),
        with: {
          privateLocationToMonitors: {
            with: { monitor: true },
          },
        },
      });
    });
    const result = privateLocations.map((privateLocation) => ({
      ...privateLocation,
      monitors: privateLocation.privateLocationToMonitors
        .map((m) => m.monitor)
        .filter((m) => m !== null),
    }));
    return result;
  }),
  new: protectedProcedure
    .input(
      z.object({
        name: z.string(),
        monitors: z.array(z.number()),
        token: z.string(),
      }),
    )
    .mutation(async (opts) => {
      return await opts.ctx.db.transaction(async (tx) => {
        const _privateLocation = await tx
          .insert(privateLocation)
          .values({
            name: opts.input.name,
            token: opts.input.token,
            workspaceId: opts.ctx.workspace.id,
          })
          .returning()
          .get();

        if (opts.input.monitors.length) {
          await tx.insert(privateLocationToMonitors).values(
            opts.input.monitors.map((monitorId) => ({
              privateLocationId: _privateLocation.id,
              monitorId,
            })),
          );
        }
        return _privateLocation;
      });
    }),
  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string(),
        monitors: z.array(z.number()),
      }),
    )
    .mutation(async (opts) => {
      const existing = await opts.ctx.db.query.privateLocation.findFirst({
        where: and(
          eq(privateLocation.id, opts.input.id),
          eq(privateLocation.workspaceId, opts.ctx.workspace.id),
        ),
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Private location not found",
        });
      }

      return await opts.ctx.db.transaction(async (tx) => {
        const _privateLocation = await tx
          .update(privateLocation)
          .set({ name: opts.input.name, updatedAt: new Date() })
          .where(
            and(
              eq(privateLocation.id, opts.input.id),
              eq(privateLocation.workspaceId, opts.ctx.workspace.id),
            ),
          )
          .returning()
          .get();

        await tx
          .delete(privateLocationToMonitors)
          .where(
            eq(
              privateLocationToMonitors.privateLocationId,
              _privateLocation.id,
            ),
          );

        if (opts.input.monitors.length) {
          await tx.insert(privateLocationToMonitors).values(
            opts.input.monitors.map((monitorId) => ({
              privateLocationId: _privateLocation.id,
              monitorId,
            })),
          );
        }

        return _privateLocation;
      });
    }),
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async (opts) => {
      console.log("delete private location", opts.input.id);
      return await opts.ctx.db.transaction(async (tx) => {
        await tx
          .delete(privateLocation)
          .where(
            and(
              eq(privateLocation.id, opts.input.id),
              eq(privateLocation.workspaceId, opts.ctx.workspace.id),
            ),
          );
      });
    }),
});
