import { z } from "zod";

import { type SQL, and, asc, desc, eq, gte, inArray } from "@openstatus/db";
import {
  maintenance,
  maintenancesToPageComponents,
  page,
  pageComponent,
  selectMaintenanceSchema,
  selectPageComponentSchema,
} from "@openstatus/db/src/schema";

import { Events } from "@openstatus/analytics";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { getPeriodDate, periods } from "./utils";

export const maintenanceRouter = createTRPCRouter({
  delete: protectedProcedure
    .meta({ track: Events.DeleteMaintenance })
    .input(z.object({ id: z.number() }))
    .mutation(async (opts) => {
      return await opts.ctx.db
        .delete(maintenance)
        .where(
          and(
            eq(maintenance.id, opts.input.id),
            eq(maintenance.workspaceId, opts.ctx.workspace.id),
          ),
        )
        .returning();
    }),

  list: protectedProcedure
    .input(
      z
        .object({
          period: z.enum(periods).optional(),
          pageId: z.number().optional(),
          order: z.enum(["asc", "desc"]).optional(),
        })
        .optional(),
    )
    .query(async (opts) => {
      const whereConditions: SQL[] = [
        eq(maintenance.workspaceId, opts.ctx.workspace.id),
      ];

      if (opts.input?.period) {
        whereConditions.push(
          gte(maintenance.createdAt, getPeriodDate(opts.input.period)),
        );
      }

      if (opts.input?.pageId) {
        whereConditions.push(eq(maintenance.pageId, opts.input.pageId));
      }

      const query = opts.ctx.db.query.maintenance.findMany({
        where: and(...whereConditions),
        orderBy:
          opts.input?.order === "asc"
            ? asc(maintenance.createdAt)
            : desc(maintenance.createdAt),
        with: {
          maintenancesToPageComponents: { with: { pageComponent: true } },
        },
      });

      const result = await query;

      return selectMaintenanceSchema
        .extend({
          pageComponents: z.array(selectPageComponentSchema).prefault([]),
        })
        .array()
        .parse(
          result.map((m) => ({
            ...m,
            pageComponents: m.maintenancesToPageComponents.map(
              ({ pageComponent }) => pageComponent,
            ),
          })),
        );
    }),

  new: protectedProcedure
    .meta({ track: Events.CreateMaintenance })
    .input(
      z.object({
        pageId: z.number(),
        title: z.string(),
        message: z.string(),
        startDate: z.coerce.date(),
        endDate: z.coerce.date(),
        pageComponents: z.array(z.number()).optional(),
        notifySubscribers: z.boolean().nullish(),
      }),
    )
    .mutation(async (opts) => {
      const existingPage = await opts.ctx.db.query.page.findFirst({
        where: and(
          eq(page.id, opts.input.pageId),
          eq(page.workspaceId, opts.ctx.workspace.id),
        ),
      });

      if (!existingPage) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Page not found.",
        });
      }

      // Check if the user has access to the monitors
      if (opts.input.pageComponents?.length) {
        const whereConditions: SQL[] = [
          eq(pageComponent.workspaceId, opts.ctx.workspace.id),
          inArray(pageComponent.id, opts.input.pageComponents),
        ];
        const pageComponents = await opts.ctx.db
          .select()
          .from(pageComponent)
          .where(and(...whereConditions))
          .all();

        if (pageComponents.length !== opts.input.pageComponents.length) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "You do not have access to all the page components",
          });
        }
      }

      const newMaintenance = await opts.ctx.db.transaction(async (tx) => {
        const newMaintenance = await tx
          .insert(maintenance)
          .values({
            pageId: opts.input.pageId,
            workspaceId: opts.ctx.workspace.id,
            title: opts.input.title,
            message: opts.input.message,
            from: opts.input.startDate,
            to: opts.input.endDate,
          })
          .returning()
          .get();

        if (opts.input.pageComponents?.length) {
          await tx.insert(maintenancesToPageComponents).values(
            opts.input.pageComponents.map((pageComponentId) => ({
              maintenanceId: newMaintenance.id,
              pageComponentId,
            })),
          );
        }

        return newMaintenance;
      });

      return {
        ...newMaintenance,
        notifySubscribers: opts.input.notifySubscribers,
      };
    }),

  update: protectedProcedure
    .meta({ track: Events.UpdateMaintenance })
    .input(
      z.object({
        id: z.number(),
        title: z.string(),
        message: z.string(),
        startDate: z.coerce.date(),
        endDate: z.coerce.date(),
        pageComponents: z.array(z.number()).optional(),
      }),
    )
    .mutation(async (opts) => {
      // Check if the user has access to the monitors
      if (opts.input.pageComponents?.length) {
        const whereConditions: SQL[] = [
          eq(pageComponent.workspaceId, opts.ctx.workspace.id),
          inArray(pageComponent.id, opts.input.pageComponents),
        ];
        const pageComponents = await opts.ctx.db
          .select()
          .from(pageComponent)
          .where(and(...whereConditions))
          .all();

        if (pageComponents.length !== opts.input.pageComponents.length) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "You do not have access to all the page components",
          });
        }
      }

      const existing = await opts.ctx.db.query.maintenance.findFirst({
        where: and(
          eq(maintenance.id, opts.input.id),
          eq(maintenance.workspaceId, opts.ctx.workspace.id),
        ),
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Maintenance not found",
        });
      }

      await opts.ctx.db.transaction(async (tx) => {
        // Update the maintenance
        const _maintenance = await tx
          .update(maintenance)
          .set({
            title: opts.input.title,
            message: opts.input.message,
            from: opts.input.startDate,
            to: opts.input.endDate,
            workspaceId: opts.ctx.workspace.id,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(maintenance.id, opts.input.id),
              eq(maintenance.workspaceId, opts.ctx.workspace.id),
            ),
          )
          .returning()
          .get();

        // Delete all existing relations
        await tx
          .delete(maintenancesToPageComponents)
          .where(
            eq(maintenancesToPageComponents.maintenanceId, _maintenance.id),
          )
          .run();

        // Create new relations if page components are provided
        if (opts.input.pageComponents?.length) {
          await tx.insert(maintenancesToPageComponents).values(
            opts.input.pageComponents.map((pageComponentId) => ({
              maintenanceId: _maintenance.id,
              pageComponentId,
            })),
          );
        }

        return _maintenance;
      });
    }),
});
